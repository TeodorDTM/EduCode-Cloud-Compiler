const express = require('express');
const http    = require('http');
const path    = require('path');
const { Server } = require('socket.io');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const db             = require('./models/db');
const authMiddleware = require('./middleware/auth');
const {
    registerUser, verifyUser, loginUser,
    forgotPassword, resetPassword, updateProfile, changePassword
} = require('./controllers/authController');
const { sendVerificationEmail, sendPasswordResetEmail } = require('./services/emailService');
const {
    createContainerForUser, removeContainerForUser,
    getContainerStream, setupProjectInContainer,
    runCodeInteractive, checkSyntaxInContainer,
    saveFileInContainer, readFileFromContainer,
    listFilesInContainer, readFilePreviewFromContainer,
    createFileInContainer, deleteInContainer,
    renameInContainer, copyInContainer, mkdirInContainer,
    uploadFileToContainer
} = require('./services/dockerService');

const app    = express();
const server = http.createServer(app);
const io     = new Server(server, { cors: { origin: '*' } });

app.use(express.json({ limit: '20mb' }));
app.use(express.static(path.join(__dirname, '../frontend')));

// ═══════════════════════════════════════════════════════════════
//  AUTH
// ═══════════════════════════════════════════════════════════════
app.post('/api/register', async (req, res) => {
    const { nume, prenume, email, telefon, scoala, parola } = req.body;
    if (!nume || !prenume || !email || !scoala || !parola)
        return res.status(400).json({ success: false, error: 'Câmpurile obligatorii lipsesc.' });
    try {
        const result = await registerUser({ nume, prenume, email, telefon, scoala, parola });
        await sendVerificationEmail(email, result.verificationCode);
        res.json({ success: true });
    } catch (err) { res.status(400).json({ success: false, error: String(err) }); }
});

app.post('/api/verify', async (req, res) => {
    const { email, code } = req.body;
    try {
        const result      = await verifyUser(email, code);
        // Cream/Pornim containerul dupa verificare
        const containerId = await createContainerForUser(result.userId);
        db.run(`UPDATE users SET container_id = ? WHERE id = ?`, [containerId, result.userId]);
        res.json({ success: true, ...result, containerId });
    } catch (err) { res.status(400).json({ success: false, error: String(err) }); }
});

app.post('/api/login', async (req, res) => {
    const { email, parola } = req.body;
    try {
        const result = await loginUser(email, parola);

        // ─── FIX CRITIC ──────────────────────────────────────────
        // Apelam ÎNTOTDEAUNA createContainerForUser, indiferent daca
        // container_id exista in DB sau nu.
        // Functia este idempotenta: porneste containerul daca e oprit,
        // il creaza daca nu exista, nu face nimic daca e deja running.
        // Aceasta rezolva problema dupa restart Docker/server.
        // ─────────────────────────────────────────────────────────
        const activeContainerId = await createContainerForUser(result.userId);

        // Actualizam DB daca ID-ul s-a schimbat (container recreat)
        if (activeContainerId !== result.containerId) {
            db.run(`UPDATE users SET container_id = ? WHERE id = ?`,
                [activeContainerId, result.userId]);
        }

        res.json({ success: true, ...result, containerId: activeContainerId });
    } catch (err) {
        res.status(401).json({ success: false, error: String(err) });
    }
});

app.post('/api/forgot-password', async (req, res) => {
    const { email } = req.body;
    try {
        const result = await forgotPassword(email);
        await sendPasswordResetEmail(email, result.resetCode);
        res.json({ success: true });
    } catch (err) { res.status(400).json({ success: false, error: String(err) }); }
});

app.post('/api/reset-password', async (req, res) => {
    const { email, code, newPassword } = req.body;
    if (!newPassword || newPassword.length < 6)
        return res.status(400).json({ success: false, error: 'Parola trebuie să aibă minim 6 caractere.' });
    try {
        await resetPassword(email, code, newPassword);
        res.json({ success: true });
    } catch (err) { res.status(400).json({ success: false, error: String(err) }); }
});

// ═══════════════════════════════════════════════════════════════
//  PROFIL
// ═══════════════════════════════════════════════════════════════
app.get('/api/profile/:userId', authMiddleware, (req, res) => {
    db.get(`SELECT id, nume, prenume, email, telefon, scoala, created_at FROM users WHERE id = ?`,
        [req.params.userId], (err, user) => {
            if (err)   return res.status(500).json({ success: false, error: err.message });
            if (!user) return res.status(404).json({ success: false, error: 'Utilizator negăsit.' });
            res.json({ success: true, user });
        });
});

app.put('/api/profile/:userId', authMiddleware, async (req, res) => {
    const { nume, prenume, telefon, scoala } = req.body;
    try { await updateProfile(req.params.userId, { nume, prenume, telefon, scoala }); res.json({ success: true }); }
    catch (err) { res.status(500).json({ success: false, error: String(err) }); }
});

app.post('/api/change-password', authMiddleware, async (req, res) => {
    const { userId, oldPassword, newPassword } = req.body;
    if (!newPassword || newPassword.length < 6)
        return res.status(400).json({ success: false, error: 'Parola nouă trebuie să aibă minim 6 caractere.' });
    try { await changePassword(userId, oldPassword, newPassword); res.json({ success: true }); }
    catch (err) { res.status(400).json({ success: false, error: String(err) }); }
});

// Sterge contul + containerul Docker
app.delete('/api/account/:userId', authMiddleware, async (req, res) => {
    const userId = req.params.userId;
    try {
        // 1. Stergem containerul Docker
        await removeContainerForUser(userId);

        // 2. Stergem datele din DB
        db.run(`DELETE FROM projects WHERE user_id = ?`, [userId]);
        db.run(`DELETE FROM user_settings WHERE user_id = ?`, [userId]);
        db.run(`DELETE FROM users WHERE id = ?`, [userId], function(err) {
            if (err) return res.status(500).json({ success: false, error: err.message });
            res.json({ success: true });
        });
    } catch (err) {
        res.status(500).json({ success: false, error: String(err) });
    }
});

// ═══════════════════════════════════════════════════════════════
//  SETĂRI
// ═══════════════════════════════════════════════════════════════
app.get('/api/settings/:userId', authMiddleware, (req, res) => {
    db.get(`SELECT * FROM user_settings WHERE user_id = ?`, [req.params.userId], (err, s) => {
        if (err) return res.status(500).json({ success: false, error: err.message });
        res.json({ success: true, settings: s || {
            user_id: req.params.userId, editor_font_size: 15, editor_theme: 'vs-dark',
            tab_size: 4, word_wrap: 'on', autosave_interval: 5000
        }});
    });
});

app.put('/api/settings/:userId', authMiddleware, (req, res) => {
    const { editor_font_size, editor_theme, tab_size, word_wrap, autosave_interval } = req.body;
    db.run(`INSERT OR REPLACE INTO user_settings
            (user_id, editor_font_size, editor_theme, tab_size, word_wrap, autosave_interval)
            VALUES (?,?,?,?,?,?)`,
        [req.params.userId, editor_font_size, editor_theme, tab_size, word_wrap, autosave_interval],
        function(err) {
            if (err) return res.status(500).json({ success: false, error: err.message });
            res.json({ success: true });
        });
});

// ═══════════════════════════════════════════════════════════════
//  PROIECTE
// ═══════════════════════════════════════════════════════════════
app.post('/api/projects', async (req, res) => {
    const { name, lang, userId } = req.body;
    try {
        await setupProjectInContainer(userId, name, lang);
        db.run(`INSERT INTO projects (user_id, title, lang) VALUES (?,?,?)`,
            [userId, name, lang], function(err) {
                if (err) return res.status(500).json({ success: false, error: 'Eroare DB.' });
                res.json({ success: true, project: { id: this.lastID, user_id: userId, title: name, lang } });
            });
    } catch (err) { res.status(500).json({ success: false, error: 'Eroare server.' }); }
});

app.get('/api/projects/:userId', (req, res) => {
    db.all('SELECT * FROM projects WHERE user_id = ? ORDER BY created_at DESC',
        [req.params.userId], (err, rows) => {
            if (err) return res.status(500).json({ success: false, error: err.message });
            res.json({ success: true, projects: rows });
        });
});

app.delete('/api/projects/:projectId', authMiddleware, (req, res) => {
    db.run('DELETE FROM projects WHERE id = ?', [req.params.projectId], function(err) {
        if (err) return res.status(500).json({ success: false, error: err.message });
        res.json({ success: true });
    });
});

// ═══════════════════════════════════════════════════════════════
//  COD
// ═══════════════════════════════════════════════════════════════
app.post('/api/save', async (req, res) => {
    const { code, lang, userId, projectName } = req.body;
    try { await saveFileInContainer(userId, projectName, code, lang); res.json({ success: true }); }
    catch { res.status(500).json({ success: false }); }
});

app.post('/api/read', async (req, res) => {
    const { lang, userId, projectName } = req.body;
    try { const code = await readFileFromContainer(userId, projectName, lang); res.json({ success: true, code }); }
    catch { res.status(500).json({ success: false }); }
});

app.post('/api/debug', async (req, res) => {
    const { code, lang, userId, projectName } = req.body;
    try {
        const output = await checkSyntaxInContainer(userId, projectName || 'Test', code, lang);
        if (!output || !output.trim()) {
            res.json({ success: true, errorCount: 0, output: '' });
        } else {
            const matches = output.match(/error:|Error:/gi);
            res.json({ success: true, errorCount: matches ? matches.length : 1, output });
        }
    } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

// ═══════════════════════════════════════════════════════════════
//  FILE SYSTEM
// ═══════════════════════════════════════════════════════════════
app.get('/api/fs/list', async (req, res) => {
    try {
        const files = await listFilesInContainer(req.query.userId, req.query.path);
        res.json({ success: true, files });
    } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

app.post('/api/fs/preview', async (req, res) => {
    const { userId, filePath } = req.body;
    try {
        const content = await readFilePreviewFromContainer(userId, filePath);
        res.json({ success: true, content: content || '' });
    } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

app.post('/api/fs/create-file', async (req, res) => {
    const { userId, dirPath, fileName, content } = req.body;
    if (!fileName || fileName.includes('..') || fileName.includes('/'))
        return res.status(400).json({ success: false, error: 'Nume de fișier invalid.' });
    try {
        await createFileInContainer(userId, dirPath, fileName, content || '');
        res.json({ success: true });
    } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

app.post('/api/fs/delete', async (req, res) => {
    const { userId, path } = req.body;
    try {
        await deleteInContainer(userId, path);
        // Sterge si din DB daca e folder de proiect
        const parts = (path || '').split('/');
        if (parts.length === 5 && parts[3] === 'workspace')
            db.run(`DELETE FROM projects WHERE user_id = ? AND title = ?`, [userId, parts[4]]);
        res.json({ success: true });
    } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

app.post('/api/fs/rename', async (req, res) => {
    const { userId, oldPath, newPath } = req.body;
    try { await renameInContainer(userId, oldPath, newPath); res.json({ success: true }); }
    catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

app.post('/api/fs/copy', async (req, res) => {
    const { userId, sourcePath, destPath } = req.body;
    try { await copyInContainer(userId, sourcePath, destPath); res.json({ success: true }); }
    catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

app.post('/api/fs/mkdir', async (req, res) => {
    try { await mkdirInContainer(req.body.userId, req.body.path); res.json({ success: true }); }
    catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

app.post('/api/fs/upload', async (req, res) => {
    const { userId, targetPath, fileContentBase64, fileName } = req.body;
    if (!fileName || fileName.includes('..') || fileName.includes('/'))
        return res.status(400).json({ success: false, error: 'Nume fișier invalid.' });
    if (!fileContentBase64)
        return res.status(400).json({ success: false, error: 'Continut fisier lipsa.' });
    try {
        await uploadFileToContainer(userId, targetPath, fileName, fileContentBase64);
        res.json({ success: true });
    } catch (err) {
        console.error('[Upload] Error:', err.message);
        res.status(500).json({ success: false, error: err.message });
    }
});

// ═══════════════════════════════════════════════════════════════
//  SOCKET.IO
// ═══════════════════════════════════════════════════════════════
io.on('connection', (socket) => {
    let activeDockerStream = null;
    let activeRunStream    = null;

    socket.on('start-terminal-session', async (data) => {
        const userId = data.userId || 1;
        activeDockerStream = await getContainerStream(userId, data.projectName);
        if (activeDockerStream) {
            activeDockerStream.on('data', (chunk) =>
                socket.emit('terminal-output', chunk.toString('utf8'))
            );
        } else {
            socket.emit('terminal-output', '\r\n\x1b[31m[EduCode] Nu s-a putut conecta la container.\x1b[0m\r\n');
        }
    });

    socket.on('terminal-input', (data) => {
        if (activeDockerStream) activeDockerStream.write(data);
    });

    socket.on('run-code-interactive', async (data) => {
        if (activeRunStream) { try { activeRunStream.end(); } catch {} }
        const userId    = data.userId || 1;
        activeRunStream = await runCodeInteractive(userId, data.projectName, data.code, data.lang, socket);
    });

    socket.on('run-input', (input) => {
        if (activeRunStream) activeRunStream.write(input + '\n');
    });

    socket.on('disconnect', () => {
        try { if (activeDockerStream) activeDockerStream.end(); } catch {}
        try { if (activeRunStream)    activeRunStream.end();    } catch {}
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`--EduCode Cloud activ pe http://localhost:${PORT}`);
});
