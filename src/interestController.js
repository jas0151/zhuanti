const UserModel = require("./userModel");

class InterestController {
    constructor() {
        this.userModel = UserModel.getModel();
    }

    async getInterests(req, res) {
        try {
            const user = await this.userModel.findById(req.session.userId);
            if (!user) {
                return res.redirect('/login');
            }

            const editing = user.hasInterests; // If user already has interests, we're editing

            res.render("interests", {
                user: user,
                editing: editing
            });
        } catch (error) {
            console.error("Error loading interests page:", error);
            res.redirect('/main');
        }
    }

    async createInterests(req, res) {
        try {
            const interests = {
                hobbies: req.body.hobbies ? req.body.hobbies.split(',').filter(Boolean) : [],
                classes: req.body.classes ? req.body.classes.split(',').filter(Boolean) : [],
                clubs: req.body.clubs ? req.body.clubs.split(',').filter(Boolean) : [],
                languages: req.body.languages ? req.body.languages.split(',').filter(Boolean) : []
            };

            await this.userModel.findByIdAndUpdate(req.session.userId, {
                $set: {
                    hasInterests: true,
                    'profile.interests': interests
                }
            });

            // Always redirect to main dashboard after completing interests
            res.redirect('/main');
        } catch (error) {
            console.error("Error saving interests:", error);
            res.send("Error saving interests. Please try again.");
        }
    }
}

module.exports = new InterestController();