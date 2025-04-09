// Enhanced galleryController.js (without Sharp dependency)
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const UserModel = require("./userModel");

class GalleryController {
    constructor() {
        this.userModel = UserModel.getModel();
        
        // Configure storage for gallery photos
        this.storage = multer.diskStorage({
            destination: (req, file, cb) => {
                const dir = path.join(__dirname, '../uploads/gallery');
                // Create directory if it doesn't exist
                if (!fs.existsSync(dir)) {
                    fs.mkdirSync(dir, { recursive: true });
                }
                cb(null, dir);
            },
            filename: (req, file, cb) => {
                // Use a consistent naming scheme
                const userId = req.session.userId;
                const timestamp = Date.now();
                const fileExt = path.extname(file.originalname);
                cb(null, `gallery_${userId}_${timestamp}${fileExt}`);
            }
        });

        // File filter to only accept images
        this.fileFilter = (req, file, cb) => {
            const allowedFileTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
            if (allowedFileTypes.includes(file.mimetype)) {
                cb(null, true);
            } else {
                cb(new Error('Invalid file type. Only JPEG, PNG, GIF and WebP are allowed.'), false);
            }
        };
    }

    async getGallery(req, res) {
        try {
            const user = await this.userModel.findById(req.session.userId);
            if (!user) {
                return res.redirect('/login');
            }

            res.render("gallery", { user: user });
        } catch (error) {
            console.error("Error loading gallery:", error);
            res.redirect('/main');
        }
    }

    async uploadGalleryPhoto(req, res) {
        try {
            console.log("Upload request started");
            
            // Create a fresh upload instance for each request
            const upload = multer({
                storage: this.storage,
                fileFilter: this.fileFilter,
                limits: {
                    fileSize: 5 * 1024 * 1024 // 5MB limit
                }
            }).single('galleryPhoto');
            
            // Handle file upload with multer as a Promise
            await new Promise((resolve, reject) => {
                upload(req, res, function(err) {
                    if (err) {
                        console.error("Multer error:", err);
                        reject(err);
                    } else {
                        console.log("Upload completed by multer");
                        resolve();
                    }
                });
            });
            
            // If no file was uploaded
            if (!req.file) {
                console.error("No file in the request");
                return res.status(400).json({
                    success: false,
                    message: "No file was selected."
                });
            }

            console.log("File upload processed successfully");
            console.log("File details:", {
                filename: req.file.filename,
                size: req.file.size,
                mimetype: req.file.mimetype
            });
            
            // Get the user
            const user = await this.userModel.findById(req.session.userId);
            if (!user) {
                console.error("User not found:", req.session.userId);
                return res.status(404).json({
                    success: false,
                    message: "User not found."
                });
            }

            // Ensure profile exists
            if (!user.profile) {
                user.profile = {};
            }

            // Create gallery photo object
            const photoObj = {
                filename: req.file.filename,
                description: req.body.description || '',
                isPrivate: req.body.isPrivate === 'on',
                uploadedAt: new Date(),
                fileSize: req.file.size,
                fileType: req.file.mimetype
            };

            console.log("Created photo object:", photoObj);

            // Add photo to user's gallery
            if (!user.profile.galleryPhotos) {
                user.profile.galleryPhotos = [];
            }
            
            user.profile.galleryPhotos.push(photoObj);
            await user.save();
            
            console.log("Photo saved to user gallery");

            // Send appropriate response
            if (req.xhr || req.headers['x-requested-with'] === 'XMLHttpRequest') {
                return res.status(200).json({
                    success: true,
                    message: "Photo uploaded successfully",
                    photo: photoObj
                });
            } else {
                // Redirect back to gallery for regular form submissions
                return res.redirect('/gallery');
            }
        } catch (error) {
            console.error("Error in gallery photo upload process:", error);
            
            if (req.xhr || req.headers['x-requested-with'] === 'XMLHttpRequest') {
                return res.status(500).json({
                    success: false,
                    message: error.message || "Server error during photo upload."
                });
            } else {
                return res.status(500).send("Server error during photo upload.");
            }
        }
    }

    async togglePhotoPrivacy(req, res) {
        try {
            const photoId = req.params.photoId;
            const userId = req.session.userId;
            
            // Get the new privacy state from the request body
            // If not provided, toggle the current state
            const requestedPrivacyState = req.body.isPrivate;
            
            console.log(`Toggle privacy request: photoId=${photoId}, userId=${userId}`);
            
            // Find the user
            const user = await this.userModel.findById(userId);
            if (!user || !user.profile || !user.profile.galleryPhotos) {
                console.error("User or photos not found");
                return res.status(404).json({
                    success: false,
                    error: "User or photos not found."
                });
            }
            
            // Find the photo index
            const photoIndex = user.profile.galleryPhotos.findIndex(
                p => p._id.toString() === photoId
            );
            
            if (photoIndex === -1) {
                console.error(`Photo not found: ${photoId}`);
                return res.status(404).json({
                    success: false,
                    error: "Photo not found."
                });
            }
            
            // Get the current privacy state
            const currentPrivacyState = user.profile.galleryPhotos[photoIndex].isPrivate;
            
            // Set the new privacy state (toggle if not specified)
            const newPrivacyState = requestedPrivacyState !== undefined 
                ? requestedPrivacyState 
                : !currentPrivacyState;
                
            console.log(`Toggling privacy: ${currentPrivacyState} => ${newPrivacyState}`);
            
            // Update the privacy setting
            user.profile.galleryPhotos[photoIndex].isPrivate = newPrivacyState;
            
            await user.save();
            
            // Return success with the new state
            return res.status(200).json({
                success: true,
                isPrivate: newPrivacyState,
                message: newPrivacyState ? "Photo is now private" : "Photo is now public"
            });
        } catch (error) {
            console.error("Error toggling photo privacy:", error);
            return res.status(500).json({
                success: false,
                error: "Server error during privacy update."
            });
        }
    }

    async deleteGalleryPhoto(req, res) {
        try {
            const photoId = req.params.photoId;
            const userId = req.session.userId;
            
            // Find the user
            const user = await this.userModel.findById(userId);
            if (!user || !user.profile || !user.profile.galleryPhotos) {
                return res.status(404).json({
                    success: false,
                    error: "User or photos not found."
                });
            }
            
            // Find the photo
            const photo = user.profile.galleryPhotos.find(
                p => p._id.toString() === photoId
            );
            
            if (!photo) {
                return res.status(404).json({
                    success: false,
                    error: "Photo not found."
                });
            }
            
            // Delete the file
            const photoPath = path.join(__dirname, '../uploads/gallery', photo.filename);
            if (fs.existsSync(photoPath)) {
                fs.unlinkSync(photoPath);
            }
            
            // Remove from database
            user.profile.galleryPhotos = user.profile.galleryPhotos.filter(
                p => p._id.toString() !== photoId
            );
            
            await user.save();
            
            // Return success
            if (req.xhr || req.headers['x-requested-with'] === 'XMLHttpRequest') {
                return res.status(200).json({
                    success: true,
                    message: "Photo deleted successfully"
                });
            } else {
                return res.redirect('/gallery');
            }
        } catch (error) {
            console.error("Error deleting gallery photo:", error);
            if (req.xhr || req.headers['x-requested-with'] === 'XMLHttpRequest') {
                return res.status(500).json({
                    success: false,
                    error: "Server error during photo deletion."
                });
            } else {
                return res.status(500).send("Server error during photo deletion.");
            }
        }
    }
    
    async updateGalleryPhoto(req, res) {
        try {
            const photoId = req.params.photoId;
            const { description, isPrivate } = req.body;
            const userId = req.session.userId;

            // Find the user
            const user = await this.userModel.findById(userId);
            if (!user || !user.profile || !user.profile.galleryPhotos) {
                return res.status(404).json({
                    success: false,
                    error: "User or photos not found."
                });
            }

            // Find the photo index
            const photoIndex = user.profile.galleryPhotos.findIndex(
                p => p._id.toString() === photoId
            );

            if (photoIndex === -1) {
                return res.status(404).json({
                    success: false,
                    error: "Photo not found."
                });
            }

            // Update the photo details
            user.profile.galleryPhotos[photoIndex].description = description;
            user.profile.galleryPhotos[photoIndex].isPrivate = isPrivate;
            user.profile.galleryPhotos[photoIndex].lastUpdated = new Date();

            await user.save();

            // Return success
            return res.status(200).json({
                success: true,
                message: "Photo updated successfully"
            });
        } catch (error) {
            console.error("Error updating gallery photo:", error);
            return res.status(500).json({
                success: false,
                error: "Server error during photo update."
            });
        }
    }
}

module.exports = new GalleryController();