const bcrypt = require('bcrypt');

class AuthController {
    constructor() {
        this.userModel = require('./userModel').getModel();
    }

    async login(req, res) {
        try {
            const { email, password } = req.body;
            console.log(`Login attempt for email: ${email}`);
            
            // Basic validation
            if (!email || !password) {
                console.log('Login missing email or password');
                return res.render('login', { error: 'Please provide both email and password' });
            }
            
            // Find user by email (case insensitive)
            const user = await this.userModel.findOne({ 
                email: { $regex: new RegExp(`^${email}$`, 'i') } 
            });
            
            if (!user) {
                console.log(`No user found with email: ${email}`);
                return res.render('login', { error: 'Invalid email or password' });
            }
            
            // Check password using bcrypt
            const isMatch = await bcrypt.compare(password, user.password);
            
            if (!isMatch) {
                console.log(`Invalid password for user: ${email}`);
                // Implement rate limiting for failed login attempts
                return res.render('login', { error: 'Invalid email or password' });
            }
            
            // Update last active timestamp
            await this.userModel.findByIdAndUpdate(user._id, {
                lastActive: new Date()
            });
            
            // Set user session with timeout
            req.session.userId = user._id;
            req.session.cookie.maxAge = 24 * 60 * 60 * 1000; // 24 hours
            
            console.log(`User ${email} successfully logged in`);
            
            // Redirect based on profile completion
            if (!user.hasProfile) {
                return res.redirect('/create-profile');
            }
            
            return res.redirect('/main');
        } catch (error) {
            console.error('Login error:', error);
            return res.render('login', { error: 'An error occurred. Please try again.' });
        }
    }
    
    async signup(req, res) {
        try {
            const { email, password } = req.body;
            console.log(`Signup attempt for email: ${email}`);
            
            // Basic validation
            if (!email || !password) {
                console.log('Signup missing email or password');
                return res.render('signup', { error: 'Please provide both email and password' });
            }
            
            if (password.length < 6) {
                console.log('Password too short');
                return res.render('signup', { error: 'Password must be at least 6 characters long' });
            }
            
            // Check if user already exists
            let user = await this.userModel.findOne({ email });
            
            if (user) {
                console.log(`Email ${email} already exists in database`);
                // If the account exists but is Google-linked, suggest Google sign-in
                if (user.googleId) {
                    return res.render('signup', { 
                        error: 'This email is already registered with Google. Please sign in with Google.',
                        isGoogleAccount: true 
                    });
                }
                
                return res.render('signup', { error: 'Email already registered' });
            }
            
            // Create new user with MANUALLY HASHED password
            console.log('Creating new user with email and password');
            
            // Generate salt and hash password manually
            const salt = await bcrypt.genSalt(10);
            const hashedPassword = await bcrypt.hash(password, salt);
            
            user = new this.userModel({
                email,
                password: hashedPassword, // Store pre-hashed password
                profile: {}
            });
            
            const savedUser = await user.save();
            console.log(`New user created with ID: ${savedUser._id}`);
            
            // Set user session
            req.session.userId = savedUser._id;
            console.log(`Session set with userId: ${savedUser._id}`);
            
            // Redirect to profile creation
            return res.redirect('/create-profile');
        } catch (error) {
            console.error('Signup error:', error);
            return res.render('signup', { error: 'An error occurred. Please try again.' });
        }
    }
    
    // Other methods remain the same...
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
    
    // Forgot password functionality
    async forgotPassword(req, res) {
        try {
            const { email } = req.body;
            
            if (!email) {
                return res.render('forgot-password', { error: 'Please provide your email address' });
            }
            
            const user = await this.userModel.findOne({ email });
            
            if (!user) {
                // Don't reveal that the user doesn't exist for security
                return res.render('forgot-password', { 
                    success: 'If an account with that email exists, we have sent password reset instructions.' 
                });
            }
            
            // If the user is Google-authenticated, inform them
            if (user.googleId && !user.password) {
                return res.render('forgot-password', { 
                    error: 'This account uses Google Sign-In. Please sign in with Google instead of using a password.',
                    isGoogleAccount: true
                });
            }
            
            // Here you would implement actual password reset logic
            // Generate token, send email, etc.
            // For now, we'll just show a success message
            
            return res.render('forgot-password', { 
                success: 'If an account with that email exists, we have sent password reset instructions.' 
            });
        } catch (error) {
            console.error('Forgot password error:', error);
            return res.render('forgot-password', { error: 'An error occurred. Please try again.' });
        }
    }
    
    // Link existing account with Google (called after Google auth if email exists)
    async linkGoogleAccount(googleId, email) {
        try {
            const user = await this.userModel.findOne({ email });
            
            if (user && !user.googleId) {
                user.googleId = googleId;
                await user.save();
                return user;
            }
            
            return null;
        } catch (error) {
            console.error('Link Google account error:', error);
            return null;
        }
    }
}

module.exports = new AuthController();