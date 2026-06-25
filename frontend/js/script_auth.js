let pendingRegistrationData = {};
let currentUserEmail = '';
let currentScreen = 'screen-login';
let resetEmailTarget = '';

// ─── NAVIGARE URL ──────────────────────────────────────────────
window.addEventListener('DOMContentLoaded', () => {
    const action = new URLSearchParams(window.location.search).get('action');
    switchScreen(action === 'register' ? 'screen-register-1' : 'screen-login');
});

// Ecranele care au nevoie de butonul Back
const backScreens = ['screen-register-2', 'screen-verify', 'screen-reset-verify', 'screen-new-password'];

function switchScreen(targetId) {
    document.querySelectorAll('.auth-screen').forEach(s => s.classList.remove('active'));
    const target = document.getElementById(targetId);
    if (target) { target.classList.add('active'); currentScreen = targetId; }
    document.getElementById('back-btn-container').style.display = backScreens.includes(targetId) ? 'block' : 'none';
}

document.getElementById('back-btn-container').addEventListener('click', () => {
    const backMap = {
        'screen-register-2': 'screen-register-1',
        'screen-verify': 'screen-login',
        'screen-reset-verify': 'screen-forgot',
        'screen-new-password': 'screen-reset-verify',
    };
    if (backMap[currentScreen]) switchScreen(backMap[currentScreen]);
});

// ─── HELPER: mostra erori ──────────────────────────────────────
function setError(id, msg) { const el = document.getElementById(id); if (el) el.textContent = msg; }
function clearErrors() {
    ['login-error','reg1-error','reg2-error','verify-error','forgot-error','reset-verify-error','new-pass-error']
        .forEach(id => setError(id, ''));
}

// ─── HELPER: buton loading ─────────────────────────────────────
function setLoading(btnId, loading, defaultText) {
    const btn = document.getElementById(btnId);
    if (!btn) return;
    btn.disabled = loading;
    btn.textContent = loading ? 'Se procesează...' : defaultText;
}

// ─── REGISTER PASUL 1 ──────────────────────────────────────────
document.getElementById('form-register-1').addEventListener('submit', e => {
    e.preventDefault();
    clearErrors();
    pendingRegistrationData = {
        nume: document.getElementById('reg-fname').value.trim(),
        prenume: document.getElementById('reg-lname').value.trim(),
        email: document.getElementById('reg-email').value.trim(),
        telefon: document.getElementById('reg-phone').value.trim(),
        scoala: document.getElementById('reg-school').value.trim()
    };
    currentUserEmail = pendingRegistrationData.email;
    switchScreen('screen-register-2');
});

// ─── REGISTER PASUL 2 ──────────────────────────────────────────
document.getElementById('form-register-2').addEventListener('submit', async e => {
    e.preventDefault();
    clearErrors();
    const parola = document.getElementById('reg-password').value;
    const confirm = document.getElementById('reg-password-confirm').value;

    if (parola.length < 6) { setError('reg2-error', 'Parola trebuie să aibă minim 6 caractere.'); return; }
    if (parola !== confirm) { setError('reg2-error', 'Parolele nu coincid!'); return; }

    pendingRegistrationData.parola = parola;
    setLoading('btn-register', true, 'Register');

    try {
        const res = await fetch('/api/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(pendingRegistrationData)
        });
        const data = await res.json();
        if (data.success) {
            document.getElementById('verify-email-display').textContent = currentUserEmail;
            switchScreen('screen-verify');
        } else {
            setError('reg2-error', data.error || 'Eroare la creare cont.');
        }
    } catch { setError('reg2-error', 'Eroare de conexiune la server.'); }
    finally { setLoading('btn-register', false, 'Register'); }
});

// ─── VERIFICARE CONT ──────────────────────────────────────────
document.getElementById('form-verify').addEventListener('submit', async e => {
    e.preventDefault();
    clearErrors();
    const code = document.getElementById('verify-code').value.trim();
    try {
        const res = await fetch('/api/verify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: currentUserEmail, code })
        });
        const data = await res.json();
        if (data.success) {
            saveSession({
                userId: data.userId, token: data.token,
                name: data.name, prenume: data.prenume,
                email: data.email, containerId: data.containerId
            });
            window.location.href = 'home.html';
        } else {
            setError('verify-error', data.error || 'Cod incorect.');
        }
    } catch { setError('verify-error', 'Eroare de conexiune.'); }
});

document.getElementById('resend-verify-btn').addEventListener('click', async () => {
    try {
        await fetch('/api/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(pendingRegistrationData)
        });
        setError('verify-error', '');
        document.getElementById('verify-code').placeholder = 'Cod nou trimis!';
    } catch { setError('verify-error', 'Nu s-a putut retrimite codul.'); }
});

// ─── LOGIN ────────────────────────────────────────────────────
document.getElementById('form-login').addEventListener('submit', async e => {
    e.preventDefault();
    clearErrors();
    const email = document.getElementById('login-email').value.trim();
    const parola = document.getElementById('login-password').value;
    currentUserEmail = email;
    setLoading('btn-login', true, 'Login');

    try {
        const res = await fetch('/api/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, parola })
        });
        const data = await res.json();

        if (res.ok && data.success) {
            saveSession({
                userId: data.userId, token: data.token,
                name: data.name, prenume: data.prenume,
                email: data.email, telefon: data.telefon,
                scoala: data.scoala, containerId: data.containerId
            });
            window.location.href = 'home.html';
        } else {
            if (data.error && data.error.includes('nu este verificat')) {
                setError('login-error', data.error);
                document.getElementById('verify-email-display').textContent = email;
                setTimeout(() => switchScreen('screen-verify'), 1500);
            } else {
                setError('login-error', data.error || 'Email sau parolă incorectă.');
            }
        }
    } catch { setError('login-error', 'Eroare de server. Încearcă din nou.'); }
    finally { setLoading('btn-login', false, 'Login'); }
});

// ─── FORGOT PASSWORD ──────────────────────────────────────────
document.getElementById('form-forgot').addEventListener('submit', async e => {
    e.preventDefault();
    clearErrors();
    const email = document.getElementById('forgot-email').value.trim();
    resetEmailTarget = email;
    setLoading('btn-forgot', true, 'Send reset code');

    try {
        const res = await fetch('/api/forgot-password', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email })
        });
        const data = await res.json();
        if (data.success) {
            document.getElementById('reset-email-display').textContent = email;
            switchScreen('screen-reset-verify');
        } else {
            setError('forgot-error', data.error || 'Eroare la trimiterea codului.');
        }
    } catch { setError('forgot-error', 'Eroare de conexiune.'); }
    finally { setLoading('btn-forgot', false, 'Send reset code'); }
});

document.getElementById('resend-reset-btn').addEventListener('click', async () => {
    try {
        await fetch('/api/forgot-password', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: resetEmailTarget })
        });
        setError('reset-verify-error', '');
        document.getElementById('reset-code').placeholder = 'Cod nou trimis!';
    } catch { setError('reset-verify-error', 'Nu s-a putut retrimite codul.'); }
});

// ─── VERIFY RESET CODE ────────────────────────────────────────
document.getElementById('form-reset-verify').addEventListener('submit', e => {
    e.preventDefault();
    clearErrors();
    const code = document.getElementById('reset-code').value.trim();
    if (code.length !== 6) { setError('reset-verify-error', 'Introdu un cod valid de 6 cifre.'); return; }
    // Stocăm codul în memorie și mergem la next screen
    window._resetCode = code;
    switchScreen('screen-new-password');
});

// ─── SET NEW PASSWORD ─────────────────────────────────────────
document.getElementById('form-new-password').addEventListener('submit', async e => {
    e.preventDefault();
    clearErrors();
    const newPassword = document.getElementById('new-password').value;
    const confirm = document.getElementById('new-password-confirm').value;

    if (newPassword.length < 6) { setError('new-pass-error', 'Parola trebuie să aibă minim 6 caractere.'); return; }
    if (newPassword !== confirm) { setError('new-pass-error', 'Parolele nu coincid!'); return; }

    setLoading('btn-set-password', true, 'Save New Password');

    try {
        const res = await fetch('/api/reset-password', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: resetEmailTarget, code: window._resetCode, newPassword })
        });
        const data = await res.json();
        if (data.success) {
            // Afișăm mesaj succces și redirecționăm la login
            setError('new-pass-error', '');
            document.getElementById('btn-set-password').textContent = '✓ Parolă schimbată!';
            document.getElementById('btn-set-password').style.background = 'rgba(16,185,129,0.2)';
            setTimeout(() => switchScreen('screen-login'), 1800);
        } else {
            setError('new-pass-error', data.error || 'Eroare la resetarea parolei.');
        }
    } catch { setError('new-pass-error', 'Eroare de conexiune.'); }
    finally {
        if (document.getElementById('btn-set-password').textContent !== '✓ Parolă schimbată!')
            setLoading('btn-set-password', false, 'Save New Password');
    }
});

// ─── SESSION HELPERS (disponibile pe această pagină) ──────────
function saveSession(data) {
    localStorage.setItem('educode_session', JSON.stringify(data));
}
