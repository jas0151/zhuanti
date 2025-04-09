const UserModel = require("./userModel");
const mongoose = require("mongoose");

class ImprovedConnectionController {
    constructor() {
        this.userModel = UserModel.getModel();
    }

    // Main method to get connections with better organization and performance
    async getConnections(req, res) {
        try {
            const userId = req.session.userId;
            
            // More efficient query with projection to get only what we need
            const user = await this.userModel.findById(userId, {
                'connections.sentRequests': 1,
                'connections.receivedRequests': 1,
                'connections.connected': 1
            });
            
            if (!user) {
                return res.redirect('/login');
            }

            // Initialize connections object if not present
            if (!user.connections) {
                user.connections = {
                    sentRequests: [],
                    receivedRequests: [],
                    connected: []
                };
                await user.save();
            }
            
            // Get all user IDs that we need to fetch in one batch
            const allUserIds = [
                ...user.connections.receivedRequests.map(req => req.from),
                ...user.connections.sentRequests.map(req => req.to),
                ...user.connections.connected.map(conn => conn.user)
            ];
            
            // Fetch all users in a single query for better performance
            const connectedUsers = await this.userModel.find(
                { _id: { $in: allUserIds } },
                { 
                    'profile.firstName': 1,
                    'profile.lastName': 1,
                    'profile.university': 1,
                    'profile.major': 1,
                    'profile.yearOfStudy': 1,
                    'profile.photo': 1,
                    'lastActive': 1
                }
            );
            
            // Create a map of user IDs to user objects for fast lookups
            const userMap = connectedUsers.reduce((map, user) => {
                map[user._id.toString()] = user;
                return map;
            }, {});
            
            // Efficiently organize connection data
            const pendingRequests = user.connections.receivedRequests.map(request => {
                const requestUser = userMap[request.from.toString()];
                return requestUser ? {
                    user: requestUser,
                    connectionData: request,
                    timeAgo: this.getTimeAgo(request.requestedAt)
                } : null;
            }).filter(Boolean);
            
            const connectionRequests = user.connections.sentRequests.map(request => {
                const requestUser = userMap[request.to.toString()];
                return requestUser ? {
                    user: requestUser,
                    connectionData: request,
                    timeAgo: this.getTimeAgo(request.requestedAt)
                } : null;
            }).filter(Boolean);
            
            const acceptedConnections = user.connections.connected.map(connection => {
                const connectedUser = userMap[connection.user.toString()];
                return connectedUser ? {
                    user: connectedUser,
                    connectionData: connection,
                    timeAgo: this.getTimeAgo(connection.updatedAt),
                    isOnline: this.isUserOnline(connectedUser),
                    lastSeenText: this.getLastSeenText(connectedUser)
                } : null;
            }).filter(Boolean);
            
            // Sort connections by most recent activity
            acceptedConnections.sort((a, b) => 
                new Date(b.connectionData.updatedAt) - new Date(a.connectionData.updatedAt)
            );
            
            // Fetch recent conversations for each connection
            await this.enrichWithConversationData(acceptedConnections, userId);
            
            // Render with organized data
            res.render('connections', {
                pendingRequests,
                connectionRequests,
                acceptedConnections,
                success: req.query.success,
                error: req.query.error,
                // Add additional statistics
                stats: {
                    totalConnections: acceptedConnections.length,
                    pendingCount: pendingRequests.length,
                    sentCount: connectionRequests.length
                }
            });
        } catch (error) {
            console.error("Error loading connections:", error);
            res.redirect('/main?error=connections_error');
        }
    }
    
    // Add conversation data to connections
    async enrichWithConversationData(connections, userId) {
        try {
            const user = await this.userModel.findById(userId, { 'conversations': 1 });
            
            if (!user || !user.conversations) return;
            
            for (const connection of connections) {
                const connUserId = connection.user._id.toString();
                const conversation = user.conversations.find(c => 
                    c.participants.includes(connUserId)
                );
                
                if (conversation && conversation.messages && conversation.messages.length > 0) {
                    // Get last message
                    const lastMessage = conversation.messages[conversation.messages.length - 1];
                    
                    connection.lastMessage = {
                        content: this.truncateMessage(lastMessage.content),
                        timestamp: lastMessage.timestamp,
                        isFromUser: lastMessage.sender.toString() === userId,
                        timeAgo: this.getTimeAgo(lastMessage.timestamp)
                    };
                    
                    // Count unread messages
                    const unreadCount = conversation.messages.filter(msg => 
                        msg.sender.toString() === connUserId && !msg.read
                    ).length;
                    
                    connection.unreadCount = unreadCount;
                    connection.hasUnread = unreadCount > 0;
                } else {
                    connection.lastMessage = null;
                    connection.unreadCount = 0;
                    connection.hasUnread = false;
                }
            }
        } catch (error) {
            console.error("Error enriching with conversation data:", error);
        }
    }
    
    // Truncate message to a reasonable length
    truncateMessage(message) {
        if (!message) return "";
        return message.length > 30 ? message.substring(0, 27) + '...' : message;
    }
    
    // Check if user is online (active in last 5 minutes)
    isUserOnline(user) {
        if (!user.lastActive) return false;
        const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
        return new Date(user.lastActive) > fiveMinutesAgo;
    }
    
    // Format last seen text
    getLastSeenText(user) {
        if (!user.lastActive) return "Never";
        return this.getTimeAgo(user.lastActive);
    }
    
    // Format time ago
    getTimeAgo(date) {
        if (!date) return "Unknown";
        
        const now = new Date();
        const diff = now - new Date(date);
        
        // Convert to appropriate units
        const seconds = Math.floor(diff / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);
        const days = Math.floor(hours / 24);
        
        if (days > 0) {
            return days === 1 ? "1 day ago" : `${days} days ago`;
        } else if (hours > 0) {
            return hours === 1 ? "1 hour ago" : `${hours} hours ago`;
        } else if (minutes > 0) {
            return minutes === 1 ? "1 minute ago" : `${minutes} minutes ago`;
        } else {
            return "Just now";
        }
    }
    
    // Enhanced accept connection with transaction and better notification
    async acceptConnection(req, res) {
        try {
            const currentUserId = req.session.userId;
            const requestUserId = req.params.userId;
            
            // Use transactions for data consistency
            const session = await mongoose.startSession();
            session.startTransaction();
            
            try {
                // Find both users within the transaction
                const [currentUser, requestUser] = await Promise.all([
                    this.userModel.findById(currentUserId).session(session),
                    this.userModel.findById(requestUserId).session(session)
                ]);
                
                if (!currentUser || !requestUser) {
                    await session.abortTransaction();
                    session.endSession();
                    return res.status(404).json({ success: false, error: 'User not found' });
                }
                
                // Initialize connections if they don't exist
                if (!currentUser.connections) {
                    currentUser.connections = { sentRequests: [], receivedRequests: [], connected: [] };
                }
                
                if (!requestUser.connections) {
                    requestUser.connections = { sentRequests: [], receivedRequests: [], connected: [] };
                }
                
                // Find the request in received requests
                const requestIndex = currentUser.connections.receivedRequests.findIndex(
                    req => req.from.toString() === requestUserId.toString()
                );
                
                if (requestIndex === -1) {
                    await session.abortTransaction();
                    session.endSession();
                    return res.status(400).json({ success: false, error: 'Connection request not found' });
                }
                
                // Remove from pending requests
                currentUser.connections.receivedRequests.splice(requestIndex, 1);
                
                // Find and remove from sender's sent requests
                const sentRequestIndex = requestUser.connections.sentRequests.findIndex(
                    req => req.to.toString() === currentUserId.toString()
                );
                
                if (sentRequestIndex !== -1) {
                    requestUser.connections.sentRequests.splice(sentRequestIndex, 1);
                }
                
                // Add to both users' connected lists
                const now = new Date();
                
                currentUser.connections.connected.push({
                    user: requestUserId,
                    connectedAt: now,
                    updatedAt: now
                });
                
                requestUser.connections.connected.push({
                    user: currentUserId,
                    connectedAt: now,
                    updatedAt: now
                });
                
                // Create welcome message for the chat
                if (!currentUser.conversations) {
                    currentUser.conversations = [];
                }
                
                if (!requestUser.conversations) {
                    requestUser.conversations = [];
                }
                
                // Create a new conversation or update existing one
                let userConversation = currentUser.conversations.find(conv => 
                    conv.participants.includes(requestUserId.toString())
                );
                
                let requestUserConversation = requestUser.conversations.find(conv => 
                    conv.participants.includes(currentUserId.toString())
                );
                
                // System welcome message
                const welcomeMessage = {
                    content: "You are now connected! Say hello to start the conversation.",
                    timestamp: now,
                    sender: 'system'
                };
                
                if (!userConversation) {
                    userConversation = {
                        participants: [currentUserId.toString(), requestUserId.toString()],
                        messages: [welcomeMessage],
                        createdAt: now,
                        lastUpdated: now
                    };
                    currentUser.conversations.push(userConversation);
                } else {
                    userConversation.messages.push(welcomeMessage);
                    userConversation.lastUpdated = now;
                }
                
                if (!requestUserConversation) {
                    requestUserConversation = {
                        participants: [requestUserId.toString(), currentUserId.toString()],
                        messages: [welcomeMessage],
                        createdAt: now,
                        lastUpdated: now
                    };
                    requestUser.conversations.push(requestUserConversation);
                } else {
                    requestUserConversation.messages.push(welcomeMessage);
                    requestUserConversation.lastUpdated = now;
                }
                
                // Update match score for both users
                await this.updateMatchScores(currentUser, requestUser, session);
                
                // Save both users
                await Promise.all([
                    currentUser.save({ session }),
                    requestUser.save({ session })
                ]);
                
                // Commit transaction
                await session.commitTransaction();
                session.endSession();
                
                // Get user details for notification
                const otherUserName = `${requestUser.profile.firstName} ${requestUser.profile.lastName}`;
                
                // For AJAX requests
                if (req.xhr) {
                    return res.status(200).json({ 
                        success: true, 
                        userName: otherUserName,
                        userId: requestUserId,
                        message: `You are now connected with ${otherUserName}!` 
                    });
                }
                
                // For regular form submissions
                res.redirect('/connections?success=request_accepted&name=' + encodeURIComponent(otherUserName));
            } catch (error) {
                // If an error occurred, abort the transaction
                await session.abortTransaction();
                session.endSession();
                throw error;
            }
        } catch (error) {
            console.error("Error accepting connection:", error);
            
            if (req.xhr) {
                return res.status(500).json({ success: false, error: 'Server error' });
            }
            
            res.redirect('/connections?error=accept_failed');
        }
    }
    
    // Update match scores when users connect
    async updateMatchScores(user1, user2, session) {
        // Calculate new match score
        try {
            const matchController = require('./matchController');
            const matchData = matchController.calculateMatchScore(user1, user2);
            
            // Update user1's match scores
            const user1ScoreIndex = user1.matchScores?.findIndex(
                score => score.user.toString() === user2._id.toString()
            );
            
            if (user1ScoreIndex >= 0 && user1.matchScores) {
                user1.matchScores[user1ScoreIndex].score = matchData.score;
                user1.matchScores[user1ScoreIndex].lastCalculated = new Date();
            } else {
                if (!user1.matchScores) user1.matchScores = [];
                user1.matchScores.push({
                    user: user2._id,
                    score: matchData.score,
                    lastCalculated: new Date()
                });
            }
            
            // Update user2's match scores
            const user2ScoreIndex = user2.matchScores?.findIndex(
                score => score.user.toString() === user1._id.toString()
            );
            
            if (user2ScoreIndex >= 0 && user2.matchScores) {
                user2.matchScores[user2ScoreIndex].score = matchData.score;
                user2.matchScores[user2ScoreIndex].lastCalculated = new Date();
            } else {
                if (!user2.matchScores) user2.matchScores = [];
                user2.matchScores.push({
                    user: user1._id,
                    score: matchData.score,
                    lastCalculated: new Date()
                });
            }
        } catch (error) {
            console.error("Error updating match scores:", error);
            // Don't throw, as this is a non-critical operation
        }
    }
    
    // Get user's compatibility score with all connections
    async getUserCompatibilityStats(userId) {
        try {
            const user = await this.userModel.findById(userId, {
                'connections.connected': 1,
                'matchScores': 1
            });
            
            if (!user || !user.connections || !user.connections.connected) {
                return {
                    averageScore: 0,
                    highestMatch: 0,
                    connectionCount: 0,
                    topInterests: []
                };
            }
            
            // Get connected user IDs
            const connectedUserIds = user.connections.connected.map(conn => conn.user.toString());
            
            // Get scores for connected users
            const connectionScores = user.matchScores?.filter(score => 
                connectedUserIds.includes(score.user.toString())
            ) || [];
            
            // Calculate average score
            const totalScore = connectionScores.reduce((sum, score) => sum + score.score, 0);
            const averageScore = connectionScores.length > 0 
                ? Math.round(totalScore / connectionScores.length) 
                : 0;
            
            // Find highest match
            const highestMatch = connectionScores.length > 0
                ? Math.max(...connectionScores.map(score => score.score))
                : 0;
            
            // Find most common interests among connections
            const connectedUsers = await this.userModel.find(
                { _id: { $in: connectedUserIds } },
                { 'profile.interests': 1 }
            );
            
            // Build interest frequency map
            const interestFrequency = {};
            for (const connUser of connectedUsers) {
                if (!connUser.profile?.interests) continue;
                
                // Process each interest category
                ['hobbies', 'classes', 'clubs', 'languages'].forEach(category => {
                    const interests = connUser.profile.interests[category] || [];
                    interests.forEach(interest => {
                        if (!interestFrequency[interest]) {
                            interestFrequency[interest] = { 
                                name: interest, 
                                count: 0, 
                                category 
                            };
                        }
                        interestFrequency[interest].count++;
                    });
                });
            }
            
            // Convert to array and sort by frequency
            const sortedInterests = Object.values(interestFrequency)
                .sort((a, b) => b.count - a.count)
                .slice(0, 5); // Top 5 interests
            
            return {
                averageScore,
                highestMatch,
                connectionCount: connectedUserIds.length,
                topInterests: sortedInterests
            };
        } catch (error) {
            console.error("Error getting user compatibility stats:", error);
            return {
                averageScore: 0,
                highestMatch: 0,
                connectionCount: 0,
                topInterests: []
            };
        }
    }
    
    // Get recommended connections (people you might know)
    async getRecommendedConnections(userId, limit = 3) {
        try {
            const user = await this.userModel.findById(userId, {
                'connections.connected': 1,
                'connections.sentRequests': 1,
                'connections.receivedRequests': 1,
                'profile.university': 1,
                'profile.interests': 1
            });
            
            if (!user) return [];
            
            // Already connected or requested users
            const connectedIds = new Set([
                ...user.connections?.connected.map(c => c.user.toString()) || [],
                ...user.connections?.sentRequests.map(r => r.to.toString()) || [],
                ...user.connections?.receivedRequests.map(r => r.from.toString()) || []
            ]);
            
            // Get connections of connections
            const connections = await this.userModel.find(
                { _id: { $in: [...user.connections?.connected.map(c => c.user)] } },
                { 'connections.connected': 1 }
            );
            
            // Get friends of friends
            const potentialConnections = new Map();
            for (const connection of connections) {
                if (!connection.connections?.connected) continue;
                
                for (const friendOfFriend of connection.connections.connected) {
                    const fofId = friendOfFriend.user.toString();
                    
                    // Skip self and already connected
                    if (fofId === userId || connectedIds.has(fofId)) continue;
                    
                    if (!potentialConnections.has(fofId)) {
                        potentialConnections.set(fofId, { 
                            id: fofId, 
                            sharedConnections: 0,
                            score: 0
                        });
                    }
                    
                    const potential = potentialConnections.get(fofId);
                    potential.sharedConnections++;
                    potential.score += 10; // Each shared connection adds 10 points
                }
            }
            
            // Add users from same university
            if (user.profile?.university) {
                const sameUniversityUsers = await this.userModel.find(
                    { 
                        _id: { $ne: userId },
                        'profile.university': user.profile.university,
                        _id: { $nin: [...connectedIds] }
                    },
                    { 
                        'profile.firstName': 1,
                        'profile.lastName': 1,
                        'profile.university': 1,
                        'profile.interests': 1
                    }
                ).limit(20);
                
                for (const uniUser of sameUniversityUsers) {
                    const uniUserId = uniUser._id.toString();
                    
                    if (!potentialConnections.has(uniUserId)) {
                        potentialConnections.set(uniUserId, { 
                            id: uniUserId, 
                            sharedConnections: 0,
                            score: 5 // Same university adds 5 points
                        });
                    }
                    
                    // Add score for shared interests
                    if (user.profile?.interests && uniUser.profile?.interests) {
                        const sharedInterests = this.countSharedInterests(
                            user.profile.interests, 
                            uniUser.profile.interests
                        );
                        
                        const potential = potentialConnections.get(uniUserId);
                        potential.score += sharedInterests * 2; // Each shared interest adds 2 points
                    }
                }
            }
            
            // Convert to array and sort by score
            const recommendations = Array.from(potentialConnections.values())
                .sort((a, b) => b.score - a.score)
                .slice(0, limit);
            
            // Fetch full user objects for recommendations
            const recommendedUsers = await this.userModel.find(
                { _id: { $in: recommendations.map(r => r.id) } },
                {
                    'profile.firstName': 1,
                    'profile.lastName': 1,
                    'profile.university': 1,
                    'profile.major': 1,
                    'profile.yearOfStudy': 1,
                    'profile.photo': 1,
                    'profile.interests': 1
                }
            );
            
            // Add score and shared connections data
            return recommendedUsers.map(user => {
                const recommendation = recommendations.find(r => r.id === user._id.toString());
                return {
                    user,
                    score: recommendation.score,
                    sharedConnections: recommendation.sharedConnections
                };
            });
        } catch (error) {
            console.error("Error getting recommended connections:", error);
            return [];
        }
    }
    
    // Count shared interests between two users
    countSharedInterests(interests1, interests2) {
        if (!interests1 || !interests2) return 0;
        
        let sharedCount = 0;
        
        // Process each interest category
        ['hobbies', 'classes', 'clubs', 'languages'].forEach(category => {
            const userInterests = interests1[category] || [];
            const otherInterests = interests2[category] || [];
            
            // Count matching interests
            userInterests.forEach(interest => {
                if (otherInterests.includes(interest)) {
                    sharedCount++;
                }
            });
        });
        
        return sharedCount;
    }
    
    // Get connection statistics for dashboard
    async getConnectionStats(userId) {
        try {
            const user = await this.userModel.findById(userId, {
                'connections.connected': 1,
                'connections.sentRequests': 1,
                'connections.receivedRequests': 1,
                'conversations': 1
            });
            
            if (!user) return null;
            
            // Initialize connections if they don't exist
            if (!user.connections) {
                return {
                    total: 0,
                    pending: 0,
                    sent: 0,
                    unreadMessages: 0,
                    activeChats: 0,
                    connectionRate: 0
                };
            }
            
            // Calculate statistics
            const connected = user.connections.connected || [];
            const received = user.connections.receivedRequests || [];
            const sent = user.connections.sentRequests || [];
            
            // Count unread messages
            let unreadMessages = 0;
            let activeChats = 0;
            
            if (user.conversations) {
                // Active chats (had activity in last 7 days)
                const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
                
                user.conversations.forEach(conversation => {
                    if (!conversation.messages || conversation.messages.length === 0) return;
                    
                    // Count unread messages
                    unreadMessages += conversation.messages.filter(msg => 
                        !msg.read && msg.sender.toString() !== userId
                    ).length;
                    
                    // Check if active recently
                    const lastMessage = conversation.messages[conversation.messages.length - 1];
                    if (lastMessage && new Date(lastMessage.timestamp) > oneWeekAgo) {
                        activeChats++;
                    }
                });
            }
            
            // Calculate connection acceptance rate
            const totalRequests = sent.length + connected.length;
            const connectionRate = totalRequests > 0 
                ? Math.round((connected.length / totalRequests) * 100) 
                : 0;
            
            return {
                total: connected.length,
                pending: received.length,
                sent: sent.length,
                unreadMessages,
                activeChats,
                connectionRate
            };
        } catch (error) {
            console.error("Error getting connection stats:", error);
            return null;
        }
    }
}

module.exports = new ImprovedConnectionController();