// ==========================================
// 1. INIȚIALIZARE MONACO EDITOR & AUTOSAVE
// ==========================================
const urlParams = new URLSearchParams(window.location.search);
const projectLang = urlParams.get('lang') || 'python';
const projectName = urlParams.get('name') || 'Untitled';
const mockUserName = "Teodor";

const codeTemplates = {
    'python': ``,
    'cpp': `#include <iostream>\nusing namespace std;\n\nint main() {\n    \n    return 0;\n}`,
    'c': `#include <stdio.h>\n\nint main() {\n    \n    return 0;\n}`
};

require.config({ paths: { 'vs': 'https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.39.0/min/vs' }});

// AICI ERA PROBLEMA: Monaco avea o problemă cu funcția "async" pusă direct. Acum e curat!
require(['vs/editor/editor.main'], function() {
    
    (async function initEditor() {
        let initialCode = codeTemplates[projectLang];
        
        try {
            const res = await fetch('/api/read', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ projectName: projectName, lang: projectLang, userId: 1 })
            });
            const data = await res.json();
            
            // Dacă găsim codul anterior salvat, îl punem pe acela!
            if (data.success && data.code && !data.code.includes('No such file')) {
                initialCode = data.code;
            }
        } catch (e) {
            console.error("Nu am putut citi codul anterior:", e);
        }

        let lastSavedCode = initialCode;

        // Snippets Python
        monaco.languages.registerCompletionItemProvider('python', {
            provideCompletionItems: function(model, position) {
                var word = model.getWordUntilPosition(position);
                var range = { startLineNumber: position.lineNumber, endLineNumber: position.lineNumber, startColumn: word.startColumn, endColumn: word.endColumn };
                return {
                    suggestions: [
                        { label: 'def', kind: monaco.languages.CompletionItemKind.Snippet, insertText: 'def ${1:func_name}(${2:args}):\n\t${3:pass}', insertTextRules: 4, range: range },
                        { label: 'class', kind: monaco.languages.CompletionItemKind.Snippet, insertText: 'class ${1:ClassName}:\n\tdef __init__(self, ${2:args}):\n\t\t${3:pass}', insertTextRules: 4, range: range },
                        { label: 'ifmain', kind: monaco.languages.CompletionItemKind.Snippet, insertText: 'if __name__ == "__main__":\n\t${1:main()}', insertTextRules: 4, range: range },
                        { label: 'for', kind: monaco.languages.CompletionItemKind.Snippet, insertText: 'for ${1:i} in range(${2:n}):\n\t${3:pass}', insertTextRules: 4, range: range },
                        { label: 'while', kind: monaco.languages.CompletionItemKind.Snippet, insertText: 'while ${1:condition}:\n\t${2:pass}', insertTextRules: 4, range: range },
                        { label: 'print', kind: monaco.languages.CompletionItemKind.Function, insertText: 'print(${1:value})', insertTextRules: 4, range: range },
                        { label: 'input', kind: monaco.languages.CompletionItemKind.Function, insertText: 'input("${1:prompt: }")', insertTextRules: 4, range: range },
                        { label: 'append', kind: monaco.languages.CompletionItemKind.Method, insertText: 'append(${1:item})', insertTextRules: 4, range: range },
                        { label: 'sort', kind: monaco.languages.CompletionItemKind.Method, insertText: 'sort(reverse=${1:False})', insertTextRules: 4, range: range }
                    ]
                };
            }
        });

        // Snippets C++
        monaco.languages.registerCompletionItemProvider('cpp', {
            provideCompletionItems: function(model, position) {
                var word = model.getWordUntilPosition(position);
                var range = { startLineNumber: position.lineNumber, endLineNumber: position.lineNumber, startColumn: word.startColumn, endColumn: word.endColumn };
                return {
                    suggestions: [
                        { label: 'main', kind: monaco.languages.CompletionItemKind.Snippet, insertText: 'int main() {\n\t${1:}\n\treturn 0;\n}', insertTextRules: 4, range: range },
                        { label: 'include', kind: monaco.languages.CompletionItemKind.Snippet, insertText: '#include <${1:iostream}>', insertTextRules: 4, range: range },
                        { label: 'for', kind: monaco.languages.CompletionItemKind.Snippet, insertText: 'for (int i = 0; i < ${1:n}; i++) {\n\t${2:}\n}', insertTextRules: 4, range: range },
                        { label: 'forr', detail: 'Range-based for loop', kind: monaco.languages.CompletionItemKind.Snippet, insertText: 'for (auto& ${1:x} : ${2:vec}) {\n\t${3:}\n}', insertTextRules: 4, range: range },
                        { label: 'cout', kind: monaco.languages.CompletionItemKind.Snippet, insertText: 'cout << ${1:value} << endl;', insertTextRules: 4, range: range },
                        { label: 'cin', kind: monaco.languages.CompletionItemKind.Snippet, insertText: 'cin >> ${1:variable};', insertTextRules: 4, range: range },
                        { label: 'vector', kind: monaco.languages.CompletionItemKind.Class, insertText: 'vector<${1:int}> ${2:v};', insertTextRules: 4, range: range },
                        { label: 'string', kind: monaco.languages.CompletionItemKind.Class, insertText: 'string ${1:s};', insertTextRules: 4, range: range },
                        { label: 'sort', kind: monaco.languages.CompletionItemKind.Function, insertText: 'sort(${1:v}.begin(), ${1:v}.end());', insertTextRules: 4, range: range },
                        { label: 'push_back', kind: monaco.languages.CompletionItemKind.Method, insertText: 'push_back(${1:value});', insertTextRules: 4, range: range }
                    ]
                };
            }
        });

        window.editor = monaco.editor.create(document.getElementById('monaco-editor'), {
            value: initialCode,
            language: projectLang,
            theme: 'vs-dark',       
            automaticLayout: true,  
            fontSize: 15,
            fontFamily: "'Consolas', 'Courier New', monospace",
            minimap: { enabled: false }, 
            wordWrap: 'on',
            tabSize: 4,
            scrollBeyondLastLine: false, 
            quickSuggestions: { other: true, comments: true, strings: true },
            acceptSuggestionOnEnter: 'smart',
            tabCompletion: 'on',              
            wordBasedSuggestions: true,       
            parameterHints: { enabled: true },
            snippetSuggestions: 'inline',     
            formatOnPaste: true,              
            formatOnType: true,               
            autoIndent: "full",               
            bracketPairColorization: { enabled: true }
        });

        // AUTOSAVE LA 5 SECUNDE
        setInterval(async () => {
            if (!window.editor) return;
            const currentCode = window.editor.getValue();
            
            if (currentCode !== lastSavedCode) {
                try {
                    await fetch('/api/save', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ code: currentCode, lang: projectLang, projectName: projectName, userId: 1 })
                    });
                    lastSavedCode = currentCode;
                    console.log("[EduCode] Proiect salvat automat.");
                } catch (err) {
                    console.error("[EduCode] Eroare la autosave:", err);
                }
            }
        }, 5000);

    })(); // Aici se apelează funcția care pornește editorul
});

// ==========================================
// 2. INIȚIALIZARE TERMINAL REAL
// ==========================================
document.addEventListener("DOMContentLoaded", () => {
    
    document.getElementById('term-user-name').innerText = mockUserName;

    const terminalContainer = document.getElementById('terminal-container');
    const term = new Terminal({
        cursorBlink: true,
        theme: { background: '#1e212b', foreground: '#f8f8f2', cursor: '#f8f8f2', selection: 'rgba(255, 255, 255, 0.3)' },
        fontFamily: 'Consolas, monospace',
        fontSize: 14
    });

    const fitAddon = new FitAddon.FitAddon();
    term.loadAddon(fitAddon);
    term.open(terminalContainer);
    fitAddon.fit(); 

    window.addEventListener('resize', () => fitAddon.fit());

    const socket = io(); 

    socket.on('connect', () => {
        socket.emit('start-terminal-session', { projectName: projectName, lang: projectLang });
    });

    term.onData((data) => socket.emit('terminal-input', data));
    socket.on('terminal-output', (data) => term.write(data));

    // ==========================================
    // 3. LOGICA BUTOANELOR (RUN INTERACTIV CONTINUU)
    // ==========================================
    const outputContent = document.getElementById('output-content');
    let isProgramRunning = false;
    let currentInputLine = "";
    let inputSpan = null; 

    function stripAnsiCodes(str) {
        return str.replace(/\x1B(?:[@-Z\\-_]|\[[0-?]*[ -/]*[@-~])/g, '');
    }

    function printToOutput(text, type = "normal") {
        if (!text || text === '') return;
        const span = document.createElement('span');
        span.className = `output-line ${type}`;
        span.innerText = text;
        
        if (isProgramRunning && inputSpan) {
            outputContent.insertBefore(span, inputSpan);
        } else {
            outputContent.appendChild(span);
        }
        outputContent.scrollTop = outputContent.scrollHeight; 
    }

    function updateInputLine() {
        if (!inputSpan && isProgramRunning) {
            inputSpan = document.createElement('span');
            inputSpan.className = 'output-line input-echo';
            outputContent.appendChild(inputSpan);
        }
        if (inputSpan) {
            inputSpan.innerText = currentInputLine + '█'; 
        }
        outputContent.scrollTop = outputContent.scrollHeight;
    }

    document.getElementById('btn-run').addEventListener('click', () => {
        if (!window.editor) return;
        
        outputContent.innerHTML = ''; 
        printToOutput(`[EduCode] Executing ${projectName}...\n\n`, 'system-msg');
        
        isProgramRunning = true;
        currentInputLine = "";
        updateInputLine(); 
        
        outputContent.focus(); 
        
        socket.emit('run-code-interactive', {
            code: window.editor.getValue(),
            lang: projectLang,
            projectName: projectName
        });
    });

    socket.on('run-output', (data) => {
        let type = data.type === 'stderr' ? 'error' : 'normal';
        printToOutput(stripAnsiCodes(data.text), type);
    });

    socket.on('run-finished', () => {
        isProgramRunning = false;
        if (inputSpan) {
            inputSpan.innerText = currentInputLine; 
            inputSpan = null;
        }
        printToOutput("\n\n>> Execuție finalizată.\n", 'system-msg');
    });

    outputContent.addEventListener('keydown', (e) => {
        if (!isProgramRunning) return; 

        if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
            e.preventDefault(); 
            currentInputLine += e.key;
            updateInputLine();
        } 
        else if (e.key === 'Backspace') {
            e.preventDefault();
            currentInputLine = currentInputLine.slice(0, -1);
            updateInputLine();
        } 
        else if (e.key === 'Enter') {
            e.preventDefault();
            if (inputSpan) inputSpan.innerText = currentInputLine + '\n';
            
            socket.emit('run-input', currentInputLine); 
            
            currentInputLine = "";
            inputSpan = null;
            updateInputLine();
        }
    });

    outputContent.addEventListener('paste', (e) => {
        if (!isProgramRunning) return; 
        
        e.preventDefault(); 
        let pasteData = (e.clipboardData || window.clipboardData).getData('text');
        
        if (pasteData) {
            let lines = pasteData.split(/\r?\n/);
            for (let i = 0; i < lines.length; i++) {
                currentInputLine += lines[i];
                if (i < lines.length - 1) {
                    if (inputSpan) inputSpan.innerText = currentInputLine + '\n';
                    socket.emit('run-input', currentInputLine); 
                    currentInputLine = "";
                    inputSpan = null;
                    updateInputLine();
                }
            }
            updateInputLine();
        }
    });

    // ==========================================
    // BUTON DEBUG (Verificare Sintaxă)
    // ==========================================
    document.getElementById('btn-debug').addEventListener('click', async () => {
        if (!window.editor) return;

        const debugStatus = document.getElementById('debug-status');
        debugStatus.style.display = 'flex';
        debugStatus.className = 'debug-status checking';
        debugStatus.innerHTML = '<svg class="spin-icon" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12a9 9 0 11-6.219-8.56"/></svg> Verificare...';

        const userCode = window.editor.getValue();

        try {
            const response = await fetch('/api/debug', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ code: userCode, lang: projectLang, projectName: projectName, userId: 1 })
            });

            const data = await response.json();

            if (data.errorCount === 0) {
                debugStatus.className = 'debug-status success';
                debugStatus.innerHTML = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 6L9 17l-5-5"/></svg> 0 Erori';
                setTimeout(() => { if (debugStatus.className.includes('success')) debugStatus.style.display = 'none'; }, 4000);
            } else {
                debugStatus.className = 'debug-status error';
                debugStatus.innerHTML = `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg> ${data.errorCount} Eroare(i)`;
                printToOutput(`\n[Debug] S-au găsit ${data.errorCount} erori de sintaxă:\n`, 'system-msg');
                printToOutput(stripAnsiCodes(data.output), 'error');
            }

        } catch (err) {
            debugStatus.className = 'debug-status error';
            debugStatus.innerHTML = 'Eroare Server';
        }
    });

    // ==========================================
    // 4. MODALUL DRAG & DROP
    // ==========================================
    const btnAddFile = document.getElementById('btn-add-file');
    const modalFileUpload = document.getElementById('modal-file-upload');
    const btnCancelUpload = document.getElementById('btn-cancel-upload');
    const dropZone = document.getElementById('drop-zone');
    const fileInput = document.getElementById('file-input');

    btnAddFile.addEventListener('click', () => modalFileUpload.classList.add('active'));
    btnCancelUpload.addEventListener('click', () => modalFileUpload.classList.remove('active'));
    modalFileUpload.addEventListener('click', (e) => {
        if (e.target === modalFileUpload) modalFileUpload.classList.remove('active');
    });

    dropZone.addEventListener('click', () => fileInput.click());

    fileInput.addEventListener('change', (e) => {
        if (e.target.files.length > 0) handleFileUpload(e.target.files[0]);
    });

    dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropZone.classList.add('dragover');
    });

    dropZone.addEventListener('dragleave', () => dropZone.classList.remove('dragover'));

    dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.classList.remove('dragover');
        if (e.dataTransfer.files.length > 0) handleFileUpload(e.dataTransfer.files[0]);
    });

    function handleFileUpload(file) {
        console.log("Upload pregătit:", file.name);
        alert(`Fișierul "${file.name}" a fost preluat!`);
        modalFileUpload.classList.remove('active');
    }
});