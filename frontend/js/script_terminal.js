// ══════════════════════════════════════════════════
//  STATE
// ══════════════════════════════════════════════════
const tabs   = new Map();   // id → { term, fitAddon, socket, panelEl, tabEl, label }
let activeId = null;
let nextId   = 1;
let session  = null;

const THEME = {
    background:  '#0d0f14', foreground:  '#e2e8f0',
    cursor:      '#38bdf8', cursorAccent:'#0d0f14',
    selection:   'rgba(56,189,248,0.22)',
    black:'#1a1c26', red:'#f87171', green:'#34d399', yellow:'#fbbf24',
    blue:'#60a5fa', magenta:'#a78bfa', cyan:'#38bdf8', white:'#e2e8f0',
    brightBlack:'#374151', brightWhite:'#f8fafc',
};

// ══════════════════════════════════════════════════
//  INIT
// ══════════════════════════════════════════════════
document.addEventListener('DOMContentLoaded', () => {
    session = requireAuth();
    if (!session) return;

    // Badge: arată NUMELE utilizatorului, nu email-ul
    const displayName = session.name || 'Student';
    document.getElementById('badge-user').textContent = displayName;

    // Avatar sidebar
    const initials = ((session.name || '').charAt(0) + (session.prenume || '').charAt(0)).toUpperCase() || '?';
    document.querySelectorAll('.nav-avatar-text').forEach(el => el.textContent = initials);

    // Butoane și shortcuts
    document.getElementById('btn-new-tab').addEventListener('click', () => createTab());
    document.addEventListener('keydown', e => {
        if ((e.ctrlKey || e.metaKey) && e.shiftKey) {
            if (e.key === 'T' || e.key === 't') { e.preventDefault(); createTab(); }
            if (e.key === 'W' || e.key === 'w') { e.preventDefault(); if (activeId) closeTab(activeId); }
        }
        if ((e.ctrlKey || e.metaKey) && e.key === 'Tab') {
            e.preventDefault(); cycleTabs(e.shiftKey ? -1 : 1);
        }
    });

    // Primul tab
    createTab();
});

// ══════════════════════════════════════════════════
//  CREARE TAB
// ══════════════════════════════════════════════════
function createTab() {
    const id    = nextId++;
    const label = `Terminal ${id}`;

    // ── Tab button ────────────────────────────────
    const tabEl = document.createElement('div');
    tabEl.className  = 'term-tab';
    tabEl.dataset.id = id;
    tabEl.innerHTML  = `
        <svg class="term-tab-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="4 17 10 11 4 5"></polyline>
            <line x1="12" y1="19" x2="20" y2="19"></line>
        </svg>
        <span class="term-tab-name">${label}</span>
        <button class="term-tab-close" title="Close tab">×</button>`;

    tabEl.addEventListener('click', e => {
        if (!e.target.classList.contains('term-tab-close')) switchTab(id);
    });
    tabEl.querySelector('.term-tab-close').addEventListener('click', e => {
        e.stopPropagation(); closeTab(id);
    });
    document.getElementById('term-tabs').appendChild(tabEl);

    // ── Panel div ─────────────────────────────────
    const panelEl = document.createElement('div');
    panelEl.className  = 'term-panel';
    panelEl.dataset.id = id;
    document.getElementById('term-panels-wrap').appendChild(panelEl);

    // ── xterm.js ──────────────────────────────────
    const term = new Terminal({
        cursorBlink: true,
        theme: THEME,
        fontFamily: "'Consolas', 'Courier New', monospace",
        fontSize:   15,
        lineHeight: 1.25,
        scrollback: 5000,
        fastScrollModifier: 'alt',
    });
    const fitAddon = new FitAddon.FitAddon();
    term.loadAddon(fitAddon);

    // ── Socket ────────────────────────────────────
    const socket = io();

    // Stocăm tab-ul
    tabs.set(id, { id, term, fitAddon, socket, panelEl, tabEl, label });

    // Activăm tab-ul (face panelul vizibil și face open pe terminal)
    switchTab(id);

    // ── CRITRIC: înregistrăm TOȚI listenerii IMEDIAT ──────────────
    // (nu după animație — altfel socket se conectează înainte, input blocat)

    // Terminal → socket (input)
    term.onData(data => socket.emit('terminal-input', data));

    // Socket → terminal (output)
    socket.on('terminal-output', data => {
        if (tabs.has(id)) term.write(data);
    });

    socket.on('disconnect', () => {
        if (!tabs.has(id)) return;
        term.writeln('\r\n\x1b[31m[EduCode] Connection closed.\x1b[0m');
        tabEl.style.opacity = '0.55';
    });

    socket.on('connect_error', () => {
        if (!tabs.has(id)) return;
        term.writeln('\r\n\x1b[31m[EduCode] Cannot connect to server.\x1b[0m');
    });

    // La conectare: arată mesajul de bun-venit și pornește sesiunea
    socket.on('connect', () => {
        if (!tabs.has(id)) return;
        showWelcome(term, id);
        socket.emit('start-terminal-session', {
            projectName: '',
            lang:        '',
            userId:      session.userId,
        });
    });

    return id;
}

// ══════════════════════════════════════════════════
//  MESAJ DE BUN-VENIT (simplu, rapid, nu blochează)
// ══════════════════════════════════════════════════
function showWelcome(term, id) {
    const displayName = session.name || 'Student';
    const tabNum      = id;

    term.writeln('');
    term.writeln('\x1b[36m  ╔══════════════════════════════════════════╗\x1b[0m');
    term.writeln('\x1b[36m  ║\x1b[0m  \x1b[1m        EduCode Cloud Compiler\x1b[0m        \x1b[90m\x1b[0m  \x1b[36m║\x1b[0m');
    term.writeln('\x1b[36m  ╚══════════════════════════════════════════╝\x1b[0m');
    term.writeln('');
    term.writeln(`\x1b[32m  ✓\x1b[0m  \x1b[90mUbuntu 22.04 LTS container ready\x1b[0m`);
    term.writeln(`\x1b[32m  ✓\x1b[0m  \x1b[90mWorkspace:\x1b[0m \x1b[37m/home/student/workspace\x1b[0m`);
    term.writeln('');
    term.writeln('\x1b[90m  ' + '─'.repeat(42) + '\x1b[0m');
    term.writeln('');
}

// ══════════════════════════════════════════════════
//  SWITCH / CLOSE / CYCLE TABS
// ══════════════════════════════════════════════════
function switchTab(id) {
    if (!tabs.has(id)) return;

    // Dezactivăm tab-ul curent
    if (activeId && tabs.has(activeId)) {
        const cur = tabs.get(activeId);
        cur.panelEl.classList.remove('active');
        cur.tabEl.classList.remove('active');
    }

    activeId = id;
    const tab = tabs.get(id);
    tab.panelEl.classList.add('active');
    tab.tabEl.classList.add('active');

    // Deschidem terminalul în panel dacă nu e deschis
    if (!tab.term.element) {
        tab.term.open(tab.panelEl);
    }

    // Fit după ce panelul devine vizibil
    requestAnimationFrame(() => {
        setTimeout(() => {
            tab.fitAddon.fit();
            tab.term.focus();
        }, 30);
    });

    tab.tabEl.scrollIntoView({ inline: 'nearest', behavior: 'smooth' });
}

function closeTab(id) {
    if (!tabs.has(id)) return;

    if (tabs.size === 1) {
        // Ultimul tab — nu se poate închide
        const { term } = tabs.get(id);
        term.writeln('\r\n\x1b[33m[EduCode] Cannot close the last terminal tab.\x1b[0m');
        return;
    }

    const tab = tabs.get(id);
    try { tab.socket.disconnect(); } catch {}
    try { tab.term.dispose();      } catch {}
    tab.panelEl.remove();
    tab.tabEl.remove();
    tabs.delete(id);

    if (activeId === id) {
        const remaining = [...tabs.keys()];
        activeId = null;
        switchTab(remaining[remaining.length - 1]);
    }
}

function cycleTabs(dir) {
    const ids = [...tabs.keys()];
    if (ids.length < 2) return;
    const idx = ids.indexOf(activeId);
    switchTab(ids[(idx + dir + ids.length) % ids.length]);
}

// ── Resize global ─────────────────────────────────
window.addEventListener('resize', () => {
    if (activeId && tabs.has(activeId)) {
        tabs.get(activeId).fitAddon.fit();
    }
});