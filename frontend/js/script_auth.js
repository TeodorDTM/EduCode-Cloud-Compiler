// Variabile pentru a păstra starea utilizatorului în sesiune
let pendingRegistrationData = {};
let currentUserEmail = ""; 
let currentScreen = 'screen-login';

// ==========================================
// 1. INIȚIALIZARE & NAVIGARE URL
// ==========================================
window.addEventListener('DOMContentLoaded', () => {
    const urlParams = new URLSearchParams(window.location.search);
    const action = urlParams.get('action'); 
    
    if (action === 'register') {
        switchScreen('screen-register-1');
    } else {
        switchScreen('screen-login');
    }
});

function switchScreen(targetScreenId) {
    document.querySelectorAll('.auth-screen').forEach(screen => {
        screen.classList.remove('active');
    });

    const target = document.getElementById(targetScreenId);
    if (target) {
        target.classList.add('active');
        currentScreen = targetScreenId;
    }

    const backBtn = document.getElementById('back-btn-container');
    if (targetScreenId === 'screen-register-2' || targetScreenId === 'screen-verify') {
        backBtn.style.display = 'block';
    } else {
        backBtn.style.display = 'none';
    }
}

document.getElementById('back-btn-container').addEventListener('click', () => {
    if (currentScreen === 'screen-register-2') switchScreen('screen-register-1');
    else if (currentScreen === 'screen-verify') switchScreen('screen-login');
});

// ==========================================
// 2. LOGICA DE REGISTER (PASUL 1 -> PASUL 2)
// ==========================================
document.getElementById('form-register-1').addEventListener('submit', (e) => {
    e.preventDefault();
    pendingRegistrationData = {
        nume: document.getElementById('reg-fname').value,
        prenume: document.getElementById('reg-lname').value,
        email: document.getElementById('reg-email').value,
        telefon: document.getElementById('reg-phone').value,
        scoala: document.getElementById('reg-school').value
    };
    currentUserEmail = pendingRegistrationData.email; // Salvăm email-ul pentru verificare
    switchScreen('screen-register-2');
});

// ==========================================
// 3. FINALIZARE REGISTER (TRIMITERE CĂTRE BACKEND)
// ==========================================
document.getElementById('form-register-2').addEventListener('submit', async (e) => {
    e.preventDefault();
    const parola = document.getElementById('reg-password').value;
    const confirm = document.getElementById('reg-password-confirm').value;

    if (parola !== confirm) {
        alert("Parolele nu coincid!");
        return;
    }

    pendingRegistrationData.parola = parola;

    try {
        const response = await fetch('/api/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(pendingRegistrationData)
        });

        const data = await response.json();

        if (data.success) {
            alert("Cont creat! Verifică email-ul pentru codul de activare.");
            switchScreen('screen-verify');
        } else {
            alert("Eroare: " + data.error);
        }
    } catch (err) {
        alert("Eroare de conexiune la server.");
    }
});

// ==========================================
// 4. LOGICA DE LOGIN (VERIFICARE ȘI REDIRECȚIONARE)
// ==========================================
document.getElementById('form-login').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('login-email').value;
    const parola = document.getElementById('login-password').value;
    currentUserEmail = email; // Îl păstrăm în caz că trebuie să mergem la Verify

    try {
        const response = await fetch('/api/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, parola })
        });

        const data = await response.json();

        if (response.ok && data.success) {
            // DACĂ E VERIFICAT: Mergem la Home
            window.location.href = 'home.html';
        } else {
            // DACĂ EXISTĂ DAR NU E VERIFICAT (Eroarea vine din authController)
            if (data.error && data.error.includes("nu este verificat")) {
                alert(data.error);
                switchScreen('screen-verify');
            } else {
                alert("Eroare: " + data.error);
            }
        }
    } catch (err) {
        alert("Eroare de server.");
    }
});

// ==========================================
// 5. LOGICA DE VERIFICARE COD (VERIFY)
// ==========================================
document.getElementById('form-verify').addEventListener('submit', async (e) => {
    e.preventDefault();
    const code = document.getElementById('verify-code').value;

    try {
        const response = await fetch('/api/verify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: currentUserEmail, code: code })
        });

        const data = await response.json();

        if (data.success) {
            alert("Cont activat cu succes!");
            window.location.href = 'home.html';
        } else {
            alert("Cod incorect: " + data.error);
        }
    } catch (err) {
        alert("Eroare la verificarea codului.");
    }
});