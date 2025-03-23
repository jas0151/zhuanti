const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
    email: {
        type: String,
        required: [true, 'Email is required'],
        // Removed 'unique: true' to avoid duplicate index error
        lowercase: true,
        trim: true,
        match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please enter a valid email']
    },
    password: {
        type: String,
        required: [true, 'Password is required'],
        minlength: [8, 'Password must be at least 8 characters long']
    },
    hasProfile: {
        type: Boolean,
        default: false
    },
    hasInterests: {
        type: Boolean,
        default: false
    },
    profile: {
        firstName: String,
        lastName: String,
        gender: String,
        birthday: Date,
        nationality: String,
        domicile: String,
        university: String,
        major: String,
        yearOfStudy: String,
        bio: String,
        photo: String, // Store filename only
        galleryPhotos: [{
            filename: String,
            description: String,
            isPrivate: {
                type: Boolean,
                default: false
            },
            uploadedAt: {
                type: Date,
                default: Date.now
            }
        }],
        interests: {
            hobbies: [String],
            classes: [String],
            clubs: [String],
            languages: [String]
        },
        privacySettings: {
            showEmail: {
                type: Boolean,
                default: false
            },
            showUniversity: {
                type: Boolean,
                default: true
            },
            allowMessages: {
                type: Boolean,
                default: true
            },
            showGallery: {
                type: Boolean,
                default: true
            }
        },
        createdAt: {
            type: Date,
            default: Date.now
        },
        updatedAt: {
            type: Date,
            default: Date.now
        }
    },
    connections: {
        sentRequests: [{
            to: {
                type: mongoose.Schema.Types.ObjectId,
                ref: 'LogInCollection'
            },
            requestedAt: {
                type: Date,
                default: Date.now
            }
        }],
        receivedRequests: [{
            from: {
                type: mongoose.Schema.Types.ObjectId,
                ref: 'LogInCollection'
            },
            requestedAt: {
                type: Date,
                default: Date.now
            }
        }],
        connected: [{
            user: {
                type: mongoose.Schema.Types.ObjectId,
                ref: 'LogInCollection'
            },
            connectedAt: {
                type: Date,
                default: Date.now
            },
            updatedAt: {
                type: Date,
                default: Date.now
            }
        }]
    },
    conversations: [{
        participants: [{
            type: mongoose.Schema.Types.ObjectId,
            ref: 'LogInCollection'
        }],
        messages: [{
            sender: {
                type: mongoose.Schema.Types.ObjectId,
                ref: 'LogInCollection'
            },
            content: String,
            timestamp: {
                type: Date,
                default: Date.now
            },
            read: {
                type: Boolean,
                default: false
            }
        }],
        createdAt: {
            type: Date,
            default: Date.now
        },
        lastUpdated: {
            type: Date,
            default: Date.now
        }
    }],
    matchScores: [{
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'LogInCollection'
        },
        score: Number,
        lastCalculated: {
            type: Date,
            default: Date.now
        }
    }],
    lastActive: {
        type: Date,
        default: Date.now
    },
    accountStatus: {
        type: String,
        enum: ['active', 'suspended', 'inactive'],
        default: 'active'
    }
});

// Add indexes for better query performance
userSchema.index({ email: 1 }, { unique: true }); // Keeping this explicit index for email uniqueness
userSchema.index({ 'profile.university': 1 });
userSchema.index({ 'profile.major': 1 });
userSchema.index({ 'profile.domicile': 1 });
userSchema.index({ hasProfile: 1, hasInterests: 1 });
userSchema.index({ 'connections.connected.user': 1 });
userSchema.index({ 'matchScores.user': 1 });

class UserModel {
    constructor() {
        this.model = mongoose.model('LogInCollection', userSchema);
    }

    getModel() {
        return this.model;
    }
}

module.exports = new UserModel();