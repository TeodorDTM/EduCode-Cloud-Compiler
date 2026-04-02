const db = require('../models/db');
const bcrypt = require('bcrypt');

async function registerUser(email, password) {
    const hashedPassword = await bcrypt.hash(password, 10);

    return new Promise((resolve, reject) => {
        const query = `INSERT INTO users (email, password) VALUES (?, ?)`;
        
        db.run(query, [email, hashedPassword], function(err) {
            if (err) {
                if (err.message.includes('UNIQUE')) reject('Email-ul există deja!');
                else reject(err);
            } else {
                console.log(`[Auth] Utilizator nou creat cu ID: ${this.lastID}`);
                resolve(this.lastID);
            }
        });
    });
}

module.exports = { registerUser };