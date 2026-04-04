const express = require('express');
const http = require('http');
const path = require('path');
const { Server } = require('socket.io');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') }); 

const { registerUser, verifyUser, loginUser } = require('./controllers/authController');
const { sendVerificationEmail } = require('./services/emailService');
const { createContainerForUser, getContainerStream, runCodeInContainer } = require('./services/dockerService');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

app.use(express.json());
app.use(express.static(path.join(__dirname, '../frontend')));

// --- RUTE AUTENTIFICARE ---
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
        console.error("[Login Error]:", err);
        res.status(401).json({ success: false, error: err.message || "Eroare la autentificare" });
    }
});

// --- RUTA RULARE COD ---
app.post('/api/run', async (req, res) => {
    const { code, lang, userId } = req.body;
    try {
        const output = await runCodeInContainer(userId || 1, code, lang);
        res.json({ success: true, output });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// --- SOCKET.IO (CLI LINUX) ---
io.on('connection', (socket) => {
    let activeDockerStream = null; 

    // FIX: Numele evenimentului trebuie să coincidă cu frontend-ul
    socket.on('start-terminal-session', async (data) => {
        // Folosim un userId fix momentan pentru test, ulterior vine din sesiune
        activeDockerStream = await getContainerStream(1); 
        if (activeDockerStream) {
            activeDockerStream.on('data', (chunk) => socket.emit('terminal-output', chunk.toString('utf8')));
        }
    });

    socket.on('terminal-input', (data) => {
        if (activeDockerStream) activeDockerStream.write(data);
    });

    socket.on('disconnect', () => {
        if (activeDockerStream) activeDockerStream.end(); 
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`--EduCode Cloud activ pe http://localhost:${PORT}`);
});