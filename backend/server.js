const express = require('express');
const http = require('http');
const path = require('path');
const { Server } = require('socket.io');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') }); 

const db = require('./models/db'); 
const { registerUser, verifyUser, loginUser } = require('./controllers/authController');
const { sendVerificationEmail } = require('./services/emailService');
const { createContainerForUser, getContainerStream } = require('./services/dockerService');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

app.use(express.json());
app.use(express.static(path.join(__dirname, '../frontend')));


app.post('/api/register', async (req, res) => {
    const { nume, prenume, email, telefon, scoala, parola } = req.body;
    if (!nume || !prenume || !email || !parola) {
        return res.status(400).json({ error: 'Toate câmpurile obligatorii trebuie completate!' });
    }

    try {
        const { userId, verificationCode } = await registerUser(req.body);
        await sendVerificationEmail(email, verificationCode);
        
        res.status(201).json({ success: true, message: 'Verifică email-ul pentru cod!', userId });
    } catch (err) {
        res.status(400).json({ success: false, error: err });
    }
});


app.post('/api/verify', async (req, res) => {
    const { email, code } = req.body;
    try {
        const { userId, token } = await verifyUser(email, code);
        
        console.log(`[Verify] Baza de date updatată cu succes. Încercăm crearea containerului Docker...`);
        const containerId = await createContainerForUser(userId);

        res.json({ success: true, message: 'Cont verificat!', userId, token, containerId });
    } catch (err) {
        console.error("\n[Eroare la VERIFY]:", err);
        
        const errorMessage = err.message ? err.message : err.toString();
        res.status(400).json({ success: false, error: errorMessage });
    }
});


app.post('/api/login', async (req, res) => {
    const { email, parola } = req.body;
    try {
        const { userId, token, containerId } = await loginUser(email, parola);
        
        let activeContainerId = containerId;
        if (!activeContainerId) {
            activeContainerId = await createContainerForUser(userId);
        }

        res.json({ success: true, message: 'Login reușit!', userId, token, containerId: activeContainerId });
    } catch (err) {
        res.status(401).json({ success: false, error: err });
    }
});


io.on('connection', (socket) => {
    console.log(`[Socket] 🟢 Conexiune nouă: ${socket.id}`);
    let activeDockerStream = null; 

    socket.on('request-terminal', async (userId) => {
        activeDockerStream = await getContainerStream(userId);
        if (activeDockerStream) {
            socket.emit('terminal-output', '\r\n[Sistem] Oglindire cu succes! Sesiune activă.\r\n$ ');
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
    console.log(`\n==========================================`);
    console.log(`--EduCode Cloud (EcCC) Activat--`);
    console.log(`Adresă: http://localhost:${PORT}`);
    console.log(`==========================================\n`);
});