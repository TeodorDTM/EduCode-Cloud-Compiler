document.addEventListener('DOMContentLoaded', () => {
    const session = requireAuth();
    if (!session) return;

    const term = new Terminal({
        cursorBlink: true,
        theme: {
            background: '#0d0f14',
            foreground: '#e5e7eb',
            cursor: '#38bdf8',
            selection: 'rgba(56,189,248,0.3)'
        },
        fontFamily: "'Consolas', 'Courier New', monospace",
        fontSize: 16,
        lineHeight: 1.2
    });

    const fitAddon = new FitAddon.FitAddon();
    term.loadAddon(fitAddon);
    term.open(document.getElementById('full-terminal-container'));
    fitAddon.fit();
    window.addEventListener('resize', () => fitAddon.fit());

    const socket = io();

    socket.on('connect', () => {
        socket.emit('start-terminal-session', {
            projectName: '',
            lang: '',
            userId: session.userId
        });
        term.writeln(`\x1b[32m[EduCode] Connected to Ubuntu 22.04 LTS instance...\x1b[0m`);
        term.writeln(`\x1b[90m[Session] User: ${session.email || session.name}\x1b[0m`);
        term.writeln('');
    });

    term.onData(data => socket.emit('terminal-input', data));

    socket.on('terminal-output', data => term.write(data));

    socket.on('disconnect', () => {
        term.writeln('\n\x1b[31m[EduCode] Connection to server closed.\x1b[0m');
    });
});
