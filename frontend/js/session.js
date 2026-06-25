/**
 * EduCode — Session Manager
 * Gestionează sesiunea utilizatorului în localStorage.
 * Include acest fișier ÎNAINTE de orice alt script în paginile protejate.
 */

const SESSION_KEY = 'educode_session';

/** Salvează datele sesiunii după login/verify */
function saveSession(data) {
    localStorage.setItem(SESSION_KEY, JSON.stringify(data));
}

/** Returnează obiectul sesiunii sau null */
function getSession() {
    try {
        const raw = localStorage.getItem(SESSION_KEY);
        return raw ? JSON.parse(raw) : null;
    } catch {
        return null;
    }
}

/**
 * Verifică autentificarea. Dacă nu există sesiune, redirecționează la login.
 * Returnează sesiunea curentă sau null.
 */
function requireAuth() {
    const session = getSession();
    if (!session || !session.token) {
        window.location.href = 'auth.html?action=login';
        return null;
    }
    return session;
}

/** Șterge sesiunea și redirecționează la login */
function logout() {
    localStorage.removeItem(SESSION_KEY);
    window.location.href = 'auth.html?action=login';
}

/** Returnează headere de autentificare pentru fetch */
function getAuthHeaders() {
    const session = getSession();
    return {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session?.token || ''}`
    };
}

/** Returnează inițialele utilizatorului (ex: "TP" pentru Teodor Pop) */
function getUserInitials() {
    const session = getSession();
    if (!session) return '?';
    const n = (session.name || '').charAt(0).toUpperCase();
    const p = (session.prenume || '').charAt(0).toUpperCase();
    return n + p || '?';
}

/** Returnează prenumele + numele afișabil */
function getDisplayName() {
    const session = getSession();
    if (!session) return 'Utilizator';
    return session.name || 'Utilizator';
}

/** Actualizează avatar-ele din sidebar cu inițialele utilizatorului */
function initNavAvatar() {
    const session = getSession();
    const initials = getUserInitials();
    document.querySelectorAll('.nav-avatar-text').forEach(el => {
        el.textContent = initials;
    });
}

// Auto-inițializare avatar când DOM-ul e gata
document.addEventListener('DOMContentLoaded', initNavAvatar);
