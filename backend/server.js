const express = require('express');
const http = require('http');
const path = require('path');
const { Server } = require('socket.io');

const db = require('./models/db'); 
const { registerUser } = require('./controllers/authController');
const { createContainerForUser, getContainerStream } = require('./services/dockerService');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: { origin: "*" }
});

app.use(express.json());
app.use(express.static(path.join(__dirname, '../frontend')));


io.on('connection', (socket) => {
    console.log(`[Socket] 🟢 Conexiune nouă: ${socket.id}`);
    
    let activeDockerStream = null; 

    socket.on('request-terminal', async (userId) => {
        console.log(`[Socket] Cerere de legare la containerul ${userId}...`);
        
        activeDockerStream = await getContainerStream(userId);

        if (activeDockerStream) {
            socket.emit('terminal-output', '\r\n[Sistem] Oglindire cu succes! Sesiune activă.\r\n$ ');

            activeDockerStream.on('data', (chunk) => {
                socket.emit('terminal-output', chunk.toString('utf8'));
            });
        }
    });


    socket.on('terminal-input', (data) => {
        if (activeDockerStream) {
            activeDockerStream.write(data);
        } else {
            console.log(`[Avertisment] Am primit tasta, dar Docker nu e conectat.`);
        }
    });

    socket.on('disconnect', () => {
        console.log(`[Socket] Utilizator deconectat.`);
        if (activeDockerStream) {
            activeDockerStream.end(); 
        }
    });
});


app.get('/api/status', (req, res) => {
    res.json({ status: 'EcCC Online', database: 'Connected' });
});

app.post('/api/register', async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ error: 'Email și parola sunt obligatorii!' });
    }

    try {
        console.log(`\n[API] Cerere înregistrare nouă pentru: ${email}`);
        
        const userId = await registerUser(email, password);
        const containerId = await createContainerForUser(userId);
        

        res.status(201).json({ 
            message: 'Cont creat cu succes!', 
            userId,
            containerId 
        });
    } catch (err) {
        console.error("EROARE SERVER:", err);
        res.status(500).json({ error: err.message || 'Eroare internă' });
    }
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`\n==========================================`);
    console.log(`--EduCode Cloud & Compiler (EcCC) Activat--`);
    console.log(`Adresă: http://localhost:${PORT}`);
    console.log(`DB: data/database.sqlite`);
    console.log(`==========================================\n`);
});