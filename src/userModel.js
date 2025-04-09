const mongoose = require("mongoose");
const bcrypt = require("bcrypt");

// Connection schema - represents connections between users
const connectionSchema = new mongoose.Schema({
    // User connections
    sentRequests: [{
        to: { type: mongoose.Schema.Types.ObjectId, ref: 'LogInCollection' },
        requestedAt: { type: Date, default: Date.now }
    }],
    receivedRequests: [{
        from: { type: mongoose.Schema.Types.ObjectId, ref: 'LogInCollection' },
        requestedAt: { type: Date, default: Date.now }
    }],
    connected: [{
        user: { type: mongoose.Schema.Types.ObjectId, ref: 'LogInCollection' },
        connectedAt: { type: Date, default: Date.now },
        updatedAt: { type: Date, default: Date.now },
        matchScore: { type: Number, default: 0 },
        commonInterests: {
            hobbies: [String],
            classes: [String],
            clubs: [String],
            languages: [String]
        }
    }]
});

// Interests schema - represents user interests
const interestsSchema = new mongoose.Schema({
    hobbies: [String],
    classes: [String],
    clubs: [String],
    languages: [String]
});

// User profile schema - represents user profile information
const profileSchema = new mongoose.Schema({
    firstName: String,
    lastName: String,
    gender: String,
    birthday: Date,
    university: String,
    major: String,
    yearOfStudy: String,
    domicile: String,
    nationality: String,
    bio: String,
    photo: String,
    interests: interestsSchema,
    galleryPhotos: [{
        filename: String,
        description: String,
        uploadDate: { type: Date, default: Date.now },
        isPrivate: { type: Boolean, default: false },
        id: String
    }],
    privacySettings: {
        showEmail: { type: Boolean, default: false },
        showPhone: { type: Boolean, default: false },
        showBirthday: { type: Boolean, default: false },
        showLocation: { type: Boolean, default: true },
        allowMessaging: { type: Boolean, default: true }
    }
});

// Message schema for conversations
const messageSchema = new mongoose.Schema({
    sender: { type: mongoose.Schema.Types.Mixed }, // Can be userId or 'system'
    content: String,
    timestamp: { type: Date, default: Date.now },
    read: { type: Boolean, default: false },
    delivered: { type: Boolean, default: false }
});

// Conversation schema for user chats
const conversationSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true
    },
    participants: [String],
    messages: [messageSchema],
    createdAt: { type: Date, default: Date.now },
    lastUpdated: { type: Date, default: Date.now },
    matchScore: { type: Number, default: 0 }
});

// Notification schema for user notifications
const notificationSchema = new mongoose.Schema({
    type: {
        type: String,
        enum: ['connection_request', 'connection_accepted', 'message', 'system'],
        required: true
    },
    from: { type: mongoose.Schema.Types.ObjectId, ref: 'LogInCollection' },
    message: { type: String, required: true },
    read: { type: Boolean, default: false },
    timestamp: { type: Date, default: Date.now }
});

// Match score schema for tracking match scores
const matchScoreSchema = new mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'LogInCollection' },
    score: Number,
    lastCalculated: { type: Date, default: Date.now }
});

// Rejected user schema for tracking rejected users
const rejectedUserSchema = new mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'LogInCollection' },
    rejectedAt: { type: Date, default: Date.now },
    reason: String
});

// Main user schema
const logInSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true
    },
    email: {
        type: String,
        required: true,
        unique: true
    },
    password: {
        type: String,
        required: true
    },
    role: {
        type: String,
        default: 'user'
    },
    profile: profileSchema,
    connections: connectionSchema,
    hasProfile: {
        type: Boolean,
        default: false
    },
    hasInterests: {
        type: Boolean,
        default: false
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    lastActive: {
        type: Date,
        default: Date.now
    },
    conversations: [conversationSchema],
    matchScores: [matchScoreSchema],
    rejectedUsers: [rejectedUserSchema],
    notifications: [notificationSchema],
    accountStatus: {
        type: String,
        enum: ['active', 'inactive', 'suspended', 'deleted'],
        default: 'active'
    }
});

// Pre-save middleware to hash password before saving
logInSchema.pre('save', async function(next) {
    // Only hash the password if it's new or modified
    if (!this.isModified('password')) return next();

    try {
        // Generate salt
        const salt = await bcrypt.genSalt(10);
        // Hash the password with the salt
        this.password = await bcrypt.hash(this.password, salt);
        next();
    } catch (error) {
        next(error);
    }
});

// Method to compare password for login
logInSchema.methods.comparePassword = async function(candidatePassword) {
    try {
        return await bcrypt.compare(candidatePassword, this.password);
    } catch (error) {
        throw error;
    }
};

// Create indexes for better query performance
logInSchema.index({ 'profile.university': 1 });
logInSchema.index({ 'profile.major': 1 });
logInSchema.index({ 'profile.yearOfStudy': 1 });
logInSchema.index({ 'profile.domicile': 1 });
logInSchema.index({ 'profile.interests.hobbies': 1 });
logInSchema.index({ 'profile.interests.classes': 1 });
logInSchema.index({ 'profile.interests.clubs': 1 });
logInSchema.index({ 'profile.interests.languages': 1 });
logInSchema.index({ lastActive: -1 });
logInSchema.index({ hasProfile: 1, hasInterests: 1 });

// Additional methods for user operations
logInSchema.methods.updateLastActive = function() {
    this.lastActive = new Date();
    return this.save();
};

logInSchema.methods.getUnreadNotificationsCount = function() {
    if (!this.notifications) return 0;
    return this.notifications.filter(n => !n.read).length;
};

logInSchema.methods.markNotificationsAsRead = function() {
    if (!this.notifications) return Promise.resolve(this);
    this.notifications.forEach(notification => {
        notification.read = true;
    });
    return this.save();
};

// Static methods for user operations
logInSchema.statics.getActiveUsersCount = async function() {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    return this.countDocuments({ lastActive: { $gte: oneHourAgo } });
};

logInSchema.statics.getUsersWithInterests = async function(interestType, interestValue) {
    return this.find({
        [`profile.interests.${interestType}`]: interestValue
    });
};

// Singleton model instance
let UserModelInstance = null;

class UserModel {
    static getModel(collectionName = 'logincollections') {
        try {
            // Try to return an existing model if it exists
            return mongoose.model(collectionName);
        } catch (error) {
            // If model doesn't exist, create it with the specified collection name
            return mongoose.model(collectionName, logInSchema, collectionName);
        }
    }
}

module.exports = UserModel;