let session = null;
let profileData = null;

window.addEventListener('DOMContentLoaded', async () => {
    session = requireAuth();
    if (!session) return;

    await loadProfile();
});

// ─── LOAD PROFILE ─────────────────────────────────────────────
async function loadProfile() {
    try {
        const res = await fetch(`/api/profile/${session.userId}`, { headers: getAuthHeaders() });
        const data = await res.json();
        if (data.success) {
            profileData = data.user;
            renderProfile(profileData);
        } else {
            console.error('Could not load profile:', data.error);
        }
    } catch (err) { console.error('Network error:', err); }
}

function renderProfile(u) {
    const initials = (u.nume.charAt(0) + u.prenume.charAt(0)).toUpperCase();
    const fullName = `${u.nume} ${u.prenume}`;

    // Hero
    document.getElementById('profile-avatar-large').textContent = initials;
    document.getElementById('profile-full-name').textContent = fullName;
    document.getElementById('profile-email-display').textContent = u.email;
    document.getElementById('profile-school-display').textContent = u.scoala || '—';
    const joined = new Date(u.created_at);
    document.getElementById('profile-joined').textContent =
        `Member since ${joined.toLocaleDateString('en-US', { year: 'numeric', month: 'long' })}`;

    // View mode
    document.getElementById('view-fname').textContent = u.nume;
    document.getElementById('view-lname').textContent = u.prenume;
    document.getElementById('view-email').textContent = u.email;
    document.getElementById('view-phone').textContent = u.telefon || '—';
    document.getElementById('view-school').textContent = u.scoala || '—';
    document.getElementById('view-userid').textContent = `#${u.id}`;

    // Edit inputs prefill
    document.getElementById('edit-fname').value = u.nume;
    document.getElementById('edit-lname').value = u.prenume;
    document.getElementById('edit-phone').value = u.telefon || '';
    document.getElementById('edit-school').value = u.scoala || '';

    // Update nav avatars
    document.querySelectorAll('.nav-avatar-text').forEach(el => el.textContent = initials);
}

// ─── EDIT INFO ─────────────────────────────────────────────────
document.getElementById('btn-edit-info').addEventListener('click', () => {
    document.getElementById('info-view').style.display = 'none';
    document.getElementById('info-edit').style.display = 'block';
    document.getElementById('btn-edit-info').style.display = 'none';
    document.getElementById('info-error').textContent = '';
});

document.getElementById('btn-cancel-info').addEventListener('click', () => {
    document.getElementById('info-view').style.display = 'block';
    document.getElementById('info-edit').style.display = 'none';
    document.getElementById('btn-edit-info').style.display = 'flex';
});

document.getElementById('btn-save-info').addEventListener('click', async () => {
    const btn = document.getElementById('btn-save-info');
    const errEl = document.getElementById('info-error');
    const fname = document.getElementById('edit-fname').value.trim();
    const lname = document.getElementById('edit-lname').value.trim();
    const phone = document.getElementById('edit-phone').value.trim();
    const school = document.getElementById('edit-school').value.trim();

    if (!fname || !lname) { errEl.textContent = 'First and last name are required.'; return; }

    btn.textContent = 'Saving...';
    btn.disabled = true;
    errEl.textContent = '';

    try {
        const res = await fetch(`/api/profile/${session.userId}`, {
            method: 'PUT',
            headers: getAuthHeaders(),
            body: JSON.stringify({ nume: fname, prenume: lname, telefon: phone, scoala: school })
        });
        const data = await res.json();

        if (data.success) {
            // Update session in localStorage
            const s = getSession();
            s.name = fname;
            s.prenume = lname;
            s.telefon = phone;
            s.scoala = school;
            saveSession(s);

            profileData = { ...profileData, nume: fname, prenume: lname, telefon: phone, scoala: school };
            renderProfile(profileData);
            document.getElementById('info-view').style.display = 'block';
            document.getElementById('info-edit').style.display = 'none';
            document.getElementById('btn-edit-info').style.display = 'flex';
            showToast('Profile updated successfully!', 'success');
        } else {
            errEl.textContent = data.error || 'Update failed.';
        }
    } catch { errEl.textContent = 'Network error.'; }
    finally { btn.textContent = 'Save Changes'; btn.disabled = false; }
});

// ─── CHANGE PASSWORD ─────────────────────────────────────────
document.getElementById('btn-change-pass').addEventListener('click', async () => {
    const btn = document.getElementById('btn-change-pass');
    const errEl = document.getElementById('pass-error');
    const sucEl = document.getElementById('pass-success');
    const oldPass = document.getElementById('old-password').value;
    const newPass = document.getElementById('new-password').value;
    const confirmPass = document.getElementById('confirm-password').value;

    errEl.textContent = '';
    sucEl.textContent = '';

    if (!oldPass) { errEl.textContent = 'Enter your current password.'; return; }
    if (newPass.length < 6) { errEl.textContent = 'New password must be at least 6 characters.'; return; }
    if (newPass !== confirmPass) { errEl.textContent = 'Passwords do not match.'; return; }

    btn.textContent = 'Updating...';
    btn.disabled = true;

    try {
        const res = await fetch('/api/change-password', {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify({ userId: session.userId, oldPassword: oldPass, newPassword: newPass })
        });
        const data = await res.json();

        if (data.success) {
            sucEl.textContent = '✓ Password changed successfully!';
            document.getElementById('old-password').value = '';
            document.getElementById('new-password').value = '';
            document.getElementById('confirm-password').value = '';
        } else {
            errEl.textContent = data.error || 'Failed to change password.';
        }
    } catch { errEl.textContent = 'Network error.'; }
    finally { btn.textContent = 'Update Password'; btn.disabled = false; }
});

// ─── DELETE ACCOUNT ────────────────────────────────────────────
document.getElementById('btn-delete-account').addEventListener('click', async () => {
    const confirmed = confirm(
        'Are you sure you want to permanently delete your account?\n\nAll your projects and data will be lost. This cannot be undone.'
    );
    if (!confirmed) return;

    const doubleConfirm = confirm('Last warning: this will DELETE everything. Continue?');
    if (!doubleConfirm) return;

    try {
        const res = await fetch(`/api/account/${session.userId}`, {
            method: 'DELETE',
            headers: getAuthHeaders()
        });
        const data = await res.json();
        if (data.success) {
            logout(); // clears session and redirects to login
        } else {
            alert('Error: ' + (data.error || 'Could not delete account.'));
        }
    } catch { alert('Network error. Try again.'); }
});

// ─── TOAST ────────────────────────────────────────────────────
function showToast(msg, type = 'info') {
    let t = document.getElementById('toast');
    if (!t) {
        t = document.createElement('div');
        t.id = 'toast';
        t.style.cssText = `position:fixed;bottom:28px;right:28px;padding:12px 22px;border-radius:10px;
            font-size:13px;font-weight:500;z-index:9999;transition:opacity 0.3s;`;
        document.body.appendChild(t);
    }
    t.style.background = type === 'success' ? 'rgba(16,185,129,0.2)' : '#1e293b';
    t.style.border = type === 'success' ? '1px solid rgba(16,185,129,0.5)' : '1px solid #ffffff26';
    t.style.color = type === 'success' ? '#10b981' : '#fff';
    t.textContent = msg;
    t.style.opacity = '1';
    clearTimeout(t._timer);
    t._timer = setTimeout(() => { t.style.opacity = '0'; }, 3000);
}
