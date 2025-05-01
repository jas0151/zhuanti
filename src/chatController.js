const UserModel = require("./userModel");

class ChatController {
    constructor() {
        this.userModel = UserModel.getModel();
    }

    async getChat(req, res) {
        try {
            const currentUserId = req.session.userId;
            const otherUserId = req.params.userId;

            console.log("Opening chat: ", { currentUserId, otherUserId });

            if (!currentUserId || !otherUserId) {
                return res.status(400).render("error", {
                    title: "Missing User Info",
                    message: "Could not identify one or both users for this chat."
                });
            }

            const [currentUser, otherUser] = await Promise.all([
                this.userModel.findById(currentUserId),
                this.userModel.findById(otherUserId)
            ]);

            if (!currentUser || !otherUser) {
                console.error("One or both users not found:", {
                    currentUserFound: !!currentUser,
                    otherUserFound: !!otherUser
                });

                return res.status(404).render("error", {
                    title: "User Not Found",
                    message: "One of the users in this chat does not exist or was deleted."
                });
            }

            // Check if they are connected
            if (!this.areConnected(currentUser, otherUserId)) {
                console.warn("User is not connected to chat target.");
                return res.redirect('/connections?error=not_connected');
            }

            // Get or create conversation
            let conversation = await this.getConversation(currentUserId, otherUserId);

            if (!conversation) {
                conversation = {
                    participants: [currentUserId, otherUserId],
                    messages: [],
                    createdAt: new Date(),
                    lastUpdated: new Date()
                };

                currentUser.conversations = currentUser.conversations || [];
                currentUser.conversations.push(conversation);
                await currentUser.save();
            }

            // Optional: generate conversation starters (e.g., shared interests)
            const starters = this.generateConversationStarters(currentUser, otherUser);

            res.render("chat", {
                currentUser,
                otherUser,
                conversation,
                commonInterests: starters.length > 0,
                starters
            });
        } catch (error) {
            console.error("Error loading chat page:", error);

            return res.status(500).render("error", {
                title: "Chat Load Failed",
                message: "Oops! Something went wrong while loading the chat."
            });
        }
    }

    areConnected(currentUser, otherUserId) {
        if (!currentUser || !currentUser.connections) return false;
        return currentUser.connections.connected.includes(otherUserId);
    }

    async getConversation(userIdA, userIdB) {
        const user = await this.userModel.findById(userIdA);
        if (!user || !user.conversations) return null;

        return user.conversations.find(c =>
            c.participants.includes(userIdA) && c.participants.includes(userIdB)
        );
    }

    generateConversationStarters(currentUser, otherUser) {
        const starters = [];

        try {
            const a = currentUser.profile?.interests || {};
            const b = otherUser.profile?.interests || {};

            const categories = ["hobbies", "languages", "clubs", "subjects"];
            categories.forEach(cat => {
                const shared = (a[cat] || []).filter(x => (b[cat] || []).includes(x));
                starters.push(...shared);
            });

            return [...new Set(starters)].slice(0, 6); // Max 6 unique starters
        } catch (err) {
            console.warn("Error generating starters:", err);
            return [];
        }
    }
}

module.exports = new ChatController();
