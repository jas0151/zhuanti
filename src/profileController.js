const UserModel = require("./userModel");

class ProfileController {
    constructor() {
        this.userModel = UserModel.getModel();
    }

    async createProfile(req, res) {
        try {
            // If it's a GET request, just render the form
            if (req.method === 'GET') {
                const user = await this.userModel.findById(req.session.userId);
                return res.render("profile", { 
                    user: user, 
                    editing: false 
                });
            }

            // Handle POST request - process form submission
            const user = await this.userModel.findById(req.session.userId);
            
            // Parse the birthday to a Date object if provided
            let birthdayDate = null;
            if (req.body.birthday) {
                birthdayDate = new Date(req.body.birthday);
            }
            
            // Validate age (must be at least 18)
            if (birthdayDate) {
                const today = new Date();
                const age = today.getFullYear() - birthdayDate.getFullYear();
                const monthDiff = today.getMonth() - birthdayDate.getMonth();
                
                // If the birthday hasn't occurred yet this year, subtract one year
                if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthdayDate.getDate())) {
                    if (age - 1 < 18) {
                        return res.render("profile", {
                            user: user,
                            editing: false,
                            error: {
                                type: 'validation_error',
                                message: 'You must be at least 18 years old to register.'
                            }
                        });
                    }
                } else if (age < 18) {
                    return res.render("profile", {
                        user: user,
                        editing: false,
                        error: {
                            type: 'validation_error',
                            message: 'You must be at least 18 years old to register.'
                        }
                    });
                }
            }
            
            // Process domicile information (combined from region and city dropdowns)
            const domicile = req.body.domicile || "";
            
            const updateData = {
                hasProfile: true,
                profile: {
                    firstName: req.body.firstName,
                    lastName: req.body.lastName,
                    // Personal fields
                    gender: req.body.gender,
                    birthday: birthdayDate,
                    nationality: req.body.nationality,
                    domicile: domicile,
                    // Academic fields
                    university: req.body.university,
                    major: req.body.major,
                    yearOfStudy: req.body.yearOfStudy,
                    bio: req.body.bio,
                    // Preserve existing data
                    interests: user.profile?.interests || {},
                    photo: user.profile?.photo || null,
                    galleryPhotos: user.profile?.galleryPhotos || [],
                    privacySettings: user.profile?.privacySettings || {
                        showEmail: false,
                        showUniversity: true,
                        allowMessages: true,
                        showGallery: true
                    },
                    createdAt: user.profile?.createdAt || new Date(),
                    updatedAt: new Date()
                }
            };

            await this.userModel.findByIdAndUpdate(req.session.userId, { $set: updateData });

            // Redirect based on user state
            // New users (no interests yet) go to the interests page
            // Existing users go back to the main dashboard
            if (!user.hasInterests) {
                res.redirect('/interests');
            } else {
                res.redirect('/main');
            }
        } catch (error) {
            console.error("Error updating profile:", error);
            res.send("Error updating profile. Please try again.");
        }
    }
}

module.exports = new ProfileController();