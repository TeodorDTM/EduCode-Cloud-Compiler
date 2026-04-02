const sqlite3 = require('sqlite3').verbose();
const path = require('path');


const dbPath = path.resolve(__dirname, '../../data/database.sqlite');

const db = new sqlite3.Database(dbPath, (err) => {
    if (err) console.error('Eroare la conectarea SQLite:', err.message);
    else console.log('[DB] Conectat cu succes la SQLite (Fișier local)');
});

db.serialize(() => {
    db.run(`
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            email TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);
});

module.exports = db;