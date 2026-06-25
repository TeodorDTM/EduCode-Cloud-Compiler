const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.resolve(__dirname, '../../data/database.sqlite');
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('[DB] Eroare la conectare:', err.message);
    } else {
        console.log('[DB] Conectat la SQLite.');
        db.serialize(() => {

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
                reset_code TEXT,
                reset_expires DATETIME,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )`);

            db.run(`CREATE TABLE IF NOT EXISTS projects (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                title TEXT NOT NULL,
                lang TEXT NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users (id)
            )`);

            db.run(`CREATE TABLE IF NOT EXISTS user_settings (
                user_id INTEGER PRIMARY KEY,
                editor_font_size INTEGER DEFAULT 15,
                editor_theme TEXT DEFAULT 'vs-dark',
                tab_size INTEGER DEFAULT 4,
                word_wrap TEXT DEFAULT 'on',
                autosave_interval INTEGER DEFAULT 5000,
                FOREIGN KEY (user_id) REFERENCES users (id)
            )`);

            // Migrare coloane noi (ignoră erori dacă există deja)
            [
                `ALTER TABLE users ADD COLUMN reset_code TEXT`,
                `ALTER TABLE users ADD COLUMN reset_expires DATETIME`
            ].forEach(sql => db.run(sql, () => {}));
        });
    }
});

module.exports = db;
