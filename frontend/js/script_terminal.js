document.addEventListener("DOMContentLoaded", () => {
    
    const terminalContainer = document.getElementById('full-terminal-container');
    
    // Configurăm terminalul cu o vizibilitate mai mare și fonturi clare
    const term = new Terminal({
        cursorBlink: true,
        theme: { 
            background: '#0d0f14', 
            foreground: '#e5e7eb', 
            cursor: '#38bdf8', 
            selection: 'rgba(56, 189, 248, 0.3)' 
        },
        fontFamily: "'Consolas', 'Courier New', monospace",
        fontSize: 16, // Font puțin mai mare pentru full-screen
        lineHeight: 1.2
    });

    const fitAddon = new FitAddon.FitAddon();
    term.loadAddon(fitAddon);
    term.open(terminalContainer);
    
    // Fit inițial și fit la resize-ul paginii
    fitAddon.fit(); 
    window.addEventListener('resize', () => {
        fitAddon.fit();
    });

    const socket = io(); 

    socket.on('connect', () => {
        // Trimitem un obiect cu projectName gol. 
        // Backend-ul tău din dockerService.js va vedea că nu are nume și te va arunca direct în folderul rădăcină: /home/student/workspace
        socket.emit('start-terminal-session', { projectName: '', lang: '' });
        
        term.writeln('\x1b[32m[EduCode] Conexiune stabilita cu instanta Ubuntu 22.04 LTS...\x1b[0m');
        term.writeln('');
    });

    // Când tu tastezi în interfață, trimite la Docker
    term.onData((data) => {
        socket.emit('terminal-input', data);
    });

    // Când Docker răspunde, scrie pe ecran
    socket.on('terminal-output', (data) => {
        term.write(data);
    });

    socket.on('disconnect', () => {
        term.writeln('\n\x1b[31m[EduCode] Conexiunea cu serverul s-a inchis.\x1b[0m');
    });
});