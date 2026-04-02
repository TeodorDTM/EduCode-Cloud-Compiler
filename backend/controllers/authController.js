const db = require('../models/db');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

async function registerUser({ nume, prenume, email, telefon, scoala, parola }) {
    const hashedPassword = await bcrypt.hash(parola, 10);
    const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();

    return new Promise((resolve, reject) => {
        const query = `INSERT INTO users (nume, prenume, email, telefon, scoala, parola_hash, verification_code) VALUES (?, ?, ?, ?, ?, ?, ?)`;
        db.run(query, [nume, prenume, email, telefon, scoala, hashedPassword, verificationCode], function(err) {
            if (err) {
                if (err.message.includes('UNIQUE')) reject('Acest email este deja înregistrat!');
                else reject('Eroare internă la crearea contului.');
            } else {
                resolve({ userId: this.lastID, verificationCode });
            }
        });
    });
}


async function verifyUser(email, code) {
    return new Promise((resolve, reject) => {
        db.get(`SELECT * FROM users WHERE email = ?`, [email], (err, user) => {
            if (err) return reject('Eroare bază de date.');
            if (!user) return reject('Utilizatorul nu există.');

            console.log(`\n[Debug Verificare] Adresă: ${email}`);
            console.log(`[Debug Verificare] Cod in DB: '${user.verification_code}'`);
            console.log(`[Debug Verificare] Cod introdus: '${code}'\n`);

            if (String(user.verification_code).trim() !== String(code).trim()) {
                return reject('Codul de verificare este incorect.');
            }

            db.run(`UPDATE users SET is_verified = 1, verification_code = NULL WHERE email = ?`, [email], function(updateErr) {
                if (updateErr) return reject('Eroare la activarea contului.');
                
                const jwt = require('jsonwebtoken');
                const token = jwt.sign({ userId: user.id, email }, process.env.JWT_SECRET, { expiresIn: '24h' });
                resolve({ userId: user.id, token });
            });
        });
    });
}


async function loginUser(email, parola) {
    return new Promise((resolve, reject) => {
        db.get(`SELECT * FROM users WHERE email = ?`, [email], async (err, user) => {
            if (err) return reject('Eroare bază de date.');
            if (!user) return reject('Email sau parolă incorectă.'); 

            console.log(`\n[Debug Login] User găsit:`, user.email, `| Stare is_verified:`, user.is_verified);

            const isMatch = await bcrypt.compare(parola, user.parola_hash);
            if (!isMatch) return reject('Email sau parolă incorectă.');

            if (user.is_verified == 0 || user.is_verified === '0' || user.is_verified === null) {
                return reject('Contul nu este verificat! Te rugăm să introduci codul primit pe email.');
            }

            const jwt = require('jsonwebtoken');
            const token = jwt.sign({ userId: user.id, email: user.email }, process.env.JWT_SECRET, { expiresIn: '24h' });
            resolve({ userId: user.id, token, containerId: user.container_id });
        });
    });
}

module.exports = { registerUser, verifyUser, loginUser };