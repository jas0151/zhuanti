const UserModel = require("./userModel");

class ChatController {
    constructor() {
        this.userModel = UserModel.getModel();
    }

    async getChat(req, res) {
        try {
            const currentUserId = req.session.userId;
            const otherUserId = req.params.userId;
            
            // Get both users
            const [currentUser, otherUser] = await Promise.all([
                this.userModel.findById(currentUserId),
                this.userModel.findById(otherUserId)
            ]);
            
            if (!currentUser || !otherUser) {
                return res.redirect('/connections?error=user_not_found');
            }
            
            // Check if they are connected
            if (!this.areConnected(currentUser, otherUserId)) {
                return res.redirect('/connections?error=not_connected');
            }
            
            // Get or create conversation
            let conversation = await this.getConversation(currentUserId, otherUserId);
            
            // If conversation doesn't exist, create a new one
            if (!conversation) {
                conversation = {
                    participants: [currentUserId, otherUserId],
                    messages: [],
                    createdAt: new Date(),
                    lastUpdated: new Date()
                };
                
                // Initialize conversations array if it doesn't exist
                if (!currentUser.conversations) {
                    currentUser.conversations = [];
                }
                
                // Add conversation to user
                currentUser.conversations.push(conversation);
                await currentUser.save();
            }
            
            res.render('chat', {
                currentUser,
                otherUser,
                conversation
            });
        } catch (error) {
            console.error("Error loading chat:", error);
            res.redirect('/connections?error=chat_error');
        }
    }

    async sendMessage(req, res) {
        try {
            const currentUserId = req.session.userId;
            const recipientId = req.params.userId;
            const messageContent = req.body.message;
            
            if (!messageContent || messageContent.trim() === '') {
                if (req.xhr) {
                    return res.status(400).json({ success: false, error: 'Message cannot be empty' });
                }
                return res.redirect(`/chat/${recipientId}?error=empty_message`);
            }
            
            // Get current user
            const currentUser = await this.userModel.findById(currentUserId);
            if (!currentUser) {
                if (req.xhr) {
                    return res.status(404).json({ success: false, error: 'User not found' });
                }
                return res.redirect('/login');
            }
            
            // Check if they are connected
            if (!this.areConnected(currentUser, recipientId)) {
                if (req.xhr) {
                    return res.status(400).json({ success: false, error: 'Not connected with this user' });
                }
                return res.redirect('/connections?error=not_connected');
            }
            
            // Get or create conversation
            let conversation = await this.getConversation(currentUserId, recipientId);
            
            // If conversation doesn't exist, create a new one
            if (!conversation) {
                if (!currentUser.conversations) {
                    currentUser.conversations = [];
                }
                
                conversation = {
                    participants: [currentUserId, recipientId],
                    messages: [],
                    createdAt: new Date(),
                    lastUpdated: new Date()
                };
                
                currentUser.conversations.push(conversation);
            }
            
            // Add message to conversation
            const newMessage = {
                sender: currentUserId,
                content: messageContent,
                timestamp: new Date()
            };
            
            conversation.messages.push(newMessage);
            conversation.lastUpdated = new Date();
            
            await currentUser.save();
            
            // If recipient exists, update their conversation too
            const recipient = await this.userModel.findById(recipientId);
            if (recipient) {
                let recipientConversation = await this.getConversation(recipientId, currentUserId);
                
                if (!recipientConversation) {
                    if (!recipient.conversations) {
                        recipient.conversations = [];
                    }
                    
                    recipientConversation = {
                        participants: [recipientId, currentUserId],
                        messages: [],
                        createdAt: new Date(),
                        lastUpdated: new Date()
                    };
                    
                    recipient.conversations.push(recipientConversation);
                }
                
                // Add same message to recipient's conversation
                recipientConversation.messages.push(newMessage);
                recipientConversation.lastUpdated = new Date();
                
                await recipient.save();
            }
            
            // For AJAX requests
            if (req.xhr) {
                return res.status(200).json({ success: true, message: newMessage });
            }
            
            // For regular form submissions
            res.redirect(`/chat/${recipientId}`);
        } catch (error) {
            console.error("Error sending message:", error);
            
            if (req.xhr) {
                return res.status(500).json({ success: false, error: 'Server error' });
            }
            
            res.redirect(`/chat/${req.params.userId}?error=send_failed`);
        }
    }

    async getMessages(req, res) {
        try {
            const currentUserId = req.session.userId;
            const otherUserId = req.params.userId;
            
            // Get current user
            const currentUser = await this.userModel.findById(currentUserId);
            if (!currentUser) {
                return res.status(404).json({ success: false, error: 'User not found' });
            }
            
            // Get conversation
            const conversation = await this.getConversation(currentUserId, otherUserId);
            
            if (!conversation) {
                return res.status(200).json({ 
                    messages: [],
                    lastUpdated: new Date()
                });
            }
            
            return res.status(200).json({
                messages: conversation.messages || [],
                lastUpdated: conversation.lastUpdated || new Date()
            });
        } catch (error) {
            console.error("Error getting messages:", error);
            return res.status(500).json({ success: false, error: 'Server error' });
        }
    }

    // Helper function to check if users are connected
    areConnected(user, otherUserId) {
        if (!user.connections || !user.connections.connected) {
            return false;
        }
        
        return user.connections.connected.some(conn => 
            conn.user.toString() === otherUserId.toString()
        );
    }

    // Helper function to get conversation between two users
    async getConversation(userId1, userId2) {
        const user = await this.userModel.findById(userId1);
        
        if (!user || !user.conversations) {
            return null;
        }
        
        // Find conversation with both participants
        return user.conversations.find(conv => 
            conv.participants.includes(userId2.toString())
        );
    }
}

module.exports = new ChatController();