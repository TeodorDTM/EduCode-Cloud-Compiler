// ==========================================
// 1. INIȚIALIZARE MONACO EDITOR
// ==========================================
const urlParams = new URLSearchParams(window.location.search);
const projectLang = urlParams.get('lang') || 'python';
const projectName = urlParams.get('name') || 'Untitled';

const codeTemplates = {
    'python': `def main():\n    print("Hello from EduCode Python Workspace!")\n    \n    # Scrie codul tău aici\n    for i in range(5):\n        print(f"Iterația {i}")\n\nif __name__ == "__main__":\n    main()`,
    'cpp': `#include <iostream>\n\nint main() {\n    std::cout << "Hello from EduCode C++ Workspace!" << std::endl;\n    return 0;\n}`,
    'c': `#include <stdio.h>\n\nint main() {\n    printf("Hello from EduCode C Workspace!\\n");\n    return 0;\n}`
};

require.config({ paths: { 'vs': 'https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.39.0/min/vs' }});

require(['vs/editor/editor.main'], function() {
    window.editor = monaco.editor.create(document.getElementById('monaco-editor'), {
        value: codeTemplates[projectLang] || codeTemplates['python'],
        language: projectLang,
        theme: 'vs-dark',       
        automaticLayout: true,  
        fontSize: 15,
        fontFamily: "'Consolas', 'Courier New', monospace",
        minimap: { enabled: false }, 
        wordWrap: 'on',
        tabSize: 4,
        scrollBeyondLastLine: false, 
        suggestOnTriggerCharacters: true 
    });
});

// ==========================================
// 2. INIȚIALIZARE TERMINAL REAL (XTERM.JS + SOCKET.IO)
// ==========================================
document.addEventListener("DOMContentLoaded", () => {
    const terminalContainer = document.getElementById('terminal-container');
    
    const term = new Terminal({
        cursorBlink: true,
        theme: {
            background: '#1e1e2e',
            foreground: '#f8f8f2',
            cursor: '#f8f8f2',
            selection: 'rgba(255, 255, 255, 0.3)'
        },
        fontFamily: 'Consolas, monospace',
        fontSize: 14
    });

    const fitAddon = new FitAddon.FitAddon();
    term.loadAddon(fitAddon);
    term.open(terminalContainer);
    fitAddon.fit(); 

    window.addEventListener('resize', () => {
        fitAddon.fit();
    });

    term.writeln('\x1b[38;5;111mSe inițiază conexiunea WebSockets către EduCode Cloud...\x1b[0m');

    const socket = io(); 

    socket.on('connect', () => {
        socket.emit('start-terminal-session', { 
            projectName: projectName,
            lang: projectLang
        });
    });

    term.onData((data) => {
        socket.emit('terminal-input', data);
    });

    socket.on('terminal-output', (data) => {
        term.write(data);
    });

    socket.on('disconnect', () => {
        term.writeln('\r\n\x1b[1;31m[Sistem] Conexiunea cu containerul a fost pierdută.\x1b[0m');
    });

    // ==========================================
    // 3. LOGICA BUTONULUI RUN (Rulare Server-Side)
    // ==========================================
    const outputContent = document.getElementById('output-content');

    function printToOutput(text, type = "normal") {
        const div = document.createElement('div');
        div.className = `output-line ${type}`;
        div.innerText = text; // Folosim innerText ca să păstrăm formatarea /n (enter-urile) din cod
        outputContent.appendChild(div);
        outputContent.scrollTop = outputContent.scrollHeight; 
    }

    document.getElementById('btn-run').addEventListener('click', async () => {
        if (!window.editor) return;
        
        outputContent.innerHTML = ''; 
        printToOutput(`[EduCode] Se compilează proiectul ${projectName}...`, 'system-msg');
        
        const userCode = window.editor.getValue();
        
        try {
            // Trimitem codul către serverul Node.js
            const response = await fetch('/api/run', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    code: userCode,
                    lang: projectLang,
                    userId: 1 // TODO: De înlocuit cu ID-ul real din sesiune ulterior
                })
            });

            const data = await response.json();

            if (data.success) {
                printToOutput("\n[Rezultat]:", 'success');
                printToOutput(data.output); // Afișăm output-ul real venit din Linux
                printToOutput("\n>> Execuție finalizată.", 'system-msg');
            } else {
                printToOutput("\n[Eroare]:", 'error');
                printToOutput(data.error, 'error');
            }

        } catch (err) {
            printToOutput("\n[Eroare fatală] Nu se poate contacta serverul.", 'error');
        }
    });

    document.getElementById('btn-format').addEventListener('click', () => {
        if(window.editor) {
            window.editor.getAction('editor.action.formatDocument').run();
        }
    });
});