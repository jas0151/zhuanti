// Imports
const handlebarsHelpers = require('./handlebarsHelpers');
const express = require("express");
const session = require("express-session");
const MongoStore = require('connect-mongo');
const path = require("path");
const hbs = require("hbs");
const mongoose = require("mongoose");
const http = require('http');
const socketIO = require('socket.io');
const { v4: uuidv4 } = require('uuid');
const cookieParser = require('cookie-parser');
const Database = require("./mongodb");
const AuthController = require("./authController");
const ProfileController = require("./profileController");
const PhotoController = require("./photoController");
const InterestController = require("./interestController");
const MatchController = require("./matchController");
const LogoutController = require("./logoutController");
const MainController = require("./mainController"); 
const PhotoViewController = require("./photoViewController");
const GalleryController = require("./galleryController");
const EditProfileController = require("./editProfileController"); 
const ViewProfileController = require("./viewProfileController");
const ConnectionController = require("./connectionController");
const EnhancedChatController = require("./enhancedChatController");
const SocketChatServer = require("./socketChatServer");

class Server {
    constructor() {
        this.app = express();
        this.userModel = require("./userModel").getModel();
        
        // Create HTTP server to attach Socket.IO
        this.httpServer = http.createServer(this.app);
        
        // Configure shared session middleware
        const sessionStore = MongoStore.create({
            mongoUrl: 'mongodb://localhost:27017/LoginSignupdb',
            collectionName: 'sessions',
            ttl: 24 * 60 * 60, // 24 hours
            autoRemove: 'native'
        });
        
        // Create shared session middleware
        this.sessionMiddleware = session({
            secret: 'your-secret-key',
            resave: false,
            saveUninitialized: false,
            store: sessionStore,
            cookie: {
                httpOnly: true,
                maxAge: 24 * 60 * 60 * 1000 // 24 hours
            }
        });
        
        // Configure middleware and routes
        this.configureMiddleware();
        handlebarsHelpers.registerHelpers();
        this.configureRoutes();
        
        // Initialize Socket.IO chat server with proper session sharing
        this.socketChatServer = new SocketChatServer(this.httpServer);
        
        // Pass session middleware to socket server
        this.socketChatServer.setSessionMiddleware(this.sessionMiddleware);
        
        console.log('Server initialized with enhanced Socket.IO chat support');
    }

    configureMiddleware() {
        this.app.use(express.static('public'));
        this.app.use(express.json());
        this.app.set("view engine", "hbs");
        this.app.set("views", path.join(__dirname, "../tempelates"));
        this.app.use(express.urlencoded({ extended: false }));
        
        // Add cookie parser
        this.app.use(cookieParser());
        
        // Track tab ID without affecting sessions
        this.app.use((req, res, next) => {
            req.tabId = req.query.tabId || uuidv4();
            res.locals.tabId = req.tabId; // Make available to templates
            next();
        });
        
        // Use the shared session middleware
        this.app.use(this.sessionMiddleware);
        
        // Track user activity middleware
        this.app.use(async (req, res, next) => {
            if (req.session && req.session.userId) {
                try {
                    // Update last active timestamp
                    const UserModel = require("./userModel");
                    await mongoose.model('LogInCollection').updateOne(
                        { _id: req.session.userId },
                        { $set: { lastActive: new Date() } }
                    );
                } catch (error) {
                    console.error('Error updating user activity:', error);
                }
            }
            next();
        });
        
        // Add user data to all templates
        this.app.use((req, res, next) => {
            if (req.session && req.session.userId) {
                res.locals.session = {
                    userId: req.session.userId,
                    userName: req.session.userName || 'User',
                    tabId: req.tabId
                };
            }
            next();
        });
        
        // Make a timestamp available for cache busting
        this.app.use((req, res, next) => {
            res.locals.timestamp = new Date().getTime();
            next();
        });
    }

    configureRoutes() {
        // Initialize controllers
        const authController = AuthController;
        const profileController = ProfileController;
        const photoController = PhotoController;
        const interestController = InterestController;
        const matchController = MatchController;
        const logoutController = LogoutController;
        const mainController = MainController; 
        const photoViewController = PhotoViewController;
        const galleryController = GalleryController; 
        const editProfileController = EditProfileController;
        const viewProfileController = ViewProfileController; 
        const connectionController = ConnectionController;
        const enhancedChatController = EnhancedChatController;
        
        // Debug route for session info
        this.app.get("/session-debug", (req, res) => {
            res.json({
                tabId: req.tabId,
                sessionId: req.sessionID,
                session: req.session,
                cookies: req.cookies,
                headers: req.headers
            });
        });
        
        // Tab-specific session check API
        this.app.get('/api/session-check', (req, res) => {
            if (req.session && req.session.userId) {
                res.json({
                    authenticated: true,
                    userId: req.session.userId,
                    userName: req.session.userName || 'User',
                    tabId: req.tabId
                });
            } else {
                res.json({
                    authenticated: false,
                    tabId: req.tabId
                });
            }
        });
        
        // Debug route
        this.app.get("/debug/:userId", async (req, res) => {
            try {
                const userId = req.params.userId;
                const user = await this.userModel.findById(userId).lean();
                
                if (!user) {
                    return res.json({ error: 'User not found' });
                }
                
                // Clean up sensitive data
                if (user.password) {
                    user.password = '[REDACTED]';
                }
                
                res.json({
                    user: user,
                    tabId: req.tabId,
                    sessionId: req.sessionID,
                    sessionData: req.session,
                    connectionStats: {
                        hasConnections: !!user.connections,
                        sentRequests: user.connections?.sentRequests?.length || 0,
                        receivedRequests: user.connections?.receivedRequests?.length || 0,
                        connected: user.connections?.connected?.length || 0
                    },
                    conversationStats: {
                        hasConversations: !!user.conversations,
                        count: user.conversations?.length || 0
                    }
                });
            } catch (error) {
                res.json({ error: error.message });
            }
        });
        
        // Route to get messages via API
        this.app.get("/get-messages/:userId", this.isAuthenticated, async (req, res) => {
            try {
                const currentUserId = req.session.userId;
                const otherUserId = req.params.userId;
                
                console.log(`Getting messages between ${currentUserId} and ${otherUserId}`);
                
                // Get current user
                const currentUser = await this.userModel.findById(currentUserId);
                if (!currentUser) {
                    return res.status(404).json({
                        success: false,
                        error: 'User not found'
                    });
                }
                
                // Find conversation
                let conversation = null;
                if (currentUser.conversations) {
                    conversation = currentUser.conversations.find(conv => 
                        conv.participants && conv.participants.includes(otherUserId.toString())
                    );
                }
                
                console.log(`Messages API - Conversation found: ${!!conversation}`);
                if (conversation) {
                    console.log(`Messages API - Message count: ${conversation.messages?.length || 0}`);
                }
                
                // If no conversation or no messages, return empty array
                if (!conversation || !conversation.messages || conversation.messages.length === 0) {
                    return res.status(200).json({
                        success: true,
                        messages: []
                    });
                }
                
                return res.status(200).json({
                    success: true,
                    messages: conversation.messages,
                    lastUpdated: conversation.lastUpdated || new Date()
                });
            } catch (error) {
                console.error("Error getting messages:", error);
                return res.status(500).json({
                    success: false,
                    error: 'Server error: ' + error.message
                });
            }
        });
        
        this.app.get("/", (req, res) => {
            res.render("home", { userId: req.session.userId, tabId: req.tabId });
        });

        this.app.get("/login", (req, res) => {
            if (req.session.userId) {
                res.redirect('/main');
            } else {
                // Add session error message if available
                const sessionError = req.query.session;
                let errorMessage = null;
                
                if (sessionError === 'expired') {
                    errorMessage = 'Your session has expired. Please log in again.';
                } else if (sessionError === 'conflict') {
                    errorMessage = 'Session conflict detected. Please log in again.';
                }
                
                res.render("login", { error: errorMessage, tabId: req.tabId });
            }
        });

        this.app.post("/login", (req, res) => {
            // Add tab ID to the request body
            req.body.tabId = req.tabId;
            authController.login(req, res);
        });
        
        this.app.get("/signup", (req, res) => {
            res.render("signup", { tabId: req.tabId });
        });
        
        this.app.post("/signup", (req, res) => {
            // Add tab ID to the request body
            req.body.tabId = req.tabId;
            authController.signup(req, res);
        });
        
        // Profile routes
        this.app.get("/create-profile", this.isAuthenticated, (req, res) => {
            profileController.createProfile(req, res);
        });
        
        this.app.post("/create-profile", this.isAuthenticated, (req, res) => {
            profileController.createProfile(req, res);
        });
        
        // Add this new route for /profile that redirects to edit-profile
        this.app.get("/profile", this.isAuthenticated, (req, res) => {
            res.redirect('/edit-profile');
        });
        
        this.app.get("/edit-profile", this.isAuthenticated, (req, res) => {
            editProfileController.getEditProfile(req, res);
        });
        
        this.app.post("/update-profile", this.isAuthenticated, (req, res) => {
            editProfileController.updateProfile(req, res);
        });
        
        // Photo uploads
        this.app.post("/upload-photo", this.isAuthenticated, (req, res) => {
            photoController.uploadPhoto(req, res);
        });
        
        // Photo retrieval routes with improved path handling
        this.app.get("/photo/:userId", (req, res) => {
            // Add cache busting with timestamp query param
            photoViewController.getProfilePhoto(req, res);
        });
        
        this.app.get("/gallery-photo/:userId/:photoId", (req, res) => {
            photoViewController.getGalleryPhoto(req, res);
        });
        
        // Interests routes
        this.app.get("/interests", this.isAuthenticated, (req, res) => {
            interestController.getInterests(req, res);
        });
        
        this.app.post("/create-interests", this.isAuthenticated, (req, res) => {
            interestController.createInterests(req, res);
        });
        
        this.app.get("/edit-interests", this.isAuthenticated, (req, res) => {
            editProfileController.getEditInterests(req, res);
        });
        
        this.app.post("/update-interests", this.isAuthenticated, (req, res) => {
            editProfileController.updateInterests(req, res);
        });
        
        // Matches routes
        this.app.get("/matches", this.isAuthenticated, (req, res) => {
            matchController.getMatches(req, res);
        });
        
        this.app.post("/connect/:userId", this.isAuthenticated, (req, res) => {
            matchController.sendConnectionRequest(req, res);
        });
        
        // Other static routes
        this.app.get("/logout", (req, res) => {
            // Add tab ID to the request
            req.tabId = req.tabId;
            logoutController.logout(req, res);
        });
        
        this.app.get("/main", this.isAuthenticated, (req, res) => {
            mainController.getDashboard(req, res);
        });
        
        this.app.get("/gallery", this.isAuthenticated, (req, res) => {
            galleryController.getGallery(req, res);
        });
        
        this.app.post("/upload-gallery-photo", this.isAuthenticated, (req, res) => {
            galleryController.uploadGalleryPhoto(req, res);
        });
        
        this.app.post("/toggle-privacy/:photoId", this.isAuthenticated, (req, res) => {
            galleryController.togglePhotoPrivacy(req, res);
        });
        
        this.app.post("/delete-gallery-photo/:photoId", this.isAuthenticated, (req, res) => {
            galleryController.deleteGalleryPhoto(req, res);
        });
        
        this.app.get("/view-profile/:userId", this.isAuthenticated, (req, res) => {
            viewProfileController.viewProfile(req, res);
        });
        
        // Enhanced connection routes
        this.app.get("/connections", this.isAuthenticated, (req, res) => {
            connectionController.getConnections(req, res);
        });
        
        this.app.post("/accept-connection/:userId", this.isAuthenticated, (req, res) => {
            connectionController.acceptConnection(req, res);
        });
        
        this.app.post("/reject-connection/:userId", this.isAuthenticated, (req, res) => {
            connectionController.rejectConnection(req, res);
        });
        
        this.app.post("/remove-connection/:userId", this.isAuthenticated, (req, res) => {
            connectionController.removeConnection(req, res);
        });
        
        // Enhanced chat routes with real-time support
        this.app.get("/chat/:userId", this.isAuthenticated, (req, res) => {
            // If there's a message parameter, handle it as message sending
            if (req.query.message) {
                return enhancedChatController.handleChatMessage(req, res);
            }
            
            // Otherwise, render the chat page
            enhancedChatController.getChat(req, res);
        });
        
        // Chat navigation test route
        this.app.get("/chat-navigation-test", this.isAuthenticated, (req, res) => {
            res.render("chat-navigation-test", { tabId: req.tabId });
        });
        
        // API route for connections list in chat sidebar
        this.app.get("/connections/list", this.isAuthenticated, (req, res) => {
            enhancedChatController.getConnectionsList(req, res);
        });
        
        // API routes for real-time chat functionality
        this.app.get("/api/messages/:userId", this.isAuthenticated, (req, res) => {
            enhancedChatController.getConversationHistory(req, res);
        });
        
        this.app.post("/api/messages/read/:userId", this.isAuthenticated, (req, res) => {
            enhancedChatController.markMessagesAsRead(req, res);
        });
        
        this.app.get("/connections/api", this.isAuthenticated, (req, res) => {
            enhancedChatController.getConnectionsList(req, res);
        });
        
        // Change password and privacy settings
        this.app.post("/change-password", this.isAuthenticated, (req, res) => {
            editProfileController.changePassword(req, res);
        });
        
        this.app.post("/delete-account", this.isAuthenticated, (req, res) => {
            editProfileController.deleteAccount(req, res);
        });
        
        this.app.post("/update-privacy", this.isAuthenticated, (req, res) => {
            editProfileController.updatePrivacySettings(req, res);
        });
        
        // Error handling middleware
        this.app.use((err, req, res, next) => {
            console.error('Global error handler:', err);
            
            // Determine if this is an API request
            const isApiRequest = req.xhr || 
                               req.headers.accept?.includes('json') || 
                               req.path.startsWith('/api/');
            
            if (isApiRequest) {
                // API error response
                const statusCode = err.statusCode || 500;
                return res.status(statusCode).json({
                    success: false,
                    error: process.env.NODE_ENV === 'development' ? err.message : 'Server error',
                    details: process.env.NODE_ENV === 'development' ? err.stack : undefined
                });
            } else {
                // Web page error response
                res.status(err.statusCode || 500);
                
                return res.render('error', {
                    message: err.message || "Something went wrong",
                    error: process.env.NODE_ENV === 'development' ? err : {},
                    tabId: req.tabId
                });
            }
        });

        // 404 handler for undefined routes
        this.app.use((req, res) => {
            if (req.xhr) {
                return res.status(404).json({
                    success: false,
                    error: 'Resource not found'
                });
            }
            res.status(404).render('error', {
                message: "Page not found",
                error: {},
                tabId: req.tabId
            });
        });
    }
    
    isAuthenticated(req, res, next) {
        if (req.session && req.session.userId) {
            next();
        } else {
            res.redirect('/login');
        }
    }

    start() {
        this.httpServer.listen(3000, () => {
            console.log('Server running on port 3000');
        });
    }
}

const server = new Server();
server.start();

// Initialize background match score updates
async function startBackgroundMatchUpdates() {
    const matchController = require('./matchController');
    const userModel = require('./userModel').getModel();
    
    // Update all match scores every 6 hours
    setInterval(async () => {
        try {
            console.log("Starting background match score updates...");
            
            // Get all users with profiles and interests
            const users = await userModel.find({
                hasProfile: true,
                hasInterests: true
            });
            
            let updatedCount = 0;
            
            // Process each user
            for (const user of users) {
                const success = await matchController.updateUserMatchScores(user._id);
                if (success) updatedCount++;
                
                // Add small delay to prevent MongoDB overload
                await new Promise(r => setTimeout(r, 100));
            }
            
            console.log(`Match score update completed - updated ${updatedCount}/${users.length} users`);
        } catch (error) {
            console.error("Error in background match update:", error);
        }
    }, 6 * 60 * 60 * 1000); // 6 hours
    
    // Invalidate old match scores every 24 hours
    setInterval(async () => {
        try {
            console.log("Starting match score invalidation...");
            await matchController.invalidateOldMatchScores();
            console.log("Match score invalidation completed");
        } catch (error) {
            console.error("Error invalidating match scores:", error);
        }
    }, 24 * 60 * 60 * 1000); // 24 hours
    
    // Run initial match calculations on startup
    setTimeout(async () => {
        try {
            console.log("Running initial match score calculations...");
            
            // Get 50 most recently active users initially to avoid overloading server
            const users = await userModel.find({
                hasProfile: true,
                hasInterests: true
            }).sort({ lastActive: -1 }).limit(50);
            
            let updatedCount = 0;
            
            // Process each user
            for (const user of users) {
                const success = await matchController.updateUserMatchScores(user._id);
                if (success) updatedCount++;
                
                // Add small delay to prevent MongoDB overload
                await new Promise(r => setTimeout(r, 100));
            }
            
            console.log(`Initial match score calculation completed - updated ${updatedCount}/${users.length} users`);
        } catch (error) {
            console.error("Error in initial match calculation:", error);
        }
    }, 5000); // Start 5 seconds after server startup
}

// Call this after server starts
startBackgroundMatchUpdates();