// ─── INIȚIALIZARE SESIUNE ─────────────────────────────────────
const session = (function() {
    try { return JSON.parse(localStorage.getItem('educode_session')); } catch { return null; }
})();

if (!session || !session.token) { window.location.href = 'auth.html?action=login'; }

const urlParams    = new URLSearchParams(window.location.search);
const projectLang  = urlParams.get('lang') || 'python';
const projectName  = urlParams.get('name') || 'Untitled';
const userId       = session ? session.userId : 1;
const userEmail    = session ? (session.email || session.name || 'user') : 'user';

// Setări editor din localStorage (salvate de pagina Settings)
const editorSettings = (function() {
    try { return JSON.parse(localStorage.getItem('educode_editor_settings')) || {}; } catch { return {}; }
})();

const AUTOSAVE_INTERVAL = editorSettings.autosave_interval || 5000;

// ─── MONACO EDITOR ────────────────────────────────────────────
require.config({ paths: { 'vs': 'https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.39.0/min/vs' } });

require(['vs/editor/editor.main'], function () {
    (async function initEditor() {
        let initialCode = '';

        try {
            const res = await fetch('/api/read', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ projectName, lang: projectLang, userId })
            });
            const data = await res.json();
            if (data.success && data.code && !data.code.includes('No such file')) {
                initialCode = data.code;
            }
        } catch (e) { console.error('[EduCode] Read error:', e); }

        // ── Snippets Python ──
        monaco.languages.registerCompletionItemProvider('python', {
            provideCompletionItems(model, position) {
                const word = model.getWordUntilPosition(position);
                const range = { startLineNumber: position.lineNumber, endLineNumber: position.lineNumber, startColumn: word.startColumn, endColumn: word.endColumn };
                return {
                    suggestions: [
                        { label: 'def', kind: monaco.languages.CompletionItemKind.Snippet, insertText: 'def ${1:func_name}(${2:args}):\n\t${3:pass}', insertTextRules: 4, range },
                        { label: 'class', kind: monaco.languages.CompletionItemKind.Snippet, insertText: 'class ${1:ClassName}:\n\tdef __init__(self, ${2:args}):\n\t\t${3:pass}', insertTextRules: 4, range },
                        { label: 'ifmain', kind: monaco.languages.CompletionItemKind.Snippet, insertText: 'if __name__ == "__main__":\n\t${1:main()}', insertTextRules: 4, range },
                        { label: 'for', kind: monaco.languages.CompletionItemKind.Snippet, insertText: 'for ${1:i} in range(${2:n}):\n\t${3:pass}', insertTextRules: 4, range },
                        { label: 'while', kind: monaco.languages.CompletionItemKind.Snippet, insertText: 'while ${1:condition}:\n\t${2:pass}', insertTextRules: 4, range },
                        { label: 'print', kind: monaco.languages.CompletionItemKind.Function, insertText: 'print(${1:value})', insertTextRules: 4, range },
                        { label: 'input', kind: monaco.languages.CompletionItemKind.Function, insertText: 'input("${1:prompt}: ")', insertTextRules: 4, range },
                        { label: 'append', kind: monaco.languages.CompletionItemKind.Method, insertText: 'append(${1:item})', insertTextRules: 4, range },
                        { label: 'sort', kind: monaco.languages.CompletionItemKind.Method, insertText: 'sort(reverse=${1:False})', insertTextRules: 4, range },
                        { label: 'len', kind: monaco.languages.CompletionItemKind.Function, insertText: 'len(${1:obj})', insertTextRules: 4, range },
                    ]
                };
            }
        });

        // ── Snippets C++ ──
        monaco.languages.registerCompletionItemProvider('cpp', {
            provideCompletionItems(model, position) {
                const word = model.getWordUntilPosition(position);
                const range = { startLineNumber: position.lineNumber, endLineNumber: position.lineNumber, startColumn: word.startColumn, endColumn: word.endColumn };
                return {
                    suggestions: [
                        { label: 'main', kind: monaco.languages.CompletionItemKind.Snippet, insertText: 'int main() {\n\t${1:}\n\treturn 0;\n}', insertTextRules: 4, range },
                        { label: 'include', kind: monaco.languages.CompletionItemKind.Snippet, insertText: '#include <${1:iostream}>', insertTextRules: 4, range },
                        { label: 'for', kind: monaco.languages.CompletionItemKind.Snippet, insertText: 'for (int i = 0; i < ${1:n}; i++) {\n\t${2:}\n}', insertTextRules: 4, range },
                        { label: 'forr', detail: 'Range-based for', kind: monaco.languages.CompletionItemKind.Snippet, insertText: 'for (auto& ${1:x} : ${2:vec}) {\n\t${3:}\n}', insertTextRules: 4, range },
                        { label: 'cout', kind: monaco.languages.CompletionItemKind.Snippet, insertText: 'cout << ${1:value} << endl;', insertTextRules: 4, range },
                        { label: 'cin', kind: monaco.languages.CompletionItemKind.Snippet, insertText: 'cin >> ${1:variable};', insertTextRules: 4, range },
                        { label: 'vector', kind: monaco.languages.CompletionItemKind.Class, insertText: 'vector<${1:int}> ${2:v};', insertTextRules: 4, range },
                        { label: 'sort', kind: monaco.languages.CompletionItemKind.Function, insertText: 'sort(${1:v}.begin(), ${1:v}.end());', insertTextRules: 4, range },
                        { label: 'push_back', kind: monaco.languages.CompletionItemKind.Method, insertText: 'push_back(${1:value});', insertTextRules: 4, range },
                    ]
                };
            }
        });

        // ── Creare editor ──
        window.editor = monaco.editor.create(document.getElementById('monaco-editor'), {
            value: initialCode,
            language: projectLang,
            theme: editorSettings.editor_theme || 'vs-dark',
            automaticLayout: true,
            fontSize: editorSettings.editor_font_size || 15,
            fontFamily: "'Consolas', 'Courier New', monospace",
            minimap: { enabled: false },
            wordWrap: editorSettings.word_wrap || 'on',
            tabSize: editorSettings.tab_size || 4,
            scrollBeyondLastLine: false,
            quickSuggestions: { other: true, comments: true, strings: true },
            snippetSuggestions: 'inline',
            formatOnPaste: true,
            autoIndent: 'full',
            bracketPairColorization: { enabled: true }
        });

        // Actualizăm titlul tab-ului editorului
        const tabLabel = document.getElementById('editor-tab-label');
        if (tabLabel) tabLabel.textContent = `${projectName}.${projectLang === 'python' ? 'py' : projectLang}`;

        // ── Autosave ──
        let lastSavedCode = initialCode;
        setInterval(async () => {
            if (!window.editor) return;
            const currentCode = window.editor.getValue();
            if (currentCode === lastSavedCode) return;
            try {
                await fetch('/api/save', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ code: currentCode, lang: projectLang, projectName, userId })
                });
                lastSavedCode = currentCode;
            } catch (err) { console.error('[EduCode] Autosave error:', err); }
        }, AUTOSAVE_INTERVAL);

    })();
});

// ─── DOM READY ─────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {

    // Afișăm userul în terminal header
    document.getElementById('term-user-name').textContent = userEmail;

    // Actualizăm avatar
    const initials = ((session?.name || '').charAt(0) + (session?.prenume || '').charAt(0)).toUpperCase() || '?';
    document.querySelectorAll('.nav-avatar-text').forEach(el => el.textContent = initials);

    // ── Terminal xterm.js ──
    const term = new Terminal({
        cursorBlink: true,
        theme: { background: '#1e212b', foreground: '#f8f8f2', cursor: '#f8f8f2', selection: 'rgba(255,255,255,0.3)' },
        fontFamily: 'Consolas, monospace',
        fontSize: 14
    });
    const fitAddon = new FitAddon.FitAddon();
    term.loadAddon(fitAddon);
    term.open(document.getElementById('terminal-container'));
    fitAddon.fit();
    window.addEventListener('resize', () => fitAddon.fit());

    const socket = io();

    socket.on('connect', () => {
        socket.emit('start-terminal-session', { projectName, lang: projectLang, userId });
    });
    term.onData(data => socket.emit('terminal-input', data));
    socket.on('terminal-output', data => term.write(data));

    // ── Output panel helpers ──
    const outputContent = document.getElementById('output-content');
    let isProgramRunning = false;
    let currentInputLine = '';
    let inputSpan = null;

    function printToOutput(text, cls = 'normal') {
        const span = document.createElement('span');
        span.className = 'output-line ' + cls;
        span.textContent = text;
        if (inputSpan) outputContent.insertBefore(span, inputSpan);
        else outputContent.appendChild(span);
        outputContent.scrollTop = outputContent.scrollHeight;
    }

    function updateInputLine() {
        if (!inputSpan) {
            inputSpan = document.createElement('span');
            inputSpan.className = 'output-line input-echo';
            outputContent.appendChild(inputSpan);
        }
        inputSpan.textContent = currentInputLine + '█';
        outputContent.scrollTop = outputContent.scrollHeight;
    }

    function stripAnsiCodes(str) {
        return str.replace(/\x1B\[[0-9;]*[mGKHF]/g, '');
    }

    // ── Run ──
    document.getElementById('btn-run').addEventListener('click', () => {
        if (!window.editor) return;
        outputContent.innerHTML = '';
        printToOutput(`[EduCode] Running ${projectName} (${projectLang})...\n\n`, 'system-msg');
        isProgramRunning = true;
        currentInputLine = '';
        updateInputLine();
        outputContent.focus();
        socket.emit('run-code-interactive', {
            code: window.editor.getValue(),
            lang: projectLang,
            projectName,
            userId
        });
    });

    socket.on('run-output', data => {
        printToOutput(stripAnsiCodes(data.text), data.type === 'stderr' ? 'error' : 'normal');
    });

    socket.on('run-finished', () => {
        isProgramRunning = false;
        if (inputSpan) { inputSpan.textContent = currentInputLine; inputSpan = null; }
        printToOutput('\n\n>> Execution finished.\n', 'system-msg');
    });

    outputContent.addEventListener('keydown', e => {
        if (!isProgramRunning) return;
        if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
            e.preventDefault(); currentInputLine += e.key; updateInputLine();
        } else if (e.key === 'Backspace') {
            e.preventDefault(); currentInputLine = currentInputLine.slice(0, -1); updateInputLine();
        } else if (e.key === 'Enter') {
            e.preventDefault();
            if (inputSpan) inputSpan.textContent = currentInputLine + '\n';
            socket.emit('run-input', currentInputLine);
            currentInputLine = ''; inputSpan = null; updateInputLine();
        }
    });

    outputContent.addEventListener('paste', e => {
        if (!isProgramRunning) return;
        e.preventDefault();
        const lines = ((e.clipboardData || window.clipboardData).getData('text')).split(/\r?\n/);
        for (let i = 0; i < lines.length; i++) {
            currentInputLine += lines[i];
            if (i < lines.length - 1) {
                if (inputSpan) inputSpan.textContent = currentInputLine + '\n';
                socket.emit('run-input', currentInputLine);
                currentInputLine = ''; inputSpan = null; updateInputLine();
            }
        }
        updateInputLine();
    });

    // ── Debug ──
    document.getElementById('btn-debug').addEventListener('click', async () => {
        if (!window.editor) return;
        const debugStatus = document.getElementById('debug-status');
        debugStatus.style.display = 'flex';
        debugStatus.className = 'debug-status checking';
        debugStatus.innerHTML = '<svg class="spin-icon" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12a9 9 0 11-6.219-8.56"/></svg> Checking...';

        try {
            const res = await fetch('/api/debug', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ code: window.editor.getValue(), lang: projectLang, projectName, userId })
            });
            const data = await res.json();
            if (data.errorCount === 0) {
                debugStatus.className = 'debug-status success';
                debugStatus.innerHTML = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 6L9 17l-5-5"/></svg> No errors';
                setTimeout(() => { debugStatus.style.display = 'none'; }, 4000);
            } else {
                debugStatus.className = 'debug-status error';
                debugStatus.innerHTML = `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg> ${data.errorCount} error(s)`;
                printToOutput(`\n[Debug] ${data.errorCount} syntax error(s) found:\n`, 'system-msg');
                printToOutput(stripAnsiCodes(data.output) + '\n', 'error');
            }
        } catch {
            debugStatus.className = 'debug-status error';
            debugStatus.innerHTML = 'Server error';
        }
    });

    // ── Upload File (FUNCȚIONAL) ──
    const modalFileUpload = document.getElementById('modal-file-upload');
    const btnCancelUpload = document.getElementById('btn-cancel-upload');
    const dropZone = document.getElementById('drop-zone');
    const fileInput = document.getElementById('file-input');
    const uploadStatus = document.getElementById('upload-status');

    document.getElementById('btn-add-file').addEventListener('click', () => {
        modalFileUpload.classList.add('active');
        uploadStatus.textContent = '';
        uploadStatus.style.color = '';
    });
    btnCancelUpload.addEventListener('click', () => modalFileUpload.classList.remove('active'));
    modalFileUpload.addEventListener('click', e => { if (e.target === modalFileUpload) modalFileUpload.classList.remove('active'); });

    dropZone.addEventListener('click', () => fileInput.click());
    dropZone.addEventListener('dragover', e => { e.preventDefault(); dropZone.classList.add('dragover'); });
    dropZone.addEventListener('dragleave', () => dropZone.classList.remove('dragover'));
    dropZone.addEventListener('drop', e => {
        e.preventDefault(); dropZone.classList.remove('dragover');
        if (e.dataTransfer.files.length > 0) handleFileUpload(e.dataTransfer.files[0]);
    });
    fileInput.addEventListener('change', e => {
        if (e.target.files.length > 0) handleFileUpload(e.target.files[0]);
    });

    async function handleFileUpload(file) {
        const MAX_SIZE = 2 * 1024 * 1024; // 2MB
        if (file.size > MAX_SIZE) {
            uploadStatus.textContent = 'File too large (max 2MB).';
            uploadStatus.style.color = '#ef4444';
            return;
        }

        uploadStatus.textContent = `Uploading "${file.name}"...`;
        uploadStatus.style.color = '#a1a1aa';

        const reader = new FileReader();
        reader.onload = async (e) => {
            const base64 = e.target.result.split(',')[1]; // rimoviamo "data:...;base64,"
            const targetPath = `/home/student/workspace/${projectName}`;

            try {
                const res = await fetch('/api/fs/upload', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        userId,
                        targetPath,
                        fileContentBase64: base64,
                        fileName: file.name
                    })
                });
                const data = await res.json();
                if (data.success) {
                    uploadStatus.textContent = `✓ "${file.name}" uploaded to your project workspace.`;
                    uploadStatus.style.color = '#10b981';
                    setTimeout(() => modalFileUpload.classList.remove('active'), 2000);
                } else {
                    uploadStatus.textContent = 'Upload failed: ' + (data.error || 'unknown error');
                    uploadStatus.style.color = '#ef4444';
                }
            } catch (err) {
                uploadStatus.textContent = 'Server connection error.';
                uploadStatus.style.color = '#ef4444';
            }
        };
        reader.onerror = () => {
            uploadStatus.textContent = 'Could not read file.';
            uploadStatus.style.color = '#ef4444';
        };
        reader.readAsDataURL(file);
    }
});
