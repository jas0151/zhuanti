class LogoutController {
    constructor() {
        // No dependencies needed for this simple controller
    }

    logout(req, res) {
        // Destroy the session
        req.session.destroy((err) => {
            if (err) {
                console.error("Error during logout:", err);
                return res.redirect('/main');
            }
            
            // Clear the cookie
            res.clearCookie('connect.sid'); // Default session cookie name
            
            // Redirect to home page
            res.redirect('/');
        });
    }
}

module.exports = new LogoutController();