const UserModel = require("./userModel");

class ViewProfileController {
    constructor() {
        this.userModel = UserModel.getModel();
    }

    async viewProfile(req, res) {
        try {
            const viewedUserId = req.params.userId;
            const currentUser = await this.userModel.findById(req.session.userId);
            
            if (!currentUser) {
                return res.redirect('/login');
            }

            const viewedUser = await this.userModel.findById(viewedUserId);
            if (!viewedUser) {
                return res.redirect('/matches?error=user_not_found');
            }

            // Calculate match score between current user and viewed user
            let matchScore = 0;
            let totalPossibleScore = 0;
            
            if (currentUser.profile?.interests && viewedUser.profile?.interests) {
                // Calculate based on common interests
                if (currentUser.profile.interests.hobbies && viewedUser.profile.interests.hobbies) {
                    currentUser.profile.interests.hobbies.forEach(hobby => {
                        if (viewedUser.profile.interests.hobbies.includes(hobby)) {
                            matchScore += 1;
                        }
                    });
                    totalPossibleScore += Math.max(currentUser.profile.interests.hobbies.length, 1);
                }
                
                if (currentUser.profile.interests.classes && viewedUser.profile.interests.classes) {
                    currentUser.profile.interests.classes.forEach(cls => {
                        if (viewedUser.profile.interests.classes.includes(cls)) {
                            matchScore += 1;
                        }
                    });
                    totalPossibleScore += Math.max(currentUser.profile.interests.classes.length, 1);
                }
                
                if (currentUser.profile.interests.clubs && viewedUser.profile.interests.clubs) {
                    currentUser.profile.interests.clubs.forEach(club => {
                        if (viewedUser.profile.interests.clubs.includes(club)) {
                            matchScore += 1;
                        }
                    });
                    totalPossibleScore += Math.max(currentUser.profile.interests.clubs.length, 1);
                }
                
                if (currentUser.profile.interests.languages && viewedUser.profile.interests.languages) {
                    currentUser.profile.interests.languages.forEach(lang => {
                        if (viewedUser.profile.interests.languages.includes(lang)) {
                            matchScore += 1;
                        }
                    });
                    totalPossibleScore += Math.max(currentUser.profile.interests.languages.length, 1);
                }
            }

            // Calculate match percentage (prevent division by zero)
            const matchPercentage = totalPossibleScore > 0 
                ? Math.min(Math.round((matchScore / totalPossibleScore) * 100), 100) 
                : 0;

            // Find common interests
            const commonInterests = {
                hobbies: [],
                classes: [],
                clubs: [],
                languages: []
            };
            
            if (currentUser.profile?.interests && viewedUser.profile?.interests) {
                if (currentUser.profile.interests.hobbies && viewedUser.profile.interests.hobbies) {
                    commonInterests.hobbies = currentUser.profile.interests.hobbies.filter(
                        hobby => viewedUser.profile.interests.hobbies.includes(hobby)
                    );
                }
                
                if (currentUser.profile.interests.classes && viewedUser.profile.interests.classes) {
                    commonInterests.classes = currentUser.profile.interests.classes.filter(
                        cls => viewedUser.profile.interests.classes.includes(cls)
                    );
                }
                
                if (currentUser.profile.interests.clubs && viewedUser.profile.interests.clubs) {
                    commonInterests.clubs = currentUser.profile.interests.clubs.filter(
                        club => viewedUser.profile.interests.clubs.includes(club)
                    );
                }
                
                if (currentUser.profile.interests.languages && viewedUser.profile.interests.languages) {
                    commonInterests.languages = currentUser.profile.interests.languages.filter(
                        lang => viewedUser.profile.interests.languages.includes(lang)
                    );
                }
            }

            // Get public gallery photos
            const publicPhotos = viewedUser.profile?.galleryPhotos?.filter(photo => !photo.isPrivate) || [];

            // Check connection status (this is a placeholder - implement your connection logic)
            let connectionStatus = null;

            res.render("view-profile", {
                currentUser: currentUser,
                viewedUser: viewedUser,
                matchPercentage: matchPercentage,
                commonInterests: commonInterests,
                publicPhotos: publicPhotos,
                connectionStatus: connectionStatus,
                success: req.query.success
            });
        } catch (error) {
            console.error("Error viewing profile:", error);
            res.redirect('/matches');
        }
    }

    async sendConnectionRequest(req, res) {
        try {
            const targetUserId = req.params.userId;
            const currentUser = await this.userModel.findById(req.session.userId);
            
            if (!currentUser) {
                return res.redirect('/login');
            }

            // Check if target user exists
            const targetUser = await this.userModel.findById(targetUserId);
            if (!targetUser) {
                return res.json({ success: false, error: 'User not found' });
            }

            // Create connection request logic here
            // This is a placeholder - implement your connection storage logic
            
            // For AJAX requests, return JSON
            if (req.xhr) {
                return res.json({ success: true });
            }
            
            // For regular form submissions, redirect
            res.redirect(`/view-profile/${targetUserId}?success=connection_requested`);
        } catch (error) {
            console.error("Error sending connection request:", error);
            
            // For AJAX requests, return error
            if (req.xhr) {
                return res.json({ success: false, error: 'Failed to send request' });
            }
            
            // For regular form submissions, redirect
            res.redirect(`/view-profile/${req.params.userId}?error=request_failed`);
        }
    }
}

module.exports = new ViewProfileController();