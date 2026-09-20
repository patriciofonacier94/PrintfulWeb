const bcrypt = require('bcryptjs');
const mysql = require('mysql2/promise');

async function hashExistingPasswords() {
    const connection = await mysql.createConnection({
        host: 'localhost',
        user: 'root',
        password: '',
        database: 'printful_db'
    });

    const users = [
        { email: 'admin@printful.com', password: 'admin123' },
        { email: 'user@example.com', password: 'user123' }
    ];

    for (const user of users) {
        const hashed = await bcrypt.hash(user.password, 10);
        await connection.execute(
            'UPDATE users SET password = ? WHERE email = ?',
            [hashed, user.email]
        );
        console.log(`Hashed password for ${user.email}`);
    }

    console.log('All passwords hashed successfully!');
    await connection.end();
}

hashExistingPasswords().catch(console.error);