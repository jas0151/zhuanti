const fs = require('fs');
const path = require('path');
const multer = require('multer');
const UserModel = require("./userModel");

class PhotoController {
    constructor() {
        this.userModel = UserModel.getModel();
        
        // Configure storage for profile photos
        this.storage = multer.diskStorage({
            destination: (req, file, cb) => {
                const dir = path.join(__dirname, '../uploads/profiles');
                if (!fs.existsSync(dir)) {
                    fs.mkdirSync(dir, { recursive: true });
                }
                cb(null, dir);
            },
            filename: (req, file, cb) => {
                // Use a fixed naming pattern based on user ID
                const userId = req.session.userId;
                const fileExt = path.extname(file.originalname);
                // This ensures the filename is always predictable
                cb(null, `profile_${userId}${fileExt}`);
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

        // Create multer upload middleware
        this.upload = multer({
            storage: this.storage,
            fileFilter: this.fileFilter,
            limits: {
                fileSize: 5 * 1024 * 1024 // 5MB limit
            }
        }).single('photo');
    }

    uploadPhoto(req, res) {
        try {
            // Use a Promise-based approach for better error handling
            new Promise((resolve, reject) => {
                this.upload(req, res, function(err) {
                    if (err) reject(err);
                    else resolve(req.file);
                });
            })
            .then(async (file) => {
                if (!file) {
                    return res.status(400).json({
                        success: false,
                        message: "No file was selected."
                    });
                }
    
                // Update user with filename only (don't store file data in DB)
                await this.userModel.findByIdAndUpdate(req.session.userId, {
                    $set: {
                        'profile.photo': file.filename,
                        'profile.updatedAt': new Date()
                    }
                });
    
                // Redirect appropriately
                const referer = req.headers.referer || '/main';
                if (referer.includes('/profile') || referer.includes('/create-profile')) {
                    return res.redirect(referer + '?success=photo_updated');
                } else {
                    return res.redirect('/main?success=photo_updated');
                }
            })
            .catch(error => {
                console.error("Error uploading photo:", error);
                res.status(400).json({
                    success: false,
                    message: error.message || "Error uploading photo"
                });
            });
        } catch (error) {
            console.error("Error in photo upload process:", error);
            res.status(500).send("Server error during photo upload.");
        }
    }
}

module.exports = new PhotoController();