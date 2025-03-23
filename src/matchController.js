const mongoose = require("mongoose");
const UserModel = require("./userModel");

class MatchController {
    constructor() {
        this.userModel = UserModel.getModel();
    }

    // Main method to get matches
    async getMatches(req, res) {
        try {
            const currentUserId = req.session.userId;
            const currentUser = await this.userModel.findById(currentUserId);
            
            if (!currentUser) {
                return res.redirect('/login');
            }

            // Get query parameters for filtering
            const {
                search,
                gender,
                university,
                major,
                yearOfStudy,
                domicile,
                hobby,
                club,
                className,
                language,
                page = 1,
                limit = 12
            } = req.query;
            
            // Calculate skip value for pagination
            const skip = (parseInt(page) - 1) * parseInt(limit);

            // Build base query with index-friendly conditions first
            let query = {
                _id: { $ne: currentUserId },
                hasProfile: true,
                hasInterests: true
            };

            // Add indexed field filters
            if (gender) query['profile.gender'] = gender;
            if (university) query['profile.university'] = university;
            if (major) query['profile.major'] = major;
            if (yearOfStudy) query['profile.yearOfStudy'] = yearOfStudy;
            if (domicile) query['profile.domicile'] = domicile;
            
            // Add interest-specific filters - require special handling
            let interestFilters = [];
            
            if (hobby) {
                interestFilters.push({ 'profile.interests.hobbies': hobby });
            }
            
            if (club) {
                interestFilters.push({ 'profile.interests.clubs': club });
            }
            
            if (className) {
                interestFilters.push({ 'profile.interests.classes': className });
            }
            
            if (language) {
                interestFilters.push({ 'profile.interests.languages': language });
            }
            
            // Add interest filters to main query if any exist
            if (interestFilters.length > 0) {
                query.$and = interestFilters;
            }

            // Find potential matches based on filters
            let users = await this.userModel.find(query).limit(200).lean();

            // Enhanced text search filter (applied after DB query for more flexibility)
            if (search && search.trim()) {
                const searchTerms = search.toLowerCase().trim().split(/\s+/);
                users = users.filter(user => {
                    // Create a single searchable text from relevant fields
                    const searchableText = [
                        `${user.profile.firstName} ${user.profile.lastName}`,
                        user.profile.university || '',
                        user.profile.major || '',
                        user.profile.bio || '',
                        this.getAllInterestsAsString(user)
                    ].join(' ').toLowerCase();
                    
                    // Check if any search term matches
                    return searchTerms.some(term => searchableText.includes(term));
                });
            }

            // Get connection statuses in batch for efficiency
            const connectionStatuses = await this.getConnectionStatuses(
                currentUserId, 
                users.map(u => u._id.toString())
            );

            // Get stored match scores for current user
            const userWithScores = await this.userModel.findById(currentUserId, 'matchScores').lean();
            const matchScores = userWithScores.matchScores || [];
            
            // Update the flag to track if we need to save updated scores
            let updatedMatchScores = false;
            
            // Process the matches with optimized algorithm
            const potentialMatches = await Promise.all(users.map(async (user) => {
                // Find existing match score
                const existingMatch = matchScores.find(m => 
                    m.user && m.user.toString() === user._id.toString()
                );
                
                let matchScore = 0;
                let commonInterests = {
                    hobbies: [],
                    classes: [],
                    clubs: [],
                    languages: []
                };
                
                if (existingMatch) {
                    // Use existing score if it's less than 2 weeks old
                    const twoWeeksAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
                    
                    if (existingMatch.lastCalculated && new Date(existingMatch.lastCalculated) > twoWeeksAgo) {
                        matchScore = existingMatch.score;
                        // Calculate common interests only
                        commonInterests = this.findCommonInterests(currentUser, user);
                    } else {
                        // Recalculate if score is old
                        const matchData = this.calculateMatchScore(currentUser, user);
                        matchScore = matchData.score;
                        commonInterests = matchData.commonInterests;
                        
                        // Update the existing score
                        existingMatch.score = matchScore;
                        existingMatch.lastCalculated = new Date();
                        updatedMatchScores = true;
                    }
                } else {
                    // Calculate new score if not present
                    const matchData = this.calculateMatchScore(currentUser, user);
                    matchScore = matchData.score;
                    commonInterests = matchData.commonInterests;
                    
                    // Add new score to array
                    matchScores.push({
                        user: user._id,
                        score: matchScore,
                        lastCalculated: new Date()
                    });
                    updatedMatchScores = true;
                }
                
                // Get public photos
                const publicPhotos = user.profile.galleryPhotos?.filter(photo => !photo.isPrivate) || [];
                
                // Return processed match data
                return {
                    user,
                    matchScore,
                    commonInterests,
                    categories: this.getMatchCategories(currentUser, user),
                    publicPhotos,
                    hasRequestedConnection: connectionStatuses.sentRequests.includes(user._id.toString()),
                    isConnected: connectionStatuses.connectedUsers.includes(user._id.toString())
                };
            }));
            
            // Save updated match scores if needed
            if (updatedMatchScores) {
                await this.userModel.updateOne(
                    { _id: currentUserId },
                    { $set: { matchScores: matchScores } }
                );
            }

            // Sort by match score by default
            potentialMatches.sort((a, b) => b.matchScore - a.matchScore);
            
            // Apply pagination
            const totalMatches = potentialMatches.length;
            const paginatedMatches = potentialMatches.slice(skip, skip + parseInt(limit));

            // Gather unique values for filter dropdowns - more efficient implementation
            const filters = await this.getFilterOptions();

            // Create pagination info
            const totalPages = Math.ceil(totalMatches / parseInt(limit));
            const pagination = {
                page: parseInt(page),
                limit: parseInt(limit),
                totalMatches,
                totalPages,
                hasNext: parseInt(page) < totalPages,
                hasPrev: parseInt(page) > 1
            };

            // Pass structured query object for form field population
            const queryObj = {
                search: search || '',
                gender: gender || '',
                university: university || '',
                major: major || '',
                yearOfStudy: yearOfStudy || '',
                domicile: domicile || '',
                hobby: hobby || '',
                club: club || '',
                className: className || '',
                language: language || ''
            };

            res.render("matches", {
                currentUser,
                potentialMatches: paginatedMatches,
                filters,
                query: queryObj,
                pagination
            });
        } catch (error) {
            this.handleMatchError(error, req, res);
        }
    }

    // Helper to extract all interests as a single searchable string
    getAllInterestsAsString(user) {
        if (!user.profile?.interests) return '';
        
        const allInterests = [];
        const categories = ['hobbies', 'classes', 'clubs', 'languages'];
        
        categories.forEach(category => {
            if (Array.isArray(user.profile.interests[category])) {
                allInterests.push(...user.profile.interests[category]);
            }
        });
        
        return allInterests.join(' ').toLowerCase();
    }

    // Get batch connection statuses for efficiency
    async getConnectionStatuses(userId, targetUserIds) {
        try {
            // Get user with connections
            const user = await this.userModel.findById(userId, 'connections');
            if (!user || !user.connections) {
                return {
                    sentRequests: [],
                    connectedUsers: []
                };
            }
            
            // Extract sent request IDs
            const sentRequestIds = user.connections.sentRequests.map(req => 
                req.to.toString()
            );
            
            // Extract connected user IDs
            const connectedUserIds = user.connections.connected.map(conn => 
                conn.user.toString()
            );
            
            return {
                sentRequests: sentRequestIds,
                connectedUsers: connectedUserIds
            };
        } catch (error) {
            console.error("Error getting connection statuses:", error);
            return {
                sentRequests: [],
                connectedUsers: []
            };
        }
    }

    // More efficient implementation of filter options
    async getFilterOptions() {
        try {
            // Aggregate all unique values in one pass to improve performance
            const users = await this.userModel.find({
                hasProfile: true,
                hasInterests: true
            }, {
                'profile.university': 1,
                'profile.major': 1,
                'profile.interests.hobbies': 1,
                'profile.interests.clubs': 1,
                'profile.interests.classes': 1,
                'profile.interests.languages': 1
            }).limit(500);
            
            const filters = {
                universities: new Set(),
                majors: new Set(),
                hobbies: new Set(),
                clubs: new Set(),
                classes: new Set(),
                languages: new Set()
            };
            
            users.forEach(user => {
                // Add profile data
                if (user.profile?.university) filters.universities.add(user.profile.university);
                if (user.profile?.major) filters.majors.add(user.profile.major);
                
                // Add interest data
                if (user.profile?.interests?.hobbies) {
                    user.profile.interests.hobbies.forEach(item => filters.hobbies.add(item));
                }
                if (user.profile?.interests?.clubs) {
                    user.profile.interests.clubs.forEach(item => filters.clubs.add(item));
                }
                if (user.profile?.interests?.classes) {
                    user.profile.interests.classes.forEach(item => filters.classes.add(item));
                }
                if (user.profile?.interests?.languages) {
                    user.profile.interests.languages.forEach(item => filters.languages.add(item));
                }
            });
            
            // Convert Sets to sorted arrays
            return {
                universities: [...filters.universities].sort(),
                majors: [...filters.majors].sort(),
                hobbies: [...filters.hobbies].sort(),
                clubs: [...filters.clubs].sort(),
                classes: [...filters.classes].sort(),
                languages: [...filters.languages].sort()
            };
        } catch (error) {
            console.error("Error retrieving filter options:", error);
            return {
                universities: [],
                majors: [],
                hobbies: [],
                clubs: [],
                classes: [],
                languages: []
            };
        }
    }
    
    // Enhanced match score calculation
    calculateMatchScore(currentUser, potentialMatch) {
        // Initialize score variables
        let totalMatchScore = 0;
        let totalPossibleScore = 0;
        
        // Track common interests for display
        let commonInterests = {
            hobbies: [],
            classes: [],
            clubs: [],
            languages: []
        };
        
        // Category weights - can be adjusted to prioritize different interest types
        const weights = {
            hobbies: 1.0,    // Standard weight
            classes: 1.5,    // Classes are more important for study partners
            clubs: 1.2,      // Clubs show shared activities
            languages: 0.8   // Languages are useful but less critical
        };
        
        // Track category-specific scores
        let categories = {
            hobbies: { score: 0, possible: 0, percentage: 0 },
            classes: { score: 0, possible: 0, percentage: 0 },
            clubs: { score: 0, possible: 0, percentage: 0 },
            languages: { score: 0, possible: 0, percentage: 0 }
        };
        
        // Calculate match based on interests if both users have them
        if (currentUser.profile?.interests && potentialMatch.profile?.interests) {
            // Process each interest category
            for (const category of Object.keys(weights)) {
                const currentUserInterests = currentUser.profile.interests[category] || [];
                const potentialMatchInterests = potentialMatch.profile.interests[category] || [];
                
                // Skip if either user has no interests in this category
                if (currentUserInterests.length === 0) continue;
                
                // Calculate the possible score for this category (weighted)
                const possibleCategoryScore = currentUserInterests.length * weights[category];
                categories[category].possible = possibleCategoryScore;
                totalPossibleScore += possibleCategoryScore;
                
                // Find matching interests
                for (const interest of currentUserInterests) {
                    if (potentialMatchInterests.includes(interest)) {
                        // Add to common interests for display
                        commonInterests[category].push(interest);
                        
                        // Add weighted score
                        const interestScore = weights[category];
                        categories[category].score += interestScore;
                        totalMatchScore += interestScore;
                    }
                }
                
                // Calculate percentage for this category
                if (categories[category].possible > 0) {
                    categories[category].percentage = Math.round(
                        (categories[category].score / categories[category].possible) * 100
                    );
                }
            }
        }
        
        // Additional matching factors beyond interests
        
        // 1. University bonus: Same university increases match
        if (currentUser.profile?.university && 
            potentialMatch.profile?.university && 
            currentUser.profile.university === potentialMatch.profile.university) {
            totalMatchScore += 5; // Significant bonus for same university
            totalPossibleScore += 5;
        }
        
        // 2. Study year proximity: Closer study years may indicate more compatible academic needs
        if (currentUser.profile?.yearOfStudy && potentialMatch.profile?.yearOfStudy) {
            const yearDiff = Math.abs(
                parseInt(currentUser.profile.yearOfStudy) - 
                parseInt(potentialMatch.profile.yearOfStudy)
            );
            
            if (yearDiff === 0) {
                totalMatchScore += 3; // Same year
            } else if (yearDiff === 1) {
                totalMatchScore += 1.5; // Adjacent year
            }
            totalPossibleScore += 3; // Maximum possible is same year
        }
        
        // 3. Geographic proximity: Same location is convenient for meeting
        if (currentUser.profile?.domicile && 
            potentialMatch.profile?.domicile && 
            currentUser.profile.domicile === potentialMatch.profile.domicile) {
            totalMatchScore += 3; // Same city/area
            totalPossibleScore += 3;
        }
        
        // 4. Activity level and profile completeness (if tracked)
        // More active users with complete profiles get small boost
        if (potentialMatch.profile?.photo) {
            totalMatchScore += 1; // Has profile photo
            totalPossibleScore += 1;
        }
        
        if (potentialMatch.profile?.galleryPhotos?.length > 0) {
            totalMatchScore += 1; // Has gallery photos
            totalPossibleScore += 1;
        }
        
        if (potentialMatch.profile?.bio && potentialMatch.profile.bio.length > 30) {
            totalMatchScore += 1; // Has detailed bio
            totalPossibleScore += 1;
        }
        
        // Calculate overall match percentage
        const matchPercentage = totalPossibleScore > 0 
            ? Math.min(Math.round((totalMatchScore / totalPossibleScore) * 100), 100) 
            : 0;
        
        return {
            score: matchPercentage,
            commonInterests,
            categories
        };
    }

    // Helper to find common interests
    findCommonInterests(user1, user2) {
        const commonInterests = {
            hobbies: [],
            classes: [],
            clubs: [],
            languages: []
        };
        
        if (user1.profile?.interests && user2.profile?.interests) {
            // Process each interest category
            for (const category of Object.keys(commonInterests)) {
                const user1Interests = user1.profile.interests[category] || [];
                const user2Interests = user2.profile.interests[category] || [];
                
                commonInterests[category] = user1Interests.filter(interest => 
                    user2Interests.includes(interest)
                );
            }
        }
        
        return commonInterests;
    }

    // Helper to get match categories
    getMatchCategories(user1, user2) {
        const categories = {
            hobbies: { score: 0, possible: 0, percentage: 0 },
            classes: { score: 0, possible: 0, percentage: 0 },
            clubs: { score: 0, possible: 0, percentage: 0 },
            languages: { score: 0, possible: 0, percentage: 0 }
        };
        
        const weights = {
            hobbies: 1.0,
            classes: 1.5,
            clubs: 1.2,
            languages: 0.8
        };
        
        if (user1.profile?.interests && user2.profile?.interests) {
            for (const category of Object.keys(weights)) {
                const user1Interests = user1.profile.interests[category] || [];
                const user2Interests = user2.profile.interests[category] || [];
                
                if (user1Interests.length === 0) continue;
                
                // Calculate the possible score
                categories[category].possible = user1Interests.length * weights[category];
                
                // Calculate the actual score
                for (const interest of user1Interests) {
                    if (user2Interests.includes(interest)) {
                        categories[category].score += weights[category];
                    }
                }
                
                // Calculate percentage
                if (categories[category].possible > 0) {
                    categories[category].percentage = Math.round(
                        (categories[category].score / categories[category].possible) * 100
                    );
                }
            }
        }
        
        return categories;
    }

    // Helper to check if a user has sent a connection request to another user
    async hasRequestedConnection(senderId, recipientId) {
        try {
            const sender = await this.userModel.findById(senderId, 'connections.sentRequests');
            if (!sender || !sender.connections || !sender.connections.sentRequests) {
                return false;
            }

            return sender.connections.sentRequests.some(req => 
                req.to.toString() === recipientId.toString()
            );
        } catch (error) {
            console.error("Error checking connection request:", error);
            return false;
        }
    }
    
    // Helper to check if two users are already connected
    async areConnected(userId1, userId2) {
        try {
            const user = await this.userModel.findById(userId1, 'connections.connected');
            if (!user || !user.connections || !user.connections.connected) {
                return false;
            }

            return user.connections.connected.some(conn => 
                conn.user.toString() === userId2.toString()
            );
        } catch (error) {
            console.error("Error checking connection status:", error);
            return false;
        }
    }
    
    // Improved connection request handling
    async sendConnectionRequest(req, res) {
        try {
            const currentUserId = req.session.userId;
            const targetUserId = req.params.userId;
            
            if (!currentUserId || !targetUserId) {
                return res.status(400).json({ success: false, error: 'Invalid request' });
            }
            
            // Use transactions for data consistency
            const session = await mongoose.startSession();
            session.startTransaction();
            
            try {
                // Find both users within the transaction
                const [currentUser, targetUser] = await Promise.all([
                    this.userModel.findById(currentUserId).session(session),
                    this.userModel.findById(targetUserId).session(session)
                ]);
                
                if (!currentUser || !targetUser) {
                    await session.abortTransaction();
                    session.endSession();
                    return res.status(404).json({ success: false, error: 'User not found' });
                }
                
                // Check if connection already exists or is pending
                if (!currentUser.connections) {
                    currentUser.connections = { sentRequests: [], receivedRequests: [], connected: [] };
                }
                
                if (!targetUser.connections) {
                    targetUser.connections = { sentRequests: [], receivedRequests: [], connected: [] };
                }
                
                // Check if already connected
                const alreadyConnected = currentUser.connections.connected.some(
                    conn => conn.user.toString() === targetUserId
                );
                
                if (alreadyConnected) {
                    await session.abortTransaction();
                    session.endSession();
                    return res.status(400).json({ success: false, error: 'Already connected' });
                }
                
                // Check if request already sent
                const alreadySent = currentUser.connections.sentRequests.some(
                    req => req.to.toString() === targetUserId
                );
                
                if (alreadySent) {
                    await session.abortTransaction();
                    session.endSession();
                    return res.status(400).json({ success: false, error: 'Request already sent' });
                }
                
                // Check if request already received (auto-connect in this case)
                const requestReceivedIndex = currentUser.connections.receivedRequests.findIndex(
                    req => req.from.toString() === targetUserId
                );
                
                if (requestReceivedIndex >= 0) {
                    // Auto-accept this connection since both users have requested it
                    
                    // Remove from received requests
                    const receivedRequest = currentUser.connections.receivedRequests.splice(requestReceivedIndex, 1)[0];
                    
                    // Find and remove from target's sent requests
                    const sentRequestIndex = targetUser.connections.sentRequests.findIndex(
                        req => req.to.toString() === currentUserId
                    );
                    
                    if (sentRequestIndex >= 0) {
                        targetUser.connections.sentRequests.splice(sentRequestIndex, 1);
                    }
                    
                    // Add to both users' connected lists
                    const now = new Date();
                    
                    currentUser.connections.connected.push({
                        user: targetUserId,
                        connectedAt: now,
                        updatedAt: now
                    });
                    
                    targetUser.connections.connected.push({
                        user: currentUserId,
                        connectedAt: now,
                        updatedAt: now
                    });
                    
                    // Save both users
                    await Promise.all([
                        currentUser.save({ session }),
                        targetUser.save({ session })
                    ]);
                    
                    // Commit transaction
                    await session.commitTransaction();
                    session.endSession();
                    
                    // Return success with connected status
                    return res.status(200).json({ 
                        success: true, 
                        message: 'You are now connected!',
                        status: 'connected'
                    });
                }
                
                // Normal case - add connection request
                currentUser.connections.sentRequests.push({
                    to: targetUserId,
                    requestedAt: new Date()
                });
                
                targetUser.connections.receivedRequests.push({
                    from: currentUserId,
                    requestedAt: new Date()
                });
                
                // Save both users
                await Promise.all([
                    currentUser.save({ session }),
                    targetUser.save({ session })
                ]);
                
                // Commit transaction
                await session.commitTransaction();
                session.endSession();
                
                // Return success
                return res.status(200).json({ 
                    success: true, 
                    message: 'Connection request sent',
                    status: 'requested'
                });
            } catch (error) {
                // If an error occurred, abort the transaction
                await session.abortTransaction();
                session.endSession();
                throw error;
            }
        } catch (error) {
            return this.handleMatchError(error, req, res);
        }
    }

    // Refresh matches route
    async refreshMatches(req, res) {
        try {
            // Redirect to matches page to refresh the data
            res.redirect('/matches');
        } catch (error) {
            console.error("Error refreshing matches:", error);
            res.status(500).json({ success: false, error: 'Failed to refresh matches' });
        }
    }

    // Background task to update match scores
    async updateUserMatchScores(userId) {
        try {
            // Get the user
            const currentUser = await this.userModel.findById(userId);
            if (!currentUser || !currentUser.hasProfile || !currentUser.hasInterests) {
                return false;
            }
            
            // Find all potential matches
            const potentialMatches = await this.userModel.find({
                _id: { $ne: userId },
                hasProfile: true,
                hasInterests: true
            }).limit(100);
            
            // Initialize matchScores array if it doesn't exist
            if (!currentUser.matchScores) {
                currentUser.matchScores = [];
            }
            
            // Calculate match scores with all users
            for (const potentialMatch of potentialMatches) {
                // Calculate match score
                const matchData = this.calculateMatchScore(currentUser, potentialMatch);
                
                // Find existing match entry
                const existingMatchIndex = currentUser.matchScores.findIndex(
                    match => match.user.toString() === potentialMatch._id.toString()
                );
                
                // Continuing matchController.js

                if (existingMatchIndex >= 0) {
                    // Update existing score
                    currentUser.matchScores[existingMatchIndex].score = matchData.score;
                    currentUser.matchScores[existingMatchIndex].lastCalculated = new Date();
                } else {
                    // Add new score
                    currentUser.matchScores.push({
                        user: potentialMatch._id,
                        score: matchData.score,
                        lastCalculated: new Date()
                    });
                }
            }
            
            // Save updated user with match scores
            await currentUser.save();
            return true;
        } catch (error) {
            console.error("Error updating match scores:", error);
            return false;
        }
    }

    // Invalidate old match scores
    async invalidateOldMatchScores() {
        try {
            const TWO_WEEKS = 14 * 24 * 60 * 60 * 1000; // 14 days in milliseconds
            const cutoffDate = new Date(Date.now() - TWO_WEEKS);
            
            // Remove match scores older than two weeks
            await this.userModel.updateMany(
                { 'matchScores.lastCalculated': { $lt: cutoffDate } },
                { $pull: { matchScores: { lastCalculated: { $lt: cutoffDate } } } }
            );
            
            console.log('Old match scores invalidated successfully');
            return true;
        } catch (error) {
            console.error('Error invalidating old match scores:', error);
            return false;
        }
    }

    // Get recommended matches for dashboard
    async getRecommendedMatches(userId, limit = 3) {
        try {
            const user = await this.userModel.findById(userId);
            if (!user || !user.hasInterests) {
                return [];
            }
            
            // Check if we have stored match scores
            if (user.matchScores && user.matchScores.length > 0) {
                // Get user IDs from top match scores
                const topMatchUserIds = user.matchScores
                    .sort((a, b) => b.score - a.score)
                    .slice(0, limit * 2) // Get more than needed in case some are filtered out
                    .map(match => match.user);
                
                // Load the actual user documents
                const matchedUsers = await this.userModel.find({
                    _id: { $in: topMatchUserIds },
                    hasProfile: true,
                    hasInterests: true
                });
                
                // Process matched users
                const recommendedMatches = matchedUsers.map(matchedUser => {
                    // Find the match score from the stored data
                    const matchData = user.matchScores.find(
                        m => m.user.toString() === matchedUser._id.toString()
                    );
                    
                    // Count common interests
                    let commonInterestsCount = 0;
                    if (user.profile.interests && matchedUser.profile.interests) {
                        ['hobbies', 'classes', 'clubs', 'languages'].forEach(category => {
                            if (user.profile.interests[category] && matchedUser.profile.interests[category]) {
                                const common = user.profile.interests[category].filter(
                                    item => matchedUser.profile.interests[category].includes(item)
                                );
                                commonInterestsCount += common.length;
                            }
                        });
                    }
                    
                    return {
                        user: matchedUser,
                        matchScore: matchData.score,
                        commonInterestsCount
                    };
                });
                
                // Sort by match score and limit
                return recommendedMatches
                    .sort((a, b) => b.matchScore - a.matchScore)
                    .slice(0, limit);
            }
            
            // Fallback to direct calculation if no stored scores
            return await this.calculateRecommendedMatches(user, limit);
        } catch (error) {
            console.error('Error getting recommended matches:', error);
            return [];
        }
    }

    // Calculate recommended matches directly (fallback)
    async calculateRecommendedMatches(user, limit = 3) {
        try {
            // Find potential matches
            const potentialMatches = await this.userModel.find({
                _id: { $ne: user._id },
                hasProfile: true,
                hasInterests: true
            }).limit(50);

            const recommendedMatches = potentialMatches.map(potentialUser => {
                let matchScore = 0;
                let commonInterestsCount = 0;
                
                // Calculate match score based on interests
                if (user.profile.interests && potentialUser.profile.interests) {
                    const matchData = this.calculateMatchScore(user, potentialUser);
                    matchScore = matchData.score;
                    
                    // Count common interests
                    Object.values(matchData.commonInterests).forEach(category => {
                        commonInterestsCount += category.length;
                    });
                }
                
                return {
                    user: potentialUser,
                    matchScore: matchScore,
                    commonInterestsCount: commonInterestsCount
                };
            });

            // Sort by match score and limit
            return recommendedMatches
                .sort((a, b) => b.matchScore - a.matchScore)
                .slice(0, limit);
        } catch (error) {
            console.error('Error calculating recommended matches:', error);
            return [];
        }
    }

    // Centralized error handler for match-related errors
    handleMatchError(error, req, res, redirectUrl = '/matches') {
        console.error('Match error:', error);
        
        // Determine error type
        let errorMessage = 'An error occurred while processing your request.';
        let statusCode = 500;
        
        if (error.name === 'ValidationError') {
            errorMessage = 'Invalid data provided: ' + Object.values(error.errors).map(e => e.message).join(', ');
            statusCode = 400;
        } else if (error.name === 'CastError') {
            errorMessage = 'Invalid ID format.';
            statusCode = 400;
        } else if (error.code === 11000) {
            errorMessage = 'Duplicate key error.';
            statusCode = 400;
        } else if (error.message.includes('not found')) {
            errorMessage = error.message;
            statusCode = 404;
        }
        
        // Different response based on request type
        if (req.xhr || (req.headers.accept && req.headers.accept.includes('application/json'))) {
            return res.status(statusCode).json({
                success: false,
                error: errorMessage
            });
        } else {
            return res.redirect(`${redirectUrl}?error=${encodeURIComponent(errorMessage)}`);
        }
    }
}

module.exports = new MatchController();