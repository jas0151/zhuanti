// logoutController.js
class LogoutController {
    constructor() {
        this.userModel = require('./userModel').getModel();
    }

    async logout(req, res) {
        try {
            const userId = req.session.userId;
            const tabId = req.tabId;
            
            console.log(`Logout initiated for user: ${userId}, Tab ID: ${tabId}`);
            
            if (userId) {
                // Update the user's online status
                try {
                    await this.userModel.findByIdAndUpdate(userId, {
                        lastActive: new Date(),
                        isOnline: false
                    });
                } catch (error) {
                    console.error('Error updating user status on logout:', error);
                }
            }
            
            // Destroy the session
            req.session.destroy(function(err) {
                if (err) {
                    console.error('Error destroying session:', err);
                    return res.redirect('/main');
                }
                
                // Redirect to login page
                res.redirect('/login');
            });
        } catch (error) {
            console.error('Logout error:', error);
            res.redirect('/login');
        }
    }
}

module.exports = new LogoutController();