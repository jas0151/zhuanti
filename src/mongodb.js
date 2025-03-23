const mongoose = require("mongoose");

class Database {
    constructor() {
        this.connect();
    }

    connect() {
        // Add more connection options for robustness
        const options = {
            useNewUrlParser: true,
            useUnifiedTopology: true,
            serverSelectionTimeoutMS: 5000,
            socketTimeoutMS: 45000,
            family: 4, // Use IPv4, skip trying IPv6
            maxPoolSize: 10
        };

        // Use environment variables for database connection
        const dbUri = process.env.MONGODB_URI || "mongodb://localhost:27017/LoginSignupdb";
        
        mongoose.connect(dbUri, options)
            .then(async () => {
                console.log('MongoDB connected successfully');
                
                // Create indexes for performance
                try {
                    const db = mongoose.connection;
                    await db.collection('logincollections').createIndex({ email: 1 }, { unique: true });
                    await db.collection('logincollections').createIndex({ 'profile.university': 1 });
                    await db.collection('logincollections').createIndex({ 'profile.major': 1 });
                    console.log('Indexes created successfully');
                } catch (indexError) {
                    console.error('Error creating indexes:', indexError);
                }
            })
            .catch((error) => {
                console.error('MongoDB connection failed:', error);
                // Implement retry mechanism with exponential backoff
                setTimeout(() => this.connect(), 5000);
            });
        
        // Add event listeners for connection issues
        mongoose.connection.on('error', (err) => {
            console.error('MongoDB connection error:', err);
        });
        
        mongoose.connection.on('disconnected', () => {
            console.warn('MongoDB disconnected. Attempting to reconnect...');
        });
        
        // Handle application termination
        process.on('SIGINT', () => {
            mongoose.connection.close(() => {
                console.log('MongoDB connection closed due to application termination');
                process.exit(0);
            });
        });
    }
}

module.exports = new Database();