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

            // Add filter to exclude rejected users
            if (currentUser.rejectedUsers && currentUser.rejectedUsers.length > 0) {
                const rejectedIds = currentUser.rejectedUsers.map(r => r.user.toString());
                query._id = { 
                    $ne: currentUserId,
                    $nin: rejectedIds 
                };
            }

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
            const potentialMatches = [];
            
            for (const user of users) {
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

                // Only include users with 65%+ match score
                if (matchScore >= 30) {
                    // Calculate category-specific compatibility scores
                    const categories = this.getMatchCategories(currentUser, user);
                    
                    // Get public photos
                    const publicPhotos = user.profile.galleryPhotos?.filter(photo => !photo.isPrivate) || [];
                    
                    // Determine if the user is online (active in the last 5 minutes)
                    const isOnline = user.lastActive && 
                        (new Date() - new Date(user.lastActive)) < 5 * 60 * 1000;
                    
                    // Add to potential matches
                    potentialMatches.push({
                        user,
                        matchScore,
                        commonInterests,
                        categories,
                        publicPhotos,
                        hasRequestedConnection: connectionStatuses.sentRequests.includes(user._id.toString()),
                        isConnected: connectionStatuses.connectedUsers.includes(user._id.toString()),
                        isOnline: isOnline,
                        lastActive: user.lastActive
                    });
                }
            }
            
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

            // Add a flag to indicate if we have any matches meeting the 65% threshold
            const hasQualityMatches = totalMatches > 0;

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
                pagination,
                hasQualityMatches,
                matchThreshold: 30 // Pass the threshold to the view
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
                'profile.domicile': 1,
                'profile.interests.hobbies': 1,
                'profile.interests.clubs': 1,
                'profile.interests.classes': 1,
                'profile.interests.languages': 1
            }).limit(500);
            
            const filters = {
                universities: new Set(),
                majors: new Set(),
                domiciles: new Set(),
                hobbies: new Set(),
                clubs: new Set(),
                classes: new Set(),
                languages: new Set()
            };
            
            users.forEach(user => {
                // Add profile data
                if (user.profile?.university) filters.universities.add(user.profile.university);
                if (user.profile?.major) filters.majors.add(user.profile.major);
                if (user.profile?.domicile) filters.domiciles.add(user.profile.domicile);
                
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
                domiciles: [...filters.domiciles].sort(),
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
                domiciles: [],
                hobbies: [],
                clubs: [],
                classes: [],
                languages: []
            };
        }
    }

    // Enhanced match score calculation with 65% threshold
    calculateMatchScore(currentUser, potentialMatch) {
        // Initialize score tracking
        let totalMatchScore = 0;
        let totalPossibleScore = 0;
        
        // Detailed scoring weights and categories
        const weights = {
            // Interest Categories
            hobbies: { weight: 1.2, max: 15 },
            classes: { weight: 1.5, max: 20 },
            clubs: { weight: 1.3, max: 15 },
            languages: { weight: 1.0, max: 10 },
            
            // Profile Factors
            university: { weight: 2.0, max: 20 },
            major: { weight: 1.8, max: 18 },
            yearOfStudy: { weight: 1.5, max: 15 },
            domicile: { weight: 1.5, max: 15 },
            nationality: { weight: 1.2, max: 12 },
            
            // Additional Factors
            profileCompleteness: { weight: 1.0, max: 10 }
        };
        
        // Track common interests
        let commonInterests = {
            hobbies: [],
            classes: [],
            clubs: [],
            languages: []
        };
        
        // Category-specific scores
        let categories = {
            hobbies: { score: 0, possible: 0, percentage: 0 },
            classes: { score: 0, possible: 0, percentage: 0 },
            clubs: { score: 0, possible: 0, percentage: 0 },
            languages: { score: 0, possible: 0, percentage: 0 },
            university: { score: 0, possible: 0, percentage: 0 },
            major: { score: 0, possible: 0, percentage: 0 },
            yearOfStudy: { score: 0, possible: 0, percentage: 0 },
            domicile: { score: 0, possible: 0, percentage: 0 },
            nationality: { score: 0, possible: 0, percentage: 0 }
        };
        
        // Validate user profiles
        if (!currentUser.profile || !potentialMatch.profile) {
            return {
                score: 0,
                commonInterests: commonInterests,
                categories: categories
            };
        }
        
        // Interest Matching
        const interestCategories = ['hobbies', 'classes', 'clubs', 'languages'];
        interestCategories.forEach(category => {
            const currentInterests = currentUser.profile.interests?.[category] || [];
            const potentialInterests = potentialMatch.profile.interests?.[category] || [];
            
            if (currentInterests.length > 0) {
                // Calculate possible score for this category
                const possibleCategoryScore = currentInterests.length * weights[category].weight;
                categories[category].possible = possibleCategoryScore;
                totalPossibleScore += possibleCategoryScore;
                
                // Find matching interests
                const matchingInterests = currentInterests.filter(interest => 
                    potentialInterests.includes(interest)
                );
                
                // Store common interests
                if (matchingInterests.length > 0) {
                    commonInterests[category] = matchingInterests;
                    
                    // Calculate score for matching interests
                    const matchScore = matchingInterests.length * weights[category].weight;
                    categories[category].score = matchScore;
                    totalMatchScore += matchScore;
                }
            }
        });
        
        // University Matching
        if (currentUser.profile.university && potentialMatch.profile.university) {
            const universityScore = currentUser.profile.university === potentialMatch.profile.university 
                ? weights.university.max 
                : 0;
            
            categories.university.score = universityScore;
            categories.university.possible = weights.university.max;
            totalMatchScore += universityScore;
            totalPossibleScore += weights.university.max;
        }
        
        // Major Matching
        if (currentUser.profile.major && potentialMatch.profile.major) {
            const majorScore = currentUser.profile.major === potentialMatch.profile.major 
                ? weights.major.max 
                : (0.5 * weights.major.max);
            
            categories.major.score = majorScore;
            categories.major.possible = weights.major.max;
            totalMatchScore += majorScore;
            totalPossibleScore += weights.major.max;
        }
        
        // Study Year Proximity
        if (currentUser.profile.yearOfStudy && potentialMatch.profile.yearOfStudy) {
            const yearDiff = Math.abs(
                parseInt(currentUser.profile.yearOfStudy) - 
                parseInt(potentialMatch.profile.yearOfStudy)
            );
            
            let yearScore = 0;
            if (yearDiff === 0) {
                yearScore = weights.yearOfStudy.max; // Same year
            } else if (yearDiff === 1) {
                yearScore = 0.7 * weights.yearOfStudy.max; // Adjacent year
            } else if (yearDiff <= 2) {
                yearScore = 0.4 * weights.yearOfStudy.max; // Close years
            }
            
            categories.yearOfStudy.score = yearScore;
            categories.yearOfStudy.possible = weights.yearOfStudy.max;
            totalMatchScore += yearScore;
            totalPossibleScore += weights.yearOfStudy.max;
        }
        
        // Domicile Matching
        if (currentUser.profile.domicile && potentialMatch.profile.domicile) {
            const domicileScore = currentUser.profile.domicile === potentialMatch.profile.domicile 
                ? weights.domicile.max 
                : 0;
            
            categories.domicile.score = domicileScore;
            categories.domicile.possible = weights.domicile.max;
            totalMatchScore += domicileScore;
            totalPossibleScore += weights.domicile.max;
        }
        
        // Nationality Matching
        if (currentUser.profile.nationality && potentialMatch.profile.nationality) {
            const nationalityScore = currentUser.profile.nationality === potentialMatch.profile.nationality 
                ? weights.nationality.max 
                : 0;
            
            categories.nationality.score = nationalityScore;
            categories.nationality.possible = weights.nationality.max;
            totalMatchScore += nationalityScore;
            totalPossibleScore += weights.nationality.max;
        }
        
        // Profile Completeness Bonus
        const profileCompletenessScore = this.calculateProfileCompletenessScore(potentialMatch);
        totalMatchScore += profileCompletenessScore;
        totalPossibleScore += weights.profileCompleteness.max;
        
        // Calculate overall match percentage
        const matchPercentage = totalPossibleScore > 0 
            ? Math.min(Math.round((totalMatchScore / totalPossibleScore) * 100), 100) 
            : 0;
        
        // Return results, filtering out users below 65%
        return matchPercentage >= 30 ? {
            score: matchPercentage,
            commonInterests,
            categories
        } : {
            score: 0,
            commonInterests: { hobbies: [], classes: [], clubs: [], languages: [] },
            categories: {}
        };
    }

    // Helper function to calculate profile completeness
    calculateProfileCompletenessScore(user) {
        const profileCompleteness = {
            photo: user.profile?.photo ? 2 : 0,
            bio: user.profile?.bio && user.profile.bio.length > 30 ? 2 : 0,
            fullName: user.profile?.firstName && user.profile?.lastName ? 2 : 0,
            university: user.profile?.university ? 1 : 0,
            major: user.profile?.major ? 1 : 0,
            yearOfStudy: user.profile?.yearOfStudy ? 1 : 0,
            domicile: user.profile?.domicile ? 1 : 0
        };
        
        const completenessScore = Object.values(profileCompleteness).reduce((a, b) => a + b, 0);
        return completenessScore;
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

    // Get recommended matches for dashboard with 65% threshold
    async getRecommendedMatches(userId, limit = 3) {
        try {
            const user = await this.userModel.findById(userId);
            if (!user || !user.hasInterests) {
                return [];
            }
            
            // Check if user has rejected users to exclude
            let rejectedIds = [];
            if (user.rejectedUsers && user.rejectedUsers.length > 0) {
                rejectedIds = user.rejectedUsers.map(r => r.user.toString());
            }
            
            // Check if we have stored match scores
            if (user.matchScores && user.matchScores.length > 0) {
                // Get user IDs from top match scores, excluding rejected users and ensuring 65%+ match
                const topMatchUserIds = user.matchScores
                    .filter(match => !rejectedIds.includes(match.user.toString()) && match.score >= 30)
                    .sort((a, b) => b.score - a.score)
                    .slice(0, limit * 2) // Get more than needed in case some are filtered out
                    .map(match => match.user);
                
                // If no qualifying matches found, return empty array
                if (topMatchUserIds.length === 0) {
                    return [];
                }
                
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
                    const commonInterests = { hobbies: [], classes: [], clubs: [], languages: [] };
                    
                    if (user.profile.interests && matchedUser.profile.interests) {
                        ['hobbies', 'classes', 'clubs', 'languages'].forEach(category => {
                            if (user.profile.interests[category] && matchedUser.profile.interests[category]) {
                                const common = user.profile.interests[category].filter(
                                    item => matchedUser.profile.interests[category].includes(item)
                                );
                                commonInterests[category] = common;
                                commonInterestsCount += common.length;
                            }
                        });
                    }
                    
                    return {
                        user: matchedUser,
                        matchScore: matchData.score,
                        commonInterestsCount,
                        commonInterests
                    };
                });
                
                // Double-check the 65% threshold and sort by match score
                return recommendedMatches
                    .filter(match => match.matchScore >= 30)
                    .sort((a, b) => b.matchScore - a.matchScore)
                    .slice(0, limit);
            }
            
            // Fallback to direct calculation if no stored scores
            return await this.calculateRecommendedMatches(user, limit, rejectedIds);
        } catch (error) {
            console.error('Error getting recommended matches:', error);
            return [];
        }
    }

    // Calculate recommended matches directly (fallback)
    async calculateRecommendedMatches(user, limit = 3, rejectedIds = []) {
        try {
            // Find potential matches
            const query = {
                _id: { $ne: user._id },
                hasProfile: true,
                hasInterests: true
            };
            
            // Exclude rejected users
            if (rejectedIds.length > 0) {
                query._id.$nin = rejectedIds;
            }
            
            const potentialMatches = await this.userModel.find(query).limit(50);

            const recommendedMatches = [];
            
            // Calculate match scores and only include those with 65%+ similarity
            for (const potentialUser of potentialMatches) {
                // Calculate match score based on interests
                if (user.profile.interests && potentialUser.profile.interests) {
                    const matchData = this.calculateMatchScore(user, potentialUser);
                    
                    // Only consider matches with 65%+ similarity
                    if (matchData.score >= 30) {
                        // Count common interests
                        let commonInterestsCount = 0;
                        Object.values(matchData.commonInterests).forEach(category => {
                            commonInterestsCount += category.length;
                        });
                        
                        recommendedMatches.push({
                            user: potentialUser,
                            matchScore: matchData.score,
                            commonInterestsCount: commonInterestsCount,
                            commonInterests: matchData.commonInterests
                        });
                    }
                }
            }

            // Sort by match score and limit
            return recommendedMatches
                .sort((a, b) => b.matchScore - a.matchScore)
                .slice(0, limit);
        } catch (error) {
            console.error('Error calculating recommended matches:', error);
            return [];
        }
    }

    // Improved connection request handling
    async sendConnectionRequest(req, res) {
        try {
            const currentUserId = req.session.userId;
            const targetUserId = req.params.userId;
            
            // Validate inputs
            if (!mongoose.Types.ObjectId.isValid(targetUserId)) {
                return res.status(400).json({ success: false, error: 'Invalid user ID' });
            }
            
            // Get both users
            const [currentUser, targetUser] = await Promise.all([
                this.userModel.findById(currentUserId),
                this.userModel.findById(targetUserId)
            ]);
            
            if (!currentUser || !targetUser) {
                return res.status(404).json({ success: false, error: 'User not found' });
            }
            
            // Calculate match score to validate it's at least 65%
            const matchData = this.calculateMatchScore(currentUser, targetUser);
            
            // Ensure the match score is at least 65%
            if (matchData.score < 30) {
                return res.status(400).json({ 
                    success: false, 
                    error: 'Connection requests can only be sent to users with a 30% or higher match score' 
                });
            }
            
            // Add validation for request limit to prevent spamming
            if (currentUser.connections?.sentRequests?.length > 50) {
                return res.status(400).json({ 
                    success: false, 
                    error: 'Maximum pending request limit reached (50). Please wait for some responses before sending more requests.'
                });
            }
            
            // Initialize connections if not present
            if (!currentUser.connections) {
                currentUser.connections = { sentRequests: [], receivedRequests: [], connected: [] };
            }
            
            if (!targetUser.connections) {
                targetUser.connections = { sentRequests: [], receivedRequests: [], connected: [] };
            }
            
            // Check if already connected
            const alreadyConnected = currentUser.connections.connected.some(conn => 
                conn.user.toString() === targetUserId
            );
            
            if (alreadyConnected) {
                return res.status(400).json({ success: false, error: 'Already connected with this user' });
            }
            
// Check if request already sent
const alreadySent = currentUser.connections.sentRequests.some(req => 
    req.to.toString() === targetUserId
);

if (alreadySent) {
    return res.status(400).json({ success: false, error: 'Request already sent' });
}

// Check if already received a request from this user (auto-connect)
const receivedRequest = currentUser.connections.receivedRequests.find(req => 
    req.from.toString() === targetUserId
);

if (receivedRequest) {
    // Auto-connect since both users have requested to connect
    
    // Remove from pending requests
    currentUser.connections.receivedRequests = currentUser.connections.receivedRequests.filter(req => 
        req.from.toString() !== targetUserId
    );
    
    // Remove from target's sent requests
    targetUser.connections.sentRequests = targetUser.connections.sentRequests.filter(req => 
        req.to.toString() !== currentUserId
    );
    
    // Add to both users' connected lists
    const now = new Date();
    
    currentUser.connections.connected.push({
        user: targetUserId,
        connectedAt: now,
        updatedAt: now,
        matchScore: matchData.score,
        commonInterests: matchData.commonInterests
    });
    
    targetUser.connections.connected.push({
        user: currentUserId,
        connectedAt: now,
        updatedAt: now,
        matchScore: matchData.score,
        commonInterests: matchData.commonInterests
    });
    
    // Initialize conversation
    await this.initializeConversation(currentUserId, targetUserId, matchData);
    
    // Save both users
    await Promise.all([
        currentUser.save(),
        targetUser.save()
    ]);
    
    return res.status(200).json({ 
        success: true, 
        message: 'You are now connected!',
        status: 'connected'
    });
}

// Create new connection request
const now = new Date();

// Add to sent requests
currentUser.connections.sentRequests.push({
    to: targetUserId,
    requestedAt: now
});

// Add to received requests
targetUser.connections.receivedRequests.push({
    from: currentUserId,
    requestedAt: now
});

// Add notification for target user
if (!targetUser.notifications) targetUser.notifications = [];

targetUser.notifications.push({
    type: 'connection_request',
    from: currentUserId,
    message: `${currentUser.profile.firstName} sent you a connection request!`,
    read: false,
    timestamp: now
});

// Save both users
await Promise.all([
    currentUser.save(),
    targetUser.save()
]);

return res.status(200).json({ 
    success: true, 
    message: 'Connection request sent',
    status: 'requested'
});

} catch (error) {
console.error('Error sending connection request:', error);
return res.status(500).json({ success: false, error: 'Server error' });
}
}

// Initialize a conversation between two users
async initializeConversation(user1Id, user2Id, matchData) {
try {
const [user1, user2] = await Promise.all([
    this.userModel.findById(user1Id),
    this.userModel.findById(user2Id)
]);

if (!user1 || !user2) return false;

// Create welcome message with personalized suggestion based on match
let welcomeMessage = "You are now connected! Start a conversation.";

// Add personalized starter if common interests exist
if (matchData && matchData.commonInterests) {
    const commonInterests = matchData.commonInterests;
    if (commonInterests.classes && commonInterests.classes.length > 0) {
        welcomeMessage = `You are now connected! You both are taking ${commonInterests.classes[0]}. Maybe you could discuss that?`;
    } else if (commonInterests.hobbies && commonInterests.hobbies.length > 0) {
        welcomeMessage = `You are now connected! You both enjoy ${commonInterests.hobbies[0]}. Why not start a conversation about that?`;
    }
}

// Initialize conversation for user1
if (!user1.conversations) user1.conversations = [];

// Check if conversation already exists
const existingConv1 = user1.conversations.find(conv => 
    conv.participants && conv.participants.includes(user2Id.toString())
);

if (!existingConv1) {
    user1.conversations.push({
        participants: [user1Id.toString(), user2Id.toString()],
        messages: [{
            sender: 'system',
            content: welcomeMessage,
            timestamp: new Date()
        }],
        createdAt: new Date(),
        lastUpdated: new Date(),
        matchScore: matchData?.score || 0
    });
    
    await user1.save();
}

// Initialize conversation for user2
if (!user2.conversations) user2.conversations = [];

const existingConv2 = user2.conversations.find(conv => 
    conv.participants && conv.participants.includes(user1Id.toString())
);

if (!existingConv2) {
    user2.conversations.push({
        participants: [user2Id.toString(), user1Id.toString()],
        messages: [{
            sender: 'system',
            content: welcomeMessage,
            timestamp: new Date()
        }],
        createdAt: new Date(),
        lastUpdated: new Date(),
        matchScore: matchData?.score || 0
    });
    
    await user2.save();
}

return true;
} catch (error) {
console.error('Error initializing conversation:', error);
return false;
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

// Find all potential matches excluding rejected users
const query = {
    _id: { $ne: userId },
    hasProfile: true,
    hasInterests: true
};

// Add filter to exclude rejected users
if (currentUser.rejectedUsers && currentUser.rejectedUsers.length > 0) {
    const rejectedIds = currentUser.rejectedUsers.map(r => r.user.toString());
    query._id.$nin = rejectedIds;
}

const potentialMatches = await this.userModel.find(query).limit(100);

// Initialize matchScores array if it doesn't exist
if (!currentUser.matchScores) {
    currentUser.matchScores = [];
}

// Calculate match scores with all users
for (const potentialMatch of potentialMatches) {
    // Calculate match score
    const matchData = this.calculateMatchScore(currentUser, potentialMatch);
    
    // Only store matches with 65%+ similarity
    if (matchData.score >= 30) {
        // Find existing match entry
        const existingMatchIndex = currentUser.matchScores.findIndex(
            match => match.user.toString() === potentialMatch._id.toString()
        );
        
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
    } else {
        // Remove any existing match scores below 65%
        const existingMatchIndex = currentUser.matchScores.findIndex(
            match => match.user.toString() === potentialMatch._id.toString()
        );
        
        if (existingMatchIndex >= 0) {
            currentUser.matchScores.splice(existingMatchIndex, 1);
        }
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

// Refresh matches route
async refreshMatches(req, res) {
try {
// Clear match scores to force recalculation
await this.userModel.updateOne(
    { _id: req.session.userId },
    { $set: { matchScores: [] } }
);

// Redirect to matches page to refresh the data
res.redirect('/matches');
} catch (error) {
console.error("Error refreshing matches:", error);
res.status(500).json({ success: false, error: 'Failed to refresh matches' });
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