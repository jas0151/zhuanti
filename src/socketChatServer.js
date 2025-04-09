// Improved socketChatServer.js with enhanced real-time functionality

const mongoose = require("mongoose");
const UserModel = require("./userModel");

class SocketChatServer {
    constructor(httpServer) {
        this.io = require('socket.io')(httpServer, {
            // Socket.IO configuration for better reliability
            pingTimeout: 60000,
            pingInterval: 25000,
            cors: {
                origin: "*",
                methods: ["GET", "POST"]
            },
            transports: ['websocket', 'polling']
        });
        
        // Fix: Use UserModel.getModel() instead of directly accessing mongoose model
        this.userModel = UserModel.getModel();
        this.userSockets = new Map(); // Map to track user-socket associations
        
        console.log('Socket.io chat server initialized with enhanced configuration');
        
        // Initialize immediately (we'll apply middleware later if needed)
        this.initialize();
    }
    
    // Method to set session middleware
    setSessionMiddleware(sessionMiddleware) {
        // Share session data with Socket.io
        this.io.use((socket, next) => {
            sessionMiddleware(socket.request, socket.request.res || {}, next);
        });
    }
    
    initialize() {
        this.io.on('connection', (socket) => {
            console.log('New socket connection:', socket.id);
            
            // Get session user ID
            const session = socket.request.session;
            const sessionUserId = session && session.userId ? session.userId.toString() : null;
            
            console.log(`Socket connected with session user ID: ${sessionUserId || 'none'}`);
            
            // Store user information
            let currentUserId = sessionUserId;
            let currentRooms = new Set(); // Track all rooms joined by this socket
            
            // Associate socket with user ID if available
            if (currentUserId) {
                // Add this socket to the user's socket list
                if (!this.userSockets.has(currentUserId)) {
                    this.userSockets.set(currentUserId, new Set());
                }
                this.userSockets.get(currentUserId).add(socket.id);
                
                // Update user online status
                this.updateUserStatus(currentUserId, true);
                
                // Notify other users who might be chatting with this user
                this.notifyUserOnline(currentUserId);
            }
            
            // Handle joining a chat room
            socket.on('join chat', async (data) => {
                try {
                    // Use session user ID if available, fallback to data
                    const userId = sessionUserId || data.userId;
                    const otherUserId = data.otherUserId;
                    
                    // Update current user ID if not set
                    if (!currentUserId && userId) {
                        currentUserId = userId;
                        
                        // Associate socket with user ID
                        if (!this.userSockets.has(currentUserId)) {
                            this.userSockets.set(currentUserId, new Set());
                        }
                        this.userSockets.get(currentUserId).add(socket.id);
                        
                        // Update user online status
                        this.updateUserStatus(currentUserId, true);
                    }
                    
                    if (!userId || !otherUserId) {
                        console.log('Invalid join chat data:', data);
                        return;
                    }
                    
                    console.log(`User ${userId} joining chat with ${otherUserId}`);
                    
                    // Create a unique room name by sorting and joining user IDs
                    const roomName = [userId, otherUserId].sort().join('-');
                    
                    // Join the room
                    socket.join(roomName);
                    currentRooms.add(roomName);
                    
                    console.log(`User ${userId} joined room: ${roomName}`);
                    
                    // Send update to the other user if they're online
                    this.sendUserStatusUpdate(userId, otherUserId);
                    
                    // Automatically acknowledge joining the room
                    socket.emit('chat joined', {
                        success: true,
                        room: roomName,
                        userId: userId,
                        otherUserId: otherUserId
                    });
                    
                    // Send any pending messages if they exist
                    this.sendPendingMessages(userId, otherUserId, socket);
                } catch (error) {
                    console.error('Error in join chat:', error);
                    socket.emit('error', {
                        type: 'join_chat_error',
                        message: 'Failed to join chat room',
                        error: error.message
                    });
                }
            });
            
            // Handle sending messages
            socket.on('send message', async (data) => {
                try {
                    // Use session user ID if available, fallback to data
                    const sender = sessionUserId || data.sender;
                    const receiver = data.receiver;
                    const content = data.content;
                    const timestamp = data.timestamp || new Date();
                    const messageId = data.messageId || new mongoose.Types.ObjectId();
                    
                    if (!sender || !receiver || !content) {
                        console.log('Invalid message data:', data);
                        socket.emit('message error', {
                            error: 'Invalid message data',
                            originalMessage: data
                        });
                        return;
                    }
                    
                    console.log(`Message from ${sender} to ${receiver}: ${content}`);
                    
                    // Create room name
                    const roomName = [sender, receiver].sort().join('-');
                    
                    // Process the message (save to database)
                    const savedMessage = await this.saveMessage(
                        sender, 
                        receiver, 
                        content, 
                        timestamp, 
                        messageId
                    );
                    
                    if (!savedMessage) {
                        throw new Error('Failed to save message to database');
                    }
                    
                    // Create response message object
                    const messageData = {
                        _id: messageId.toString(),
                        sender,
                        receiver,
                        content,
                        timestamp: timestamp,
                        status: 'sent',
                        delivered: true
                    };
                    
                    // Emit to the sender first to confirm message was sent
                    socket.emit('message sent', messageData);
                    
                    // Broadcast to everyone in the room
                    this.io.to(roomName).emit('message', messageData);
                    
                    // Check if the receiver is online and send delivery confirmation
                    this.notifyMessageDelivered(sender, receiver, messageId);
                } catch (error) {
                    console.error('Error in send message:', error);
                    
                    // Notify sender about error
                    socket.emit('message error', {
                        error: 'Failed to send message: ' + error.message,
                        originalMessage: data
                    });
                }
            });
            
            // Handle typing indicators
            socket.on('typing', (data) => {
                try {
                    // Use session user ID if available, fallback to data
                    const sender = sessionUserId || data.sender;
                    const receiver = data.receiver;
                    
                    if (!sender || !receiver) {
                        return;
                    }
                    
                    // Create room name
                    const roomName = [sender, receiver].sort().join('-');
                    
                    // Broadcast typing event to room (except sender)
                    socket.to(roomName).emit('typing', {
                        userId: sender
                    });
                } catch (error) {
                    console.error('Error in typing indicator:', error);
                }
            });
            
            // Handle stop typing
            socket.on('stop typing', (data) => {
                try {
                    // Use session user ID if available, fallback to data
                    const sender = sessionUserId || data.sender;
                    const receiver = data.receiver;
                    
                    if (!sender || !receiver) {
                        return;
                    }
                    
                    // Create room name
                    const roomName = [sender, receiver].sort().join('-');
                    
                    // Broadcast stop typing event to room (except sender)
                    socket.to(roomName).emit('stop typing', {
                        userId: sender
                    });
                } catch (error) {
                    console.error('Error in stop typing:', error);
                }
            });
            
            // Handle message seen notifications
            socket.on('message seen', async (data) => {
                try {
                    // Use session user ID if available, fallback to data
                    const reader = sessionUserId || data.sender;
                    const sender = data.receiver;
                    const messageId = data.messageId;
                    
                    if (!reader || !sender) {
                        return;
                    }
                    
                    console.log(`Message ${messageId} read by ${reader}`);
                    
                    // Mark message as read in database
                    await this.markMessageAsRead(reader, sender, messageId);
                    
                    // Create room name
                    const roomName = [reader, sender].sort().join('-');
                    
                    // Broadcast message seen event to room
                    this.io.to(roomName).emit('message seen', {
                        messageId,
                        reader: reader
                    });
                } catch (error) {
                    console.error('Error in message seen:', error);
                }
            });
            
            // Handle ping (to keep connection alive)
            socket.on('ping', (data) => {
                socket.emit('pong', { time: new Date() });
            });
            
            // Handle explicit reconnect requests
            socket.on('reconnect_attempt', (data) => {
                console.log(`Reconnect attempt from user ${currentUserId}`);
                
                if (currentUserId) {
                    // Rejoin all rooms
                    for (const room of currentRooms) {
                        socket.join(room);
                    }
                    
                    // Update status
                    this.updateUserStatus(currentUserId, true);
                    
                    // Notify other users
                    this.notifyUserOnline(currentUserId);
                    
                    socket.emit('reconnected', { 
                        success: true,
                        rooms: Array.from(currentRooms)
                    });
                }
            });
            
            // Handle disconnection
            socket.on('disconnect', async () => {
                console.log('Socket disconnected:', socket.id);
                
                try {
                    if (currentUserId) {
                        // Remove socket from user's socket list
                        const userSockets = this.userSockets.get(currentUserId);
                        if (userSockets) {
                            userSockets.delete(socket.id);
                            
                            // If no more sockets for this user, mark them as offline
                            if (userSockets.size === 0) {
                                this.userSockets.delete(currentUserId);
                                
                                // Update user's last active time and online status
                                this.updateUserStatus(currentUserId, false);
                                
                                // Notify other users
                                this.notifyUserOffline(currentUserId, Array.from(currentRooms));
                            }
                        }
                    }
                    
                    // Leave all rooms
                    for (const room of currentRooms) {
                        socket.leave(room);
                    }
                } catch (error) {
                    console.error('Error handling disconnect:', error);
                }
            });
        });
    }
    
    // Method to save message to database with retry
    async saveMessage(senderId, receiverId, content, timestamp, messageId, retries = 3) {
        try {
            // Generate message ID if not provided
            if (!messageId) {
                messageId = new mongoose.Types.ObjectId();
            }
            
            // Get sender
            const sender = await this.userModel.findById(senderId);
            if (!sender) {
                throw new Error('Sender not found');
            }
            
            // Get receiver
            const receiver = await this.userModel.findById(receiverId);
            if (!receiver) {
                throw new Error('Receiver not found');
            }
            
            // Create message
            const message = {
                _id: messageId,
                sender: senderId,
                content: content,
                timestamp: timestamp,
                delivered: false,
                read: false
            };
            
            // Add to sender's conversation
            let senderConversation = this.findConversation(sender, receiverId);
            
            if (!senderConversation) {
                // Create new conversation for sender
                if (!sender.conversations) {
                    sender.conversations = [];
                }
                
                senderConversation = {
                    participants: [senderId, receiverId],
                    messages: [],
                    createdAt: timestamp,
                    lastUpdated: timestamp
                };
                
                sender.conversations.push(senderConversation);
            }
            
            // Add message to sender's conversation
            senderConversation.messages.push(message);
            senderConversation.lastUpdated = timestamp;
            
            // Save sender
            await sender.save();
            
            // Add to receiver's conversation
            let receiverConversation = this.findConversation(receiver, senderId);
            
            if (!receiverConversation) {
                // Create new conversation for receiver
                if (!receiver.conversations) {
                    receiver.conversations = [];
                }
                
                receiverConversation = {
                    participants: [receiverId, senderId],
                    messages: [],
                    createdAt: timestamp,
                    lastUpdated: timestamp
                };
                
                receiver.conversations.push(receiverConversation);
            }
            
            // Add message to receiver's conversation
            receiverConversation.messages.push({...message});
            receiverConversation.lastUpdated = timestamp;
            
            // Save receiver
            await receiver.save();
            
            console.log(`Message saved to database: ${messageId}`);
            return true;
        } catch (error) {
            console.error('Error saving message:', error);
            
            // Retry if attempts remain
            if (retries > 0) {
                console.log(`Retrying message save (${retries} attempts left)...`);
                await new Promise(resolve => setTimeout(resolve, 500));
                return this.saveMessage(senderId, receiverId, content, timestamp, messageId, retries - 1);
            }
            
            return false;
        }
    }
    
    // Check for and send any pending messages
    async sendPendingMessages(userId, otherUserId, socket) {
        try {
            const user = await this.userModel.findById(userId);
            if (!user) return;
            
            // Find conversation with other user
            const conversation = this.findConversation(user, otherUserId);
            if (!conversation || !conversation.messages || conversation.messages.length === 0) return;
            
            // Get undelivered messages from this conversation
            const pendingMessages = conversation.messages.filter(msg => 
                msg.sender.toString() === otherUserId && !msg.delivered
            );
            
            if (pendingMessages.length === 0) return;
            
            console.log(`Sending ${pendingMessages.length} pending messages to ${userId}`);
            
            // Mark messages as delivered
            for (const message of pendingMessages) {
                message.delivered = true;
                
                // Send message to the client
                socket.emit('message', {
                    _id: message._id,
                    sender: message.sender,
                    receiver: userId,
                    content: message.content,
                    timestamp: message.timestamp,
                    delivered: true,
                    read: message.read
                });
            }
            
            // Save user
            await user.save();
            
            // Notify the other user that messages were delivered
            this.notifyMessagesDelivered(otherUserId, userId, pendingMessages.map(m => m._id));
        } catch (error) {
            console.error('Error sending pending messages:', error);
        }
    }
    
    // Mark message as delivered to receiver
    async notifyMessageDelivered(senderId, receiverId, messageId) {
        // Check if receiver is online
        const receiverSockets = this.userSockets.get(receiverId);
        if (!receiverSockets || receiverSockets.size === 0) return;
        
        try {
            // Get sender
            const sender = await this.userModel.findById(senderId);
            if (!sender) return;
            
            // Find conversation with receiver
            const conversation = this.findConversation(sender, receiverId);
            if (!conversation) return;
            
            // Find message
            const message = conversation.messages.find(m => 
                m._id.toString() === messageId.toString()
            );
            
            if (!message) return;
            
            // Mark as delivered
            message.delivered = true;
            
            // Save sender
            await sender.save();
            
            // Get room name
            const roomName = [senderId, receiverId].sort().join('-');
            
            // Notify about delivery
            this.io.to(roomName).emit('message delivered', {
                messageId: messageId,
                sender: senderId,
                receiver: receiverId
            });
        } catch (error) {
            console.error('Error marking message as delivered:', error);
        }
    }
    
    // Mark multiple messages as delivered
    async notifyMessagesDelivered(senderId, receiverId, messageIds) {
        if (!messageIds || messageIds.length === 0) return;
        
        // Get room name
        const roomName = [senderId, receiverId].sort().join('-');
        
        // Notify about delivery
        this.io.to(roomName).emit('messages delivered', {
            messageIds: messageIds,
            sender: senderId,
            receiver: receiverId
        });
    }
    
    // Method to mark message as read
    async markMessageAsRead(readerId, senderId, messageId) {
        try {
            // Get reader
            const reader = await this.userModel.findById(readerId);
            if (!reader) {
                throw new Error('Reader not found');
            }
            
            // Find conversation
            const conversation = this.findConversation(reader, senderId);
            if (!conversation) {
                throw new Error('Conversation not found');
            }
            
            // Mark messages as read
            let hasChanges = false;
            
            if (messageId) {
                // Mark specific message as read
                const message = conversation.messages.find(msg => 
                    msg._id && msg._id.toString() === messageId.toString()
                );
                
                if (message && !message.read) {
                    message.read = true;
                    hasChanges = true;
                }
            } else {
                // Mark all unread messages from this sender as read
                conversation.messages.forEach(message => {
                    if (message.sender && message.sender.toString() === senderId.toString() && !message.read) {
                        message.read = true;
                        hasChanges = true;
                    }
                });
            }
            
            // Save if changes were made
            if (hasChanges) {
                conversation.lastUpdated = new Date();
                await reader.save();
                return true;
            }
            
            return false;
        } catch (error) {
            console.error('Error marking message as read:', error);
            return false;
        }
    }
    
    // Update user status (online/offline)
    async updateUserStatus(userId, isOnline) {
        try {
            await this.userModel.findByIdAndUpdate(userId, {
                lastActive: new Date(),
                isOnline: isOnline
            });
            
            console.log(`User ${userId} status updated: ${isOnline ? 'online' : 'offline'}`);
            return true;
        } catch (error) {
            console.error('Error updating user status:', error);
            return false;
        }
    }
    
    // Notify users that a user came online
    notifyUserOnline(userId) {
        // Find all rooms this user is part of based on userSockets
        const rooms = this.findUserRooms(userId);
        
        for (const room of rooms) {
            this.io.to(room).emit('user status', {
                userId: userId,
                status: 'online',
                lastActive: new Date()
            });
        }
    }
    
    // Send user status update to another user
    sendUserStatusUpdate(userId, targetUserId) {
        // Check if target user is online
        const targetSockets = this.userSockets.get(targetUserId);
        if (!targetSockets || targetSockets.size === 0) return;
        
        // Get room name
        const roomName = [userId, targetUserId].sort().join('-');
        
        // Send status update
        this.io.to(roomName).emit('user status', {
            userId: userId,
            status: 'online',
            lastActive: new Date()
        });
    }
    
    // Notify other users when a user goes offline
    notifyUserOffline(userId, rooms) {
        // Send status update to all rooms this user was in
        for (const roomName of rooms) {
            this.io.to(roomName).emit('user status', {
                userId: userId,
                status: 'offline',
                lastActive: new Date()
            });
        }
    }
    
    // Find all rooms that a user is part of
    findUserRooms(userId) {
        const rooms = new Set();
        
        // Iterate through all socket rooms
        for (const [id, socket] of this.io.sockets.sockets) {
            const socketRooms = socket.rooms;
            
            // Skip the socket's own room (socket ID)
            for (const room of socketRooms) {
                if (room !== id) {
                    // Check if this is a user-to-user room containing our user
                    const users = room.split('-');
                    if (users.length === 2 && users.includes(userId)) {
                        rooms.add(room);
                    }
                }
            }
        }
        
        return Array.from(rooms);
    }
    
    // Helper to find conversation
    findConversation(user, otherUserId) {
        if (!user.conversations) return null;
        
        return user.conversations.find(conv => 
            conv.participants && conv.participants.includes(otherUserId.toString())
        );
    }
}

module.exports = SocketChatServer;