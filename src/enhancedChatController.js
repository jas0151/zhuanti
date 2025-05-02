// enhancedChatController.js - Improved controller for chat functionality

const mongoose = require('mongoose');
const UserModel = require('./userModel');

class EnhancedChatController {
    constructor() {
        // Fix: Use UserModel.getModel() instead of directly accessing mongoose model
        this.userModel = UserModel.getModel();
    }

    // Fix for the conversations schema issue in enhancedChatController.js

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
            return res.status(404).render('error', {
                message: 'User not found',
                error: {},
                tabId: req.tabId
            });
        }
        
        // Check if they are connected
        if (!this.areConnected(currentUser, otherUserId)) {
            return res.redirect('/connections?error=not_connected');
        }
        
        // Get or create conversation
        let conversation = await this.getConversation(currentUserId, otherUserId);
        
        // If conversation doesn't exist, create a new one
        if (!conversation) {
            // Create name for the conversation (required field)
            const conversationName = `Chat between ${currentUser.profile?.firstName || 'User'} and ${otherUser.profile?.firstName || 'User'}`;
            
            conversation = {
                name: conversationName, // Add the required name field
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
        
        // Generate some conversation starters based on shared interests
        const starters = this.generateConversationStarters(currentUser, otherUser);
        
        // Find common interests if available
        let commonInterests = [];
        if (currentUser.profile?.interests && otherUser.profile?.interests) {
            // Logic to find common interests
            // ...
        }
        
        res.render('chat', {
            currentUser,
            otherUser,
            conversation,
            commonInterests,
            starters,
            tabId: req.tabId
        });
    } catch (error) {
        console.error("Error loading chat:", error);
        res.status(500).render('error', {
            message: 'Failed to load chat',
            error: process.env.NODE_ENV === 'development' ? error : {},
            tabId: req.tabId
        });
    }
}

    // Rest of your controller methods...
    // (keeping the rest of the file unchanged)
    
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
        try {
            const user = await this.userModel.findById(userId1);
            
            if (!user || !user.conversations) {
                return null;
            }
            
            // Find conversation with both participants
            return user.conversations.find(conv => 
                conv.participants && conv.participants.includes(userId2.toString())
            );
        } catch (error) {
            console.error("Error getting conversation:", error);
            return null;
        }
    }
    
    // Generate conversation starters based on user profiles
    generateConversationStarters(currentUser, otherUser) {
        const starters = [];
        
        // Based on university and major if they match
        if (currentUser.profile?.university && 
            otherUser.profile?.university && 
            currentUser.profile.university === otherUser.profile.university) {
            starters.push(`How do you like it at ${otherUser.profile.university}?`);
        }
        
        if (currentUser.profile?.major && 
            otherUser.profile?.major && 
            currentUser.profile.major === otherUser.profile.major) {
            starters.push(`I see we're both studying ${otherUser.profile.major}. What classes are you taking?`);
        }
        
        // Based on interests (if defined)
        if (currentUser.interests && otherUser.interests) {
            const commonInterests = currentUser.interests.filter(interest => 
                otherUser.interests.includes(interest)
            );
            
            if (commonInterests.length > 0) {
                const randomInterest = commonInterests[Math.floor(Math.random() * commonInterests.length)];
                starters.push(`I noticed we both like ${randomInterest}. What got you interested in that?`);
            }
        }
        
        // Add some generic starters
        starters.push("Hey, how's your day going so far?");
        starters.push("What brought you to CampusMatch?");
        starters.push("Any fun plans for the weekend?");
        
        // Return random 3 starters
        return this.shuffleArray(starters).slice(0, 3);
    }
    
    // Helper function to shuffle array (Fisher-Yates algorithm)
    shuffleArray(array) {
        const newArray = [...array];
        for (let i = newArray.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
        }
        return newArray;
    }
}

module.exports = new EnhancedChatController();