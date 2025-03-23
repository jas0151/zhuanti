const UserModel = require("./userModel");

class EditProfileController {
    constructor() {
        this.userModel = UserModel.getModel();
    }

    async getEditProfile(req, res) {
        try {
            const user = await this.userModel.findById(req.session.userId);
            if (!user) {
                return res.redirect('/login');
            }

            res.render("profile", {
                user: user,
                editing: true
            });
        } catch (error) {
            console.error("Error loading edit profile page:", error);
            res.redirect('/main');
        }
    }

    async updateProfile(req, res) {
        try {
            const user = await this.userModel.findById(req.session.userId);
            if (!user) {
                return res.redirect('/login');
            }

            // Keep existing profile data and only update what was submitted
            const existingProfile = user.profile || {};
            
            // Parse the birthday to a Date object if provided
            let birthdayDate = existingProfile.birthday;
            if (req.body.birthday) {
                birthdayDate = new Date(req.body.birthday);
            }
            
            const updateData = {
                profile: {
                    // Use existing data if new data isn't provided
                    firstName: req.body.firstName || existingProfile.firstName,
                    lastName: req.body.lastName || existingProfile.lastName,
                    gender: req.body.gender || existingProfile.gender,
                    birthday: birthdayDate,
                    nationality: req.body.nationality || existingProfile.nationality,
                    domicile: req.body.domicile || existingProfile.domicile,
                    university: req.body.university || existingProfile.university,
                    major: req.body.major || existingProfile.major,
                    yearOfStudy: req.body.yearOfStudy || existingProfile.yearOfStudy,
                    bio: req.body.bio !== undefined ? req.body.bio : existingProfile.bio,
                    
                    // Preserve existing data for fields not in the form
                    interests: existingProfile.interests || {},
                    photo: existingProfile.photo || null,
                    galleryPhotos: existingProfile.galleryPhotos || [],
                    privacySettings: existingProfile.privacySettings || {
                        showEmail: false,
                        showUniversity: true,
                        allowMessages: true,
                        showGallery: true
                    },
                    createdAt: existingProfile.createdAt || new Date(),
                    updatedAt: new Date()
                },
                hasProfile: true
            };

            // Update user profile
            await this.userModel.findByIdAndUpdate(req.session.userId, { $set: updateData });

            // Redirect back to main dashboard with success message
            res.redirect('/main?success=profile_updated');
        } catch (error) {
            console.error("Error updating profile:", error);
            res.send("Error updating profile. Please try again.");
        }
    }

    async getEditInterests(req, res) {
        try {
            const user = await this.userModel.findById(req.session.userId);
            if (!user) {
                return res.redirect('/login');
            }

            res.render("interests", {
                user: user,
                editing: true
            });
        } catch (error) {
            console.error("Error loading edit interests page:", error);
            res.redirect('/main');
        }
    }

    async updateInterests(req, res) {
        try {
            const user = await this.userModel.findById(req.session.userId);
            if (!user) {
                return res.redirect('/login');
            }

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

            res.redirect('/main?success=interests_updated');
        } catch (error) {
            console.error("Error updating interests:", error);
            res.send("Error updating interests. Please try again.");
        }
    }

    async deleteAccount(req, res) {
        try {
            // Optional: Add confirmation step through a form with password verification
            await this.userModel.findByIdAndDelete(req.session.userId);
            
            // Destroy the session
            req.session.destroy((err) => {
                if (err) {
                    console.error("Error during logout after account deletion:", err);
                }
                
                // Clear the cookie
                res.clearCookie('connect.sid');
                
                // Redirect to home page with a message
                res.redirect('/?message=account_deleted');
            });
        } catch (error) {
            console.error("Error deleting account:", error);
            res.redirect('/main?error=delete_failed');
        }
    }

    async changePassword(req, res) {
        try {
            const { currentPassword, newPassword, confirmPassword } = req.body;
            
            // Validate password input
            if (!currentPassword || !newPassword || !confirmPassword) {
                return res.send("All password fields are required.");
            }
            
            if (newPassword !== confirmPassword) {
                return res.send("New passwords do not match.");
            }
            
            if (newPassword.length < 8) {
                return res.send("New password must be at least 8 characters long.");
            }
            
            // Get user and verify current password
            const user = await this.userModel.findById(req.session.userId);
            if (!user) {
                return res.redirect('/login');
            }
            
            // Check if the current password is correct
            const bcrypt = require('bcryptjs');
            let isCurrentPasswordValid = false;
            
            if (user.password.startsWith('$2')) {
                // Password is hashed with bcrypt
                isCurrentPasswordValid = await bcrypt.compare(currentPassword, user.password);
            } else {
                // Legacy plaintext password
                isCurrentPasswordValid = user.password === currentPassword;
            }
            
            if (!isCurrentPasswordValid) {
                return res.send("Current password is incorrect.");
            }
            
            // Hash the new password
            const salt = await bcrypt.genSalt(10);
            const hashedPassword = await bcrypt.hash(newPassword, salt);
            
            // Update the password
            await this.userModel.findByIdAndUpdate(req.session.userId, {
                password: hashedPassword
            });
            
            res.redirect('/main?success=password_updated');
        } catch (error) {
            console.error("Error changing password:", error);
            res.send("Error changing password. Please try again.");
        }
    }

    async updatePrivacySettings(req, res) {
        try {
            const user = await this.userModel.findById(req.session.userId);
            if (!user) {
                return res.redirect('/login');
            }
            
            // Get privacy settings from form
            const privacySettings = {
                showEmail: req.body.showEmail === 'on',
                showUniversity: req.body.showUniversity === 'on',
                allowMessages: req.body.allowMessages === 'on',
                showGallery: req.body.showGallery === 'on'
            };
            
            // Update user's privacy settings
            await this.userModel.findByIdAndUpdate(req.session.userId, {
                $set: {
                    'profile.privacySettings': privacySettings
                }
            });
            
            res.redirect('/main?success=privacy_updated');
        } catch (error) {
            console.error("Error updating privacy settings:", error);
            res.send("Error updating privacy settings. Please try again.");
        }
    }
}

module.exports = new EditProfileController();