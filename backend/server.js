const express = require('express');
const http = require('http');
const path = require('path');
const { Server } = require('socket.io');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') }); 

const db = require('./models/db'); 
const { registerUser, verifyUser, loginUser } = require('./controllers/authController');
const { sendVerificationEmail } = require('./services/emailService');
const { 
    createContainerForUser, getContainerStream, setupProjectInContainer, runCodeInteractive, 
    checkSyntaxInContainer, saveFileInContainer, readFileFromContainer,
    listFilesInContainer, deleteInContainer, renameInContainer, mkdirInContainer 
} = require('./services/dockerService');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

app.use(express.json());
app.use(express.static(path.join(__dirname, '../frontend')));

app.post('/api/login', async (req, res) => {        
    const { email, parola } = req.body;
    try {
        const result = await loginUser(email, parola);
        let activeContainerId = result.containerId;
        if (!activeContainerId) {
            activeContainerId = await createContainerForUser(result.userId);
        }
        res.json({ success: true, ...result, containerId: activeContainerId });
    } catch (err) {
        res.status(401).json({ success: false, error: err.message || "Eroare la autentificare" });
    }
});

app.post('/api/projects', async (req, res) => {
    const { name, lang, userId } = req.body;
    const currentUserId = userId || 1;

    try {
        await setupProjectInContainer(currentUserId, name, lang);
        const sqlInsert = `INSERT INTO projects (user_id, title, lang) VALUES (?, ?, ?)`;
        
        db.run(sqlInsert, [currentUserId, name, lang], function(err) {
            if (err) return res.status(500).json({ success: false, error: "Eroare la salvarea în baza de date." });
            res.json({ success: true, project: { id: this.lastID, user_id: currentUserId, title: name, lang: lang } });
        });
    } catch (err) {
        res.status(500).json({ success: false, error: "Eroare la crearea proiectului pe server." });
    }
});

app.get('/api/projects/:userId', (req, res) => {
    const userId = req.params.userId || 1;
    db.all('SELECT * FROM projects WHERE user_id = ? ORDER BY created_at DESC', [userId], (err, rows) => {
        if (err) return res.status(500).json({ success: false, error: err.message });
        res.json({ success: true, projects: rows });
    });
});

app.post('/api/save', async (req, res) => {
    const { code, lang, userId, projectName } = req.body;
    try {
        await saveFileInContainer(userId || 1, projectName, code, lang);
        res.json({ success: true });
    } catch (err) { res.status(500).json({ success: false }); }
});

app.post('/api/read', async (req, res) => {
    const { lang, userId, projectName } = req.body;
    try {
        const code = await readFileFromContainer(userId || 1, projectName, lang);
        res.json({ success: true, code: code });
    } catch (err) { res.status(500).json({ success: false }); }
});

app.post('/api/debug', async (req, res) => {
    const { code, lang, userId, projectName } = req.body;
    try {
        const output = await checkSyntaxInContainer(userId || 1, projectName || "Test", code, lang);
        if (output.trim() === '') {
            res.json({ success: true, errorCount: 0, output: '' });
        } else {
            const matches = output.match(/error:|Error:/gi);
            const errorCount = matches ? matches.length : 1; 
            res.json({ success: true, errorCount: errorCount, output: output });
        }
    } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

// =========================================================
// RUTE NOI: VIRTUAL FILE SYSTEM (EXPLORER)
// =========================================================
app.get('/api/fs/list', async (req, res) => {
    try {
        const { userId, path } = req.query;
        const files = await listFilesInContainer(userId || 1, path);
        res.json({ success: true, files });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

app.post('/api/fs/delete', async (req, res) => {
    try {
        const { userId, path } = req.body;
        const result = await deleteInContainer(userId || 1, path);
        
        // BONUS: Dacă ștergem un folder de proiect, îl scoatem și din baza de date SQLite!
        const pathParts = path.split('/');
        if (pathParts.length === 5 && pathParts[3] === 'workspace') {
            const projectName = pathParts[4];
            db.run(`DELETE FROM projects WHERE user_id = ? AND title = ?`, [userId || 1, projectName]);
        }

        res.json({ success: result });
    } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

app.post('/api/fs/rename', async (req, res) => {
    try {
        const { userId, oldPath, newPath } = req.body;
        const result = await renameInContainer(userId || 1, oldPath, newPath);
        res.json({ success: result });
    } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

app.post('/api/fs/mkdir', async (req, res) => {
    try {
        const { userId, path } = req.body;
        const result = await mkdirInContainer(userId || 1, path);
        res.json({ success: result });
    } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

// --- SOCKET.IO ---
io.on('connection', (socket) => {
    let activeDockerStream = null;  
    let activeRunStream = null;     

    socket.on('start-terminal-session', async (data) => {
        activeDockerStream = await getContainerStream(1, data.projectName); 
        if (activeDockerStream) {
            activeDockerStream.on('data', (chunk) => socket.emit('terminal-output', chunk.toString('utf8')));
        }
    });

    socket.on('terminal-input', (data) => {
        if (activeDockerStream) activeDockerStream.write(data);
    });

    socket.on('run-code-interactive', async (data) => {
        if (activeRunStream) activeRunStream.end(); 
        activeRunStream = await runCodeInteractive(1, data.projectName, data.code, data.lang, socket);
    });

    socket.on('run-input', (inputData) => {
        if (activeRunStream) {
            activeRunStream.write(inputData + '\n');
        }
    });

    socket.on('disconnect', () => {
        if (activeDockerStream) activeDockerStream.end(); 
        if (activeRunStream) activeRunStream.end();
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`--EduCode Cloud activ pe http://localhost:${PORT}--`);
});