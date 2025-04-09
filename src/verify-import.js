const mongoose = require('mongoose');

async function verifyImport() {
    try {
        // Connect to database
        await mongoose.connect('mongodb://localhost:27017/LoginSignupdb', {
            useNewUrlParser: true,
            useUnifiedTopology: true
        });

        // Count users
        const userCount = await mongoose.connection.db.collection('logincollections').countDocuments();
        console.log(`Total users in database: ${userCount}`);

        // Fetch and display first 5 users
        const users = await mongoose.connection.db.collection('logincollections')
            .find({})
            .limit(5)
            .toArray();

        console.log('Sample Users:');
        users.forEach(user => {
            console.log(`
Email: ${user.email}
Name: ${user.name}
University: ${user.profile?.university}
Major: ${user.profile?.major}
            `);
        });

        // Close connection
        await mongoose.connection.close();
    } catch (error) {
        console.error('Verification failed:', error);
    }
}

verifyImport();