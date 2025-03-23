// Existing imports remain the same
const handlebarsHelpers = require('./handlebarsHelpers');
const express = require("express");
const session = require("express-session");
const path = require("path");
const hbs = require("hbs");
const mongoose = require("mongoose");
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

class Server {
    constructor() {
        this.app = express();
        this.userModel = require("./userModel").getModel();
        this.configureMiddleware();
        handlebarsHelpers.registerHelpers();
        this.configureRoutes();
    }

    configureMiddleware() {
        this.app.use(express.static('public'));
        this.app.use(express.json());
        this.app.set("view engine", "hbs");
        this.app.set("views", path.join(__dirname, "../tempelates"));
        this.app.use(express.urlencoded({ extended: false }));
        this.app.use(session({
            secret: 'your-secret-key',
            resave: false,
            saveUninitialized: false
        }));
        
        // Track user activity middleware
        this.app.use(async (req, res, next) => {
            if (req.session && req.session.userId) {
                try {
                    // Update last active timestamp
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
    }

    configureRoutes() {
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

        this.app.get("/", (req, res) => {
            res.render("home", { userId: req.session.userId });
        });

        this.app.get("/login", (req, res) => {
            if (req.session.userId) {
                res.redirect('/main');
            } else {
                res.render("login");
            }
        });

        this.app.post("/login", authController.login.bind(authController));
        this.app.get("/signup", (req, res) => {
            res.render("signup");
        });
        this.app.post("/signup", authController.signup.bind(authController));
        
        // Profile routes
        this.app.get("/create-profile", this.isAuthenticated, profileController.createProfile.bind(profileController));
        this.app.post("/create-profile", this.isAuthenticated, profileController.createProfile.bind(profileController));
        
        // Add this new route for /profile that redirects to edit-profile
        this.app.get("/profile", this.isAuthenticated, (req, res) => {
            res.redirect('/edit-profile');
        });
        
        this.app.get("/edit-profile", this.isAuthenticated, editProfileController.getEditProfile.bind(editProfileController));
        this.app.post("/update-profile", this.isAuthenticated, editProfileController.updateProfile.bind(editProfileController));
        
        // Photo uploads
        this.app.post("/upload-photo", this.isAuthenticated, photoController.uploadPhoto.bind(photoController));
        
        // Interests routes
        this.app.get("/interests", this.isAuthenticated, interestController.getInterests.bind(interestController));
        this.app.post("/create-interests", this.isAuthenticated, interestController.createInterests.bind(interestController));
        this.app.get("/edit-interests", this.isAuthenticated, editProfileController.getEditInterests.bind(editProfileController));
        this.app.post("/update-interests", this.isAuthenticated, editProfileController.updateInterests.bind(editProfileController));
        
        // Other routes remain the same
        this.app.get("/matches", this.isAuthenticated, matchController.getMatches.bind(matchController));
        this.app.get("/logout", logoutController.logout.bind(logoutController));
        this.app.get("/main", this.isAuthenticated, mainController.getDashboard.bind(mainController));
        this.app.get("/photo/:userId", photoViewController.getProfilePhoto.bind(photoViewController));
        this.app.get("/gallery-photo/:userId/:photoId", photoViewController.getGalleryPhoto.bind(photoViewController));
        this.app.get("/gallery", this.isAuthenticated, galleryController.getGallery.bind(galleryController));
        this.app.post("/upload-gallery-photo", this.isAuthenticated, galleryController.uploadGalleryPhoto.bind(galleryController));
        this.app.post("/toggle-privacy/:photoId", this.isAuthenticated, galleryController.togglePhotoPrivacy.bind(galleryController));
        this.app.post("/delete-gallery-photo/:photoId", this.isAuthenticated, galleryController.deleteGalleryPhoto.bind(galleryController));
        this.app.get("/view-profile/:userId", this.isAuthenticated, viewProfileController.viewProfile.bind(viewProfileController));
        this.app.post("/connect/:userId", this.isAuthenticated, matchController.sendConnectionRequest.bind(matchController));
        
        // Add any missing routes for connections functionality
        this.app.get("/connections", this.isAuthenticated, (req, res) => {
            if (typeof ConnectionController !== 'undefined') {
                ConnectionController.getConnections.bind(ConnectionController)(req, res);
            } else {
                res.redirect('/main?error=feature_not_available');
            }
        });
        
        // Add routes for accept/reject connection requests
        this.app.post("/accept-connection/:userId", this.isAuthenticated, (req, res) => {
            if (typeof ConnectionController !== 'undefined') {
                ConnectionController.acceptConnection.bind(ConnectionController)(req, res);
            } else {
                res.status(404).json({ success: false, error: 'Feature not available' });
            }
        });
        
        this.app.post("/reject-connection/:userId", this.isAuthenticated, (req, res) => {
            if (typeof ConnectionController !== 'undefined') {
                ConnectionController.rejectConnection.bind(ConnectionController)(req, res);
            } else {
                res.status(404).json({ success: false, error: 'Feature not available' });
            }
        });
        
        // Add chat routes if needed
        this.app.get("/chat/:userId", this.isAuthenticated, (req, res) => {
            if (typeof ChatController !== 'undefined') {
                ChatController.getChat.bind(ChatController)(req, res);
            } else {
                res.redirect('/connections?error=chat_not_available');
            }
        });
        
        // Change password and privacy settings
        this.app.post("/change-password", this.isAuthenticated, editProfileController.changePassword.bind(editProfileController));
        this.app.post("/delete-account", this.isAuthenticated, editProfileController.deleteAccount.bind(editProfileController));
        this.app.post("/update-privacy", this.isAuthenticated, editProfileController.updatePrivacySettings.bind(editProfileController));
        
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
                    error: process.env.NODE_ENV === 'development' ? err : {}
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
                error: {}
            });
        });
    }
    
    isAuthenticated(req, res, next) {
        if (req.session.userId) {
            next();
        } else {
            res.redirect('/login');
        }
    }

    start() {
        this.app.listen(3000, () => {
            console.log('port connected');
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