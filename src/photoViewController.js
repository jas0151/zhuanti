const fs = require('fs');
const path = require('path');
const UserModel = require("./userModel");

class PhotoViewController {
    constructor() {
        this.userModel = UserModel.getModel();
    }

    async getProfilePhoto(req, res) {
        try {
            const userId = req.params.userId;
            console.log(`Getting profile photo for user ID: ${userId}`);
            const user = await this.userModel.findById(userId);
            
            if (!user) {
                console.log(`User not found: ${userId}`);
                return res.sendFile(path.join(__dirname, '../public/default-avatar.png'));
            }
            
            // Try several possible paths:
            const possiblePaths = [
                // Path from database
                user.profile?.photo ? path.join(__dirname, '../uploads/profiles', user.profile.photo) : null,
                // Fixed pattern path with jpg
                path.join(__dirname, '../uploads/profiles', `profile_${userId}.jpg`),
                // Fixed pattern path with png
                path.join(__dirname, '../uploads/profiles', `profile_${userId}.png`),
                // Fixed pattern path with jpeg
                path.join(__dirname, '../uploads/profiles', `profile_${userId}.jpeg`)
            ].filter(Boolean); // Remove null entries
            
            // Try each path
            for (const photoPath of possiblePaths) {
                console.log(`Trying path: ${photoPath}`);
                if (fs.existsSync(photoPath)) {
                    console.log(`Photo found at: ${photoPath}`);
                    return res.sendFile(photoPath);
                }
            }
            
            // If no path works, return default
            console.log(`No profile photo found for user: ${userId}`);
            return res.sendFile(path.join(__dirname, '../public/default-avatar.png'));
        } catch (error) {
            console.error(`Error retrieving profile photo:`, error);
            return res.sendFile(path.join(__dirname, '../public/default-avatar.png'));
        }
    }

    async getGalleryPhoto(req, res) {
        try {
            const userId = req.params.userId;
            const photoId = req.params.photoId;
            const user = await this.userModel.findById(userId);
            
            if (!user || !user.profile || !user.profile.galleryPhotos) {
                return res.status(404).send("Photo not found");
            }
            
            // Find the photo in the user's gallery
            const photo = user.profile.galleryPhotos.find(p => p.id === photoId || p._id.toString() === photoId);
            
            if (!photo || !photo.filename) {
                return res.status(404).send("Photo not found");
            }
            
            // Build the path to the gallery photo
            const photoPath = path.join(__dirname, '../uploads/gallery', photo.filename);
            
            // Check if the file exists
            if (fs.existsSync(photoPath)) {
                return res.sendFile(photoPath);
            } else {
                console.error(`Gallery photo not found at path: ${photoPath}`);
                return res.status(404).send("Photo file not found");
            }
        } catch (error) {
            console.error("Error retrieving gallery photo:", error);
            return res.status(500).send("Error retrieving photo");
        }
    }
}

module.exports = new PhotoViewController();