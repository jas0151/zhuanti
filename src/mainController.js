const UserModel = require("./userModel");

class MainController {
    constructor() {
        this.userModel = UserModel.getModel();
    }

    async getDashboard(req, res) {
        try {
            const user = await this.userModel.findById(req.session.userId);
            if (!user) {
                return res.redirect('/login');
            }
            
            // Calculate profile completion percentage
            const profileCompletion = this.calculateProfileCompletion(user);
            
            // Set profile complete flag when profile completion is 100%
            const profileComplete = profileCompletion >= 100;
            
            // Get recommended matches if user has interests
            let recommendedMatches = [];
            if (user.hasInterests) {
                // Import matchController
                const matchController = require('./matchController');
                
                // Get matches with optimized method
                recommendedMatches = await matchController.getRecommendedMatches(user._id, 3);
            }
    
            // Get user initials
            const firstName = user.profile?.firstName || '';
            const lastName = user.profile?.lastName || '';
            const userInitials = (firstName.charAt(0) + lastName.charAt(0)).toUpperCase();
    
            // Add timestamp for cache busting
            const timestamp = Date.now();

            res.render("main", {
                user: user,
                userId: user._id,
                userName: `${firstName} ${lastName}`.trim(),
                userInitials: userInitials,
                firstName: firstName,
                recommendedMatches: recommendedMatches,
                profileCompletion: profileCompletion,
                profileComplete: profileComplete, // Add this flag
                success: req.query.success,
                timestamp: timestamp // Add timestamp for cache busting
            });
        } catch (error) {
            console.error("Error loading main page:", error);
            res.redirect('/');
        }
    }
    
    calculateProfileCompletion(user) {
        if (!user || !user.profile) return 0;
        
        // Define all the fields that contribute to profile completion
        const requiredFields = [
            'firstName',
            'lastName',
            'gender',
            'university',
            'major',
            'yearOfStudy',
            'bio'
        ];
        
        // Optional fields that provide bonus points
        const optionalFields = [
            'photo',
            'birthday',
            'nationality',
            'domicile'
        ];
        
        // Count complete required fields
        let completedFields = 0;
        for (const field of requiredFields) {
            if (user.profile[field] && user.profile[field].toString().trim() !== '') {
                completedFields += 1;
            }
        }
        
        // Count complete optional fields (weighted less)
        let completedOptionalFields = 0;
        for (const field of optionalFields) {
            if (user.profile[field] && user.profile[field].toString().trim() !== '') {
                completedOptionalFields += 1;
            }
        }
        
        // Calculate interests completeness
        let interestsScore = 0;
        if (user.hasInterests && user.profile.interests) {
            const interestCategories = ['hobbies', 'classes', 'clubs', 'languages'];
            for (const category of interestCategories) {
                if (user.profile.interests[category] && user.profile.interests[category].length > 0) {
                    interestsScore += 1;
                }
            }
        }
        
        // Calculate gallery completeness
        let galleryScore = 0;
        if (user.profile.galleryPhotos && user.profile.galleryPhotos.length > 0) {
            // 1 point for 1-2 photos, 2 points for 3+ photos
            galleryScore = user.profile.galleryPhotos.length >= 3 ? 2 : 1;
        }
        
        // Calculate total score and percentage
        const totalFieldsWeight = requiredFields.length + (optionalFields.length * 0.5) + 4 + 2; // 4 for interests, 2 for gallery
        const totalScore = completedFields + (completedOptionalFields * 0.5) + interestsScore + galleryScore;
        
        return Math.round((totalScore / totalFieldsWeight) * 100);
    }
}

module.exports = new MainController();