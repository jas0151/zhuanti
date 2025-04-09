const mongoose = require('mongoose');
const csv = require('csv-parser');
const fs = require('fs');
const bcrypt = require('bcrypt');

// Direct database connection
async function connectDB() {
    try {
        await mongoose.connect('mongodb://localhost:27017/LoginSignupdb', {
            useNewUrlParser: true,
            useUnifiedTopology: true
        });
        console.log('MongoDB connected successfully');
        return mongoose.connection;
    } catch (error) {
        console.error('MongoDB connection error:', error);
        process.exit(1);
    }
}

// Manual user creation function
async function createUser(userData) {
    try {
        // Manually create user document
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(userData.password || 'CampusMatch2024!', salt);

        const userDocument = {
            name: userData.name,
            email: userData.email,
            password: hashedPassword,
            profile: {
                firstName: userData.firstName || userData.name.split(' ')[0],
                lastName: userData.lastName || userData.name.split(' ')[1] || '',
                university: userData.university || '',
                major: userData.major || '',
                yearOfStudy: userData.yearOfStudy || '',
                domicile: userData.domicile || '',
                nationality: userData.nationality || '',
                interests: {
                    hobbies: userData.hobbies ? userData.hobbies.split(',').map(h => h.trim()) : [],
                    classes: userData.classes ? userData.classes.split(',').map(c => c.trim()) : [],
                    clubs: userData.clubs ? userData.clubs.split(',').map(c => c.trim()) : [],
                    languages: userData.languages ? userData.languages.split(',').map(l => l.trim()) : []
                }
            },
            hasProfile: true,
            hasInterests: !!(userData.hobbies || userData.classes || userData.clubs || userData.languages)
        };

        // Insert directly into the collection
        const result = await mongoose.connection.db.collection('logincollections').insertOne(userDocument);
        
        console.log(`User created with ID: ${result.insertedId}`);
        return result;
    } catch (error) {
        console.error('Error creating user:', error);
        throw error;
    }
}

// Main import function
async function importUsersFromCSV(filePath) {
    // Connect to database
    await connectDB();

    // Read CSV
    return new Promise((resolve, reject) => {
        const results = [];

        fs.createReadStream(filePath)
            .pipe(csv())
            .on('data', (data) => results.push(data))
            .on('end', async () => {
                console.log(`Total users to import: ${results.length}`);
                
                const importResults = {
                    total: results.length,
                    successful: 0,
                    failed: 0,
                    errors: []
                };

                for (const userData of results) {
                    try {
                        // Check for existing user
                        const existingUser = await mongoose.connection.db.collection('logincollections')
                            .findOne({ email: userData.email });

                        if (existingUser) {
                            console.log(`User with email ${userData.email} already exists. Skipping.`);
                            importResults.failed++;
                            importResults.errors.push({
                                email: userData.email,
                                error: 'User already exists'
                            });
                            continue;
                        }

                        // Create user
                        await createUser(userData);
                        importResults.successful++;
                    } catch (error) {
                        console.error(`Error importing user ${userData.email}:`, error);
                        importResults.failed++;
                        importResults.errors.push({
                            email: userData.email,
                            error: error.message
                        });
                    }
                }

                console.log('Import Results:', importResults);
                
                // Close database connection
                await mongoose.connection.close();

                resolve(importResults);
            })
            .on('error', (error) => {
                console.error('CSV reading error:', error);
                reject(error);
            });
    });
}

// Run the import
const filePath = process.argv[2];
if (!filePath) {
    console.error('Please provide a CSV file path');
    process.exit(1);
}

importUsersFromCSV(filePath)
    .then(results => {
        console.log('Import completed:', results);
        process.exit(0);
    })
    .catch(error => {
        console.error('Import failed:', error);
        process.exit(1);
    });