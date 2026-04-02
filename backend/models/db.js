const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.resolve(__dirname, '../../data/database.sqlite');
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('[DB] Eroare la conectare:', err.message);
    } else {
        console.log('[DB] Conectat la SQLite.');
        
        // Tabel nou, standard Enterprise
        db.run(`CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nume TEXT NOT NULL,
            prenume TEXT NOT NULL,
            email TEXT UNIQUE NOT NULL,
            telefon TEXT,
            scoala TEXT,
            parola_hash TEXT NOT NULL,
            container_id TEXT,
            is_verified BOOLEAN DEFAULT 0,
            verification_code TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`);
    }
});

module.exports = db;