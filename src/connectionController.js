const UserModel = require("./userModel");

class ConnectionController {
    constructor() {
        this.userModel = UserModel.getModel();
    }

    async getConnections(req, res) {
        try {
            const userId = req.session.userId;
            const user = await this.userModel.findById(userId);
            
            if (!user) {
                return res.redirect('/login');
            }

            // Initialize connections array if not present
            if (!user.connections) {
                user.connections = {
                    sentRequests: [],
                    receivedRequests: [],
                    connected: []
                };
                await user.save();
            }
            
            // Fetch data for received connection requests
            const pendingRequests = [];
            for (const request of user.connections.receivedRequests || []) {
                const requestUser = await this.userModel.findById(request.from);
                if (requestUser) {
                    pendingRequests.push({
                        user: requestUser,
                        connectionData: request
                    });
                }
            }
            
            // Fetch data for sent connection requests
            const connectionRequests = [];
            for (const request of user.connections.sentRequests || []) {
                const requestUser = await this.userModel.findById(request.to);
                if (requestUser) {
                    connectionRequests.push({
                        user: requestUser,
                        connectionData: request
                    });
                }
            }
            
            // Fetch data for accepted connections
            const acceptedConnections = [];
            for (const connection of user.connections.connected || []) {
                const connectedUser = await this.userModel.findById(connection.user);
                if (connectedUser) {
                    acceptedConnections.push({
                        user: connectedUser,
                        connectionData: connection
                    });
                }
            }
            
            res.render('connection', {
                pendingRequests,
                connectionRequests,
                acceptedConnections,
                success: req.query.success,
                error: req.query.error
            });
        } catch (error) {
            console.error("Error loading connections:", error);
            res.redirect('/main?error=connections_error');
        }
    }

    async acceptConnection(req, res) {

    async rejectConnection(req, res) {
        try {
            const currentUserId = req.session.userId;
            const requestUserId = req.params.userId;
            
            // Get current user
            const currentUser = await this.userModel.findById(currentUserId);
            if (!currentUser) {
                return res.status(404).json({ success: false, error: 'User not found' });
            }
            
            // Initialize connections if it doesn't exist
            if (!currentUser.connections) {
                currentUser.connections = { sentRequests: [], receivedRequests: [], connected: [] };
            }
            
            // Find the request in received requests
            const requestIndex = currentUser.connections.receivedRequests.findIndex(
                req => req.from.toString() === requestUserId.toString()
            );
            
            if (requestIndex === -1) {
                return res.status(400).json({ success: false, error: 'Connection request not found' });
            }
            
            // Remove from pending requests
            currentUser.connections.receivedRequests.splice(requestIndex, 1);
            
            // Save user
            await currentUser.save();
            
            // Optionally, remove from the other user's sent requests
            const requestUser = await this.userModel.findById(requestUserId);
            if (requestUser && requestUser.connections && requestUser.connections.sentRequests) {
                const sentRequestIndex = requestUser.connections.sentRequests.findIndex(
                    req => req.to.toString() === currentUserId.toString()
                );
                
                if (sentRequestIndex !== -1) {
                    requestUser.connections.sentRequests.splice(sentRequestIndex, 1);
                    await requestUser.save();
                }
            }
            
            // For AJAX requests
            if (req.xhr) {
                return res.status(200).json({ success: true });
            }
            
            // For regular form submissions
            res.redirect('/connections?success=request_rejected');
        } catch (error) {
            console.error("Error rejecting connection:", error);
            
            if (req.xhr) {
                return res.status(500).json({ success: false, error: 'Server error' });
            }
            
            res.redirect('/connections?error=reject_failed');
        }
    }
}

module.exports = new ConnectionController();