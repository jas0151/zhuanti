const UserModel = require("./userModel");
const mongoose = require("mongoose");

class ConnectionController {
    constructor() {
        this.userModel = UserModel.getModel();
    }

    async getConnections(req, res) {
        try {
            const userId = req.session.userId;
            const user = await this.userModel.findById(userId);
            
            if (!user) {
                return res.redirect('/login');
            }

            // Initialize connections array if not present
            if (!user.connections) {
                user.connections = {
                    sentRequests: [],
                    receivedRequests: [],
                    connected: []
                };
                await user.save();
            }
            
            // Fetch data for received connection requests
            const pendingRequests = [];
            for (const request of user.connections.receivedRequests || []) {
                const requestUser = await this.userModel.findById(request.from);
                if (requestUser) {
                    pendingRequests.push({
                        user: requestUser,
                        connectionData: request
                    });
                }
            }
            
            // Fetch data for accepted connections
            const acceptedConnections = [];
            for (const connection of user.connections.connected || []) {
                const connectedUser = await this.userModel.findById(connection.user);
                if (connectedUser) {
                    // Check if there are unread messages from this user
                    let hasUnreadMessages = false;
                    const conversation = this.findConversation(user, connection.user.toString());
                    
                    if (conversation && conversation.messages) {
                        hasUnreadMessages = conversation.messages.some(msg => 
                            msg.sender && msg.sender.toString() === connection.user.toString() && !msg.read
                        );
                    }
                    
                    // Check if the user is online (active in the last 5 minutes)
                    const isOnline = connectedUser.lastActive && 
                        (new Date() - new Date(connectedUser.lastActive) < 5 * 60 * 1000);
                    
                    acceptedConnections.push({
                        user: connectedUser,
                        connectionData: connection,
                        hasUnreadMessages,
                        isOnline
                    });
                }
            }
            
            // Sort accepted connections: online users first, then users with unread messages, then recently updated
            acceptedConnections.sort((a, b) => {
                // Online users first
                if (a.isOnline && !b.isOnline) return -1;
                if (!a.isOnline && b.isOnline) return 1;
                
                // Users with unread messages next
                if (a.hasUnreadMessages && !b.hasUnreadMessages) return -1;
                if (!a.hasUnreadMessages && b.hasUnreadMessages) return 1;
                
                // Sort by most recently updated
                return new Date(b.connectionData.updatedAt) - new Date(a.connectionData.updatedAt);
            });
            
            res.render('connections', {
                pendingRequests,
                acceptedConnections,
                success: req.query.success,
                error: req.query.error
            });
        } catch (error) {
            console.error("Error loading connections:", error);
            res.redirect('/main?error=connections_error');
        }
    }

    async acceptConnection(req, res) {
        try {
            const currentUserId = req.session.userId;
            const requestUserId = req.params.userId;
            
            console.log(`Processing connection acceptance: ${currentUserId} accepting ${requestUserId}`);
            
            // Get current user and request user
            const [currentUser, requestUser] = await Promise.all([
                this.userModel.findById(currentUserId),
                this.userModel.findById(requestUserId)
            ]);
            
            if (!currentUser) {
                return res.status(404).json({ success: false, error: 'Current user not found' });
            }
            
            if (!requestUser) {
                return res.status(404).json({ success: false, error: 'Request user not found' });
            }
            
            // Initialize connections if needed
            if (!currentUser.connections) {
                currentUser.connections = { sentRequests: [], receivedRequests: [], connected: [] };
            }
            
            if (!requestUser.connections) {
                requestUser.connections = { sentRequests: [], receivedRequests: [], connected: [] };
            }
            
            // Find and remove the request
            let requestFound = false;
            if (currentUser.connections.receivedRequests) {
                const index = currentUser.connections.receivedRequests.findIndex(
                    req => req.from && req.from.toString() === requestUserId
                );
                
                if (index !== -1) {
                    currentUser.connections.receivedRequests.splice(index, 1);
                    requestFound = true;
                }
            }
            
            // If request not found, check if they're already connected
            if (!requestFound) {
                const alreadyConnected = currentUser.connections.connected.some(
                    conn => conn.user && conn.user.toString() === requestUserId
                );
                
                if (alreadyConnected) {
                    // They're already connected, so we can just respond with success
                    return res.status(200).json({ 
                        success: true, 
                        message: 'Already connected',
                        userId: requestUserId
                    });
                }
            }
            
            // Calculate match data to store with the connection
            const matchController = require('./matchController');
            const matchData = await matchController.calculateMatchScore(currentUser, requestUser);
            
            // Add to connected list with enhanced metadata
            const now = new Date();
            currentUser.connections.connected.push({
                user: requestUserId,
                connectedAt: now,
                updatedAt: now,
                matchScore: matchData.score,
                commonInterests: matchData.commonInterests
            });
            
            // Save current user
            await currentUser.save();
            
            // Also update requestUser for consistency
            // Remove from sent requests
            if (requestUser.connections.sentRequests) {
                const sentIndex = requestUser.connections.sentRequests.findIndex(
                    req => req.to && req.to.toString() === currentUserId
                );
                
                if (sentIndex !== -1) {
                    requestUser.connections.sentRequests.splice(sentIndex, 1);
                }
            }
            
            // Check if already in their connections
            const alreadyInConnections = requestUser.connections.connected.some(
                conn => conn.user && conn.user.toString() === currentUserId
            );
            
            if (!alreadyInConnections) {
                // Add current user to request user's connections with same metadata
                requestUser.connections.connected.push({
                    user: currentUserId,
                    connectedAt: now,
                    updatedAt: now,
                    matchScore: matchData.score,
                    commonInterests: matchData.commonInterests
                });
            }
            
            await requestUser.save();
            
            // Create a notification for the request sender
            await this.createNotification(requestUserId, {
                type: 'connection_accepted',
                from: currentUserId,
                message: `${currentUser.profile.firstName} accepted your connection request!`,
                timestamp: new Date()
            });
            
            // Initialize a conversation between the users if it doesn't exist
            await this.initializeConversation(currentUserId, requestUserId, matchData);
            
            // Send successful response
            return res.status(200).json({ 
                success: true, 
                message: 'Connection accepted',
                userId: requestUserId,
                matchScore: matchData.score
            });
        } catch (error) {
            console.error('Error accepting connection:', error);
            
            // Even on error, try to proceed with the UI flow
            return res.status(500).json({ 
                success: false, 
                message: 'Error accepting connection',
                error: error.message
            });
        }
    }

    async rejectConnection(req, res) {
        try {
            const currentUserId = req.session.userId;
            const requestUserId = req.params.userId;
            const reason = req.body.reason || 'unspecified';
            
            console.log(`Rejecting connection: ${currentUserId} rejecting ${requestUserId}, reason: ${reason}`);
            
            // Get current user
            const currentUser = await this.userModel.findById(currentUserId);
            if (!currentUser) {
                return res.status(404).json({ success: false, error: 'User not found' });
            }
            
            // Initialize connections if it doesn't exist
            if (!currentUser.connections) {
                currentUser.connections = { sentRequests: [], receivedRequests: [], connected: [] };
            }
            
            // Find the request in received requests
            const requestIndex = currentUser.connections.receivedRequests.findIndex(
                req => req.from.toString() === requestUserId.toString()
            );
            
            if (requestIndex === -1) {
                return res.status(400).json({ success: false, error: 'Connection request not found' });
            }
            
            // Remove from pending requests
            currentUser.connections.receivedRequests.splice(requestIndex, 1);
            
            // Add to rejected users list
            if (!currentUser.rejectedUsers) {
                currentUser.rejectedUsers = [];
            }
            
            // Check if already rejected
            const alreadyRejected = currentUser.rejectedUsers.some(
                r => r.user.toString() === requestUserId.toString()
            );
            
            if (!alreadyRejected) {
                currentUser.rejectedUsers.push({
                    user: requestUserId,
                    rejectedAt: new Date(),
                    reason: reason
                });
            }
            
            // Save current user
            await currentUser.save();
            
            // Optionally, remove from the other user's sent requests
            const requestUser = await this.userModel.findById(requestUserId);
            if (requestUser && requestUser.connections && requestUser.connections.sentRequests) {
                const sentRequestIndex = requestUser.connections.sentRequests.findIndex(
                    req => req.to.toString() === currentUserId.toString()
                );
                
                if (sentRequestIndex !== -1) {
                    requestUser.connections.sentRequests.splice(sentRequestIndex, 1);
                    await requestUser.save();
                }
            }
            
            // For AJAX requests
            if (req.xhr) {
                return res.status(200).json({ success: true });
            }
            
            // For regular form submissions
            res.redirect('/connections?success=request_rejected');
        } catch (error) {
            console.error("Error rejecting connection:", error);
            
            if (req.xhr) {
                return res.status(500).json({ success: false, error: 'Server error' });
            }
            
            res.redirect('/connections?error=reject_failed');
        }
    }

    async removeConnection(req, res) {
        try {
            const currentUserId = req.session.userId;
            const connectionUserId = req.params.userId;
            
            // Get both users
            const [currentUser, connectionUser] = await Promise.all([
                this.userModel.findById(currentUserId),
                this.userModel.findById(connectionUserId)
            ]);
            
            if (!currentUser) {
                return res.status(404).json({ success: false, error: 'User not found' });
            }
            
            // Remove from current user's connections
            if (currentUser.connections && currentUser.connections.connected) {
                const connectionIndex = currentUser.connections.connected.findIndex(
                    conn => conn.user.toString() === connectionUserId.toString()
                );
                
                if (connectionIndex !== -1) {
                    currentUser.connections.connected.splice(connectionIndex, 1);
                    await currentUser.save();
                }
            }
            
            // Remove from connection user's connections
            if (connectionUser && connectionUser.connections && connectionUser.connections.connected) {
                const connectionIndex = connectionUser.connections.connected.findIndex(
                    conn => conn.user.toString() === currentUserId.toString()
                );
                
                if (connectionIndex !== -1) {
                    connectionUser.connections.connected.splice(connectionIndex, 1);
                    await connectionUser.save();
                }
            }
            
            return res.status(200).json({ success: true });
        } catch (error) {
            console.error("Error removing connection:", error);
            return res.status(500).json({ success: false, error: 'Server error' });
        }
    }

    async getUnreadMessagesCount(req, res) {
        try {
            const userId = req.session.userId;
            const user = await this.userModel.findById(userId);
            
            if (!user) {
                return res.status(404).json({ success: false, error: 'User not found' });
            }
            
            // Count unread messages across all conversations
            let unreadCount = 0;
            
            if (user.conversations) {
                user.conversations.forEach(conv => {
                    if (conv.messages) {
                        unreadCount += conv.messages.filter(msg => 
                            msg.sender !== userId && !msg.read
                        ).length;
                    }
                });
            }
            
            return res.status(200).json({ success: true, count: unreadCount });
        } catch (error) {
            console.error("Error getting unread count:", error);
            return res.status(500).json({ success: false, error: 'Server error' });
        }
    }

    // Helper method to create notifications
    async createNotification(userId, notificationData) {
        try {
            await this.userModel.updateOne(
                { _id: userId },
                { $push: { notifications: notificationData } }
            );
            return true;
        } catch (error) {
            console.error('Error creating notification:', error);
            return false;
        }
    }

    // Helper method to find conversation
    findConversation(user, otherUserId) {
        if (!user.conversations) return null;
        
        return user.conversations.find(conv => 
            conv.participants && conv.participants.includes(otherUserId.toString())
        );
    }

    // Helper method to initialize conversation
    async initializeConversation(user1Id, user2Id, matchData) {
        try {
            const [user1, user2] = await Promise.all([
                this.userModel.findById(user1Id),
                this.userModel.findById(user2Id)
            ]);
            
            if (!user1 || !user2) return false;
            
            // Create welcome message with personalized suggestion based on match
            let welcomeMessage = "You are now connected! Start a conversation.";
            
            // Add personalized starter if common interests exist
            if (matchData && matchData.commonInterests) {
                const commonInterests = matchData.commonInterests;
                if (commonInterests.classes && commonInterests.classes.length > 0) {
                    welcomeMessage = `You are now connected! You both are taking ${commonInterests.classes[0]}. Maybe you could discuss that?`;
                } else if (commonInterests.hobbies && commonInterests.hobbies.length > 0) {
                    welcomeMessage = `You are now connected! You both enjoy ${commonInterests.hobbies[0]}. Why not start a conversation about that?`;
                }
            }
            
            // Initialize conversation for user1
            if (!user1.conversations) user1.conversations = [];
            
            // Check if conversation already exists
            const existingConv1 = user1.conversations.find(conv => 
                conv.participants && conv.participants.includes(user2Id.toString())
            );
            
            if (!existingConv1) {
                user1.conversations.push({
                    participants: [user1Id.toString(), user2Id.toString()],
                    messages: [{
                        sender: 'system',
                        content: welcomeMessage,
                        timestamp: new Date()
                    }],
                    createdAt: new Date(),
                    lastUpdated: new Date(),
                    matchScore: matchData?.score || 0
                });
                
                await user1.save();
            }
            
            // Initialize conversation for user2
            if (!user2.conversations) user2.conversations = [];
            
            const existingConv2 = user2.conversations.find(conv => 
                conv.participants && conv.participants.includes(user1Id.toString())
            );
            
            if (!existingConv2) {
                user2.conversations.push({
                    participants: [user2Id.toString(), user1Id.toString()],
                    messages: [{
                        sender: 'system',
                        content: welcomeMessage,
                        timestamp: new Date()
                    }],
                    createdAt: new Date(),
                    lastUpdated: new Date(),
                    matchScore: matchData?.score || 0
                });
                
                await user2.save();
            }
            
            return true;
        } catch (error) {
            console.error('Error initializing conversation:', error);
            return false;
        }
    }
}

// Export an instance of the controller class
module.exports = new ConnectionController();