const bcrypt = require('bcrypt');

class AuthController {
    constructor() {
        this.userModel = require('./userModel').getModel();
    }

    async login(req, res) {
        try {
            const { email, password, tabId } = req.body;
            const currentTabId = tabId || req.tabId;
            
            console.log(`Login attempt for email: ${email}, Tab ID: ${currentTabId}`);
            
            // Basic validation
            if (!email || !password) {
                console.log('Login missing email or password');
                return res.render('login', { 
                    error: 'Please provide both email and password',
                    tabId: currentTabId
                });
            }
            
            // Find user by email (case insensitive)
            const user = await this.userModel.findOne({ 
                email: { $regex: new RegExp(`^${email}$`, 'i') } 
            });
            
            if (!user) {
                console.log(`No user found with email: ${email}`);
                return res.render('login', { 
                    error: 'Invalid email or password',
                    tabId: currentTabId
                });
            }
            
            // Check password using the model's comparePassword method
            const isMatch = await user.comparePassword(password);
            
            if (!isMatch) {
                console.log(`Invalid password for user: ${email}`);
                return res.render('login', { 
                    error: 'Invalid email or password',
                    tabId: currentTabId
                });
            }
            
            // Update last active timestamp
            await this.userModel.findByIdAndUpdate(user._id, {
                lastActive: new Date(),
                isOnline: true
            });
            
            // Set up the session
            req.session.userId = user._id;
            req.session.userName = user.name || `${user.profile?.firstName || ''} ${user.profile?.lastName || ''}`.trim();
            
            console.log(`User ${email} successfully logged in with Tab ID: ${currentTabId}`);
            
            // Redirect based on profile completion
            if (!user.hasProfile) {
                return res.redirect('/create-profile');
            }
            
            return res.redirect('/main');
        } catch (error) {
            console.error('Login error:', error);
            return res.render('login', { 
                error: 'An error occurred. Please try again.',
                tabId: req.tabId
            });
        }
    }
    
    async signup(req, res) {
        try {
            // Extract only email and password from the request body
            // Name is provided as a default value "User" in the form
            const { name, email, password, tabId } = req.body;
            const currentTabId = tabId || req.tabId;
            
            console.log(`Signup attempt for email: ${email}, Tab ID: ${currentTabId}`);
            
            // Simple validation
            if (!email) {
                console.log('Signup missing email');
                return res.render('signup', { 
                    error: 'Please enter your email address',
                    tabId: currentTabId
                });
            }
            
            if (!password) {
                console.log('Signup missing password');
                return res.render('signup', { 
                    error: 'Please enter a password', 
                    email,
                    tabId: currentTabId
                });
            }
            
            if (password.length < 6) {
                console.log('Password too short');
                return res.render('signup', { 
                    error: 'Password must be at least 6 characters long', 
                    email,
                    tabId: currentTabId
                });
            }
            
            // Check if user already exists
            let user = await this.userModel.findOne({ email });
            
            if (user) {
                console.log(`Email ${email} already exists in database`);
                // If the account exists but is Google-linked, suggest Google sign-in
                if (user.googleId) {
                    return res.render('signup', { 
                        error: 'This email is already registered with Google. Please sign in with Google.',
                        isGoogleAccount: true,
                        tabId: currentTabId
                    });
                }
                
                return res.render('signup', { 
                    error: 'This email address is already registered',
                    tabId: currentTabId
                });
            }
            
            // Create new user with default name if not provided
            console.log('Creating new user with email and password');
            
            // Initialize required fields to prevent schema validation errors
            user = new this.userModel({
                name: name || 'User', // Use provided name or default to 'User'
                email,
                password, // Plain password - will be hashed by the pre-save hook
                profile: {}, // Initialize empty profile object
                hasProfile: false,
                hasInterests: false,
                lastActive: new Date(),
                isOnline: true,
                // Add necessary initial fields for connections and conversations
                connections: {
                    sentRequests: [],
                    receivedRequests: [],
                    connected: []
                },
                conversations: []
            });
            
            console.log('User object created, about to save');
            
            const savedUser = await user.save();
            console.log(`New user created with ID: ${savedUser._id}`);
            
            // Set up the session
            req.session.userId = savedUser._id;
            req.session.userName = savedUser.name;
            
            console.log(`Session set with userId: ${savedUser._id}, tabId: ${currentTabId}`);
            
            // Redirect to profile creation
            return res.redirect('/create-profile');
        } catch (error) {
            console.error('Signup error:', error);
            
            // Simplified error handling
            if (error.name === 'ValidationError') {
                console.error('Validation error details:', error.errors);
                
                // Format MongoDB validation errors to be more user-friendly
                let errorMessage = 'Please check your information and try again';
                
                if (error.errors && error.errors.email) {
                    errorMessage = 'Please enter a valid email address';
                } else if (error.errors && error.errors.password) {
                    errorMessage = 'Please enter a valid password';
                }
                
                return res.render('signup', { 
                    error: errorMessage, 
                    email: req.body.email,
                    tabId: req.tabId
                });
            } else if (error.name === 'MongoError' || error.code === 11000) {
                console.error('MongoDB error:', error.code, error.message);
                return res.render('signup', { 
                    error: 'This email address is already registered',
                    tabId: req.tabId
                });
            }
            
            return res.render('signup', { 
                error: 'An error occurred. Please try again later.',
                tabId: req.tabId
            });
        }
    }
    
    async checkEmail(req, res) {
        try {
            const { email } = req.query;
            
            if (!email) {
                return res.status(400).json({ error: 'Email is required' });
            }
            
            const user = await this.userModel.findOne({ email });
            
            if (user) {
                // If the user exists with Google auth, indicate that
                if (user.googleId) {
                    return res.json({ 
                        exists: true, 
                        googleAccount: true, 
                        message: 'This email is registered with Google. Please sign in with Google.' 
                    });
                }
                
                return res.json({ 
                    exists: true, 
                    message: 'This email is already registered.' 
                });
            }
            
            return res.json({ exists: false });
        } catch (error) {
            console.error('Check email error:', error);
            return res.status(500).json({ error: 'Server error' });
        }
    }
    
    async forgotPassword(req, res) {
        try {
            const { email } = req.body;
            const tabId = req.tabId;
            
            if (!email) {
                return res.render('forgot-password', { 
                    error: 'Please provide your email address',
                    tabId
                });
            }
            
            const user = await this.userModel.findOne({ email });
            
            if (!user) {
                // Don't reveal that the user doesn't exist for security
                return res.render('forgot-password', { 
                    success: 'If an account with that email exists, we have sent password reset instructions.',
                    tabId
                });
            }
            
            // If the user is Google-authenticated, inform them
            if (user.googleId && !user.password) {
                return res.render('forgot-password', { 
                    error: 'This account uses Google Sign-In. Please sign in with Google instead of using a password.',
                    isGoogleAccount: true,
                    tabId
                });
            }
            
            // Here you would implement actual password reset logic
            // Generate token, send email, etc.
            // For now, we'll just show a success message
            
            return res.render('forgot-password', { 
                success: 'If an account with that email exists, we have sent password reset instructions.',
                tabId
            });
        } catch (error) {
            console.error('Forgot password error:', error);
            return res.render('forgot-password', { 
                error: 'An error occurred. Please try again.',
                tabId: req.tabId
            });
        }
    }
}

module.exports = new AuthController();