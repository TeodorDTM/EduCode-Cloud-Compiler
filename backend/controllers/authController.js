const db = require('../models/db');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

async function registerUser({ nume, prenume, email, telefon, scoala, parola }) {
    const hashedPassword = await bcrypt.hash(parola, 10);
    const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();

    return new Promise((resolve, reject) => {
        const query = `INSERT INTO users (nume, prenume, email, telefon, scoala, parola_hash, verification_code)
                       VALUES (?, ?, ?, ?, ?, ?, ?)`;
        db.run(query, [nume, prenume, email, telefon || '', scoala, hashedPassword, verificationCode], function(err) {
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

            if (String(user.verification_code).trim() !== String(code).trim()) {
                return reject('Codul de verificare este incorect.');
            }

            db.run(`UPDATE users SET is_verified = 1, verification_code = NULL WHERE email = ?`, [email], function(updateErr) {
                if (updateErr) return reject('Eroare la activarea contului.');
                const token = jwt.sign({ userId: user.id, email }, process.env.JWT_SECRET, { expiresIn: '7d' });
                resolve({ userId: user.id, token, name: user.nume, prenume: user.prenume, email: user.email });
            });
        });
    });
}

async function loginUser(email, parola) {
    return new Promise((resolve, reject) => {
        db.get(`SELECT * FROM users WHERE email = ?`, [email], async (err, user) => {
            if (err) return reject('Eroare bază de date.');
            if (!user) return reject('Email sau parolă incorectă.');

            const isMatch = await bcrypt.compare(parola, user.parola_hash);
            if (!isMatch) return reject('Email sau parolă incorectă.');

            if (user.is_verified == 0 || user.is_verified === null) {
                return reject('Contul nu este verificat! Te rugăm să introduci codul primit pe email.');
            }

            const token = jwt.sign({ userId: user.id, email: user.email }, process.env.JWT_SECRET, { expiresIn: '7d' });
            resolve({
                userId: user.id,
                token,
                containerId: user.container_id,
                name: user.nume,
                prenume: user.prenume,
                email: user.email,
                telefon: user.telefon || '',
                scoala: user.scoala || ''
            });
        });
    });
}

async function forgotPassword(email) {
    return new Promise((resolve, reject) => {
        db.get(`SELECT * FROM users WHERE email = ?`, [email], (err, user) => {
            if (err) return reject('Eroare bază de date.');
            if (!user) return reject('Nu există un cont asociat acestui email.');
            if (!user.is_verified) return reject('Contul nu este verificat.');

            const resetCode = Math.floor(100000 + Math.random() * 900000).toString();
            const expires = new Date(Date.now() + 15 * 60 * 1000).toISOString();

            db.run(`UPDATE users SET reset_code = ?, reset_expires = ? WHERE email = ?`,
                [resetCode, expires, email], function(err) {
                    if (err) return reject('Eroare la generarea codului de resetare.');
                    resolve({ resetCode, userId: user.id });
                });
        });
    });
}

async function resetPassword(email, code, newPassword) {
    return new Promise((resolve, reject) => {
        db.get(`SELECT * FROM users WHERE email = ?`, [email], async (err, user) => {
            if (err) return reject('Eroare bază de date.');
            if (!user) return reject('Nu există un cont cu acest email.');
            if (!user.reset_code) return reject('Nu există o cerere de resetare activă pentru acest cont.');

            if (String(user.reset_code).trim() !== String(code).trim()) {
                return reject('Cod de resetare incorect.');
            }
            if (new Date(user.reset_expires) < new Date()) {
                return reject('Codul a expirat. Solicită un cod nou.');
            }

            const hashedPassword = await bcrypt.hash(newPassword, 10);
            db.run(`UPDATE users SET parola_hash = ?, reset_code = NULL, reset_expires = NULL WHERE email = ?`,
                [hashedPassword, email], function(err) {
                    if (err) return reject('Eroare la actualizarea parolei.');
                    resolve({ success: true });
                });
        });
    });
}

async function updateProfile(userId, { nume, prenume, telefon, scoala }) {
    return new Promise((resolve, reject) => {
        db.run(`UPDATE users SET nume = ?, prenume = ?, telefon = ?, scoala = ? WHERE id = ?`,
            [nume, prenume, telefon, scoala, userId], function(err) {
                if (err) return reject('Eroare la actualizarea profilului.');
                resolve({ success: true });
            });
    });
}

async function changePassword(userId, oldPassword, newPassword) {
    return new Promise((resolve, reject) => {
        db.get(`SELECT * FROM users WHERE id = ?`, [userId], async (err, user) => {
            if (err) return reject('Eroare bază de date.');
            if (!user) return reject('Utilizatorul nu există.');
            const isMatch = await bcrypt.compare(oldPassword, user.parola_hash);
            if (!isMatch) return reject('Parola curentă este incorectă.');
            const hashedPassword = await bcrypt.hash(newPassword, 10);
            db.run(`UPDATE users SET parola_hash = ? WHERE id = ?`, [hashedPassword, userId], function(err) {
                if (err) return reject('Eroare la schimbarea parolei.');
                resolve({ success: true });
            });
        });
    });
}

module.exports = { registerUser, verifyUser, loginUser, forgotPassword, resetPassword, updateProfile, changePassword };
