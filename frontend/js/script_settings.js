let session = null;

const DEFAULTS = {
    editor_font_size: 15,
    editor_theme: 'vs-dark',
    tab_size: 4,
    word_wrap: 'on',
    autosave_interval: 5000
};

let currentSettings = { ...DEFAULTS };

window.addEventListener('DOMContentLoaded', async () => {
    session = requireAuth();
    if (!session) return;

    await loadSettings();
    initControls();
});

// ─── LOAD SETTINGS ────────────────────────────────────────────
async function loadSettings() {
    // Citim mai întâi din localStorage (instant)
    const local = localStorage.getItem('educode_editor_settings');
    if (local) {
        try { currentSettings = { ...DEFAULTS, ...JSON.parse(local) }; } catch {}
    }

    // Sincronizăm cu backend-ul (adevărul de referință)
    try {
        const res = await fetch(`/api/settings/${session.userId}`, { headers: getAuthHeaders() });
        const data = await res.json();
        if (data.success && data.settings) {
            currentSettings = { ...DEFAULTS, ...data.settings };
            localStorage.setItem('educode_editor_settings', JSON.stringify(currentSettings));
        }
    } catch (err) {
        console.warn('[Settings] Could not sync from server, using local values:', err.message);
    }

    applyToUI(currentSettings);
}

// ─── APPLY VALUES TO UI ───────────────────────────────────────
function applyToUI(s) {
    // Font size slider
    const slider = document.getElementById('font-size');
    slider.value = s.editor_font_size;
    document.getElementById('font-size-display').textContent = `${s.editor_font_size}px`;

    // Button groups
    setActive('theme-group', String(s.editor_theme));
    setActive('tab-group', String(s.tab_size));
    setActive('wrap-group', String(s.word_wrap));
    setActive('autosave-group', String(s.autosave_interval));
}

function setActive(groupId, value) {
    const group = document.getElementById(groupId);
    if (!group) return;
    group.querySelectorAll('.btn-option').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.value === value);
    });
}

// ─── INIT CONTROLS ────────────────────────────────────────────
function initControls() {
    // Font size range input
    const slider = document.getElementById('font-size');
    slider.addEventListener('input', () => {
        document.getElementById('font-size-display').textContent = `${slider.value}px`;
        currentSettings.editor_font_size = parseInt(slider.value);
    });

    // Button groups - single-select toggle
    ['theme-group', 'tab-group', 'wrap-group', 'autosave-group'].forEach(groupId => {
        const group = document.getElementById(groupId);
        const key = {
            'theme-group': 'editor_theme',
            'tab-group': 'tab_size',
            'wrap-group': 'word_wrap',
            'autosave-group': 'autosave_interval'
        }[groupId];

        group.querySelectorAll('.btn-option').forEach(btn => {
            btn.addEventListener('click', () => {
                group.querySelectorAll('.btn-option').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                let val = btn.dataset.value;
                // Converim la număr unde e cazul
                if (key === 'tab_size' || key === 'autosave_interval' || key === 'editor_font_size') {
                    val = parseInt(val);
                }
                currentSettings[key] = val;
            });
        });
    });

    // Save button
    document.getElementById('btn-save-settings').addEventListener('click', saveSettings);
}

// ─── SAVE SETTINGS ────────────────────────────────────────────
async function saveSettings() {
    const btn = document.getElementById('btn-save-settings');
    const statusEl = document.getElementById('save-status');

    btn.textContent = 'Saving...';
    btn.disabled = true;
    statusEl.textContent = '';
    statusEl.className = 'save-status';

    // Salvăm în localStorage imediat (instant feedback)
    localStorage.setItem('educode_editor_settings', JSON.stringify(currentSettings));

    try {
        const res = await fetch(`/api/settings/${session.userId}`, {
            method: 'PUT',
            headers: getAuthHeaders(),
            body: JSON.stringify(currentSettings)
        });
        const data = await res.json();

        if (data.success) {
            statusEl.textContent = '✓ Settings saved successfully!';
            statusEl.className = 'save-status success';
        } else {
            // Local save succeeded, warn about server
            statusEl.textContent = '⚠ Saved locally. Server sync failed: ' + (data.error || '');
            statusEl.className = 'save-status warning';
        }
    } catch {
        statusEl.textContent = '⚠ Saved locally. No server connection.';
        statusEl.className = 'save-status warning';
    } finally {
        btn.textContent = 'Save Settings';
        btn.disabled = false;
        setTimeout(() => { statusEl.textContent = ''; statusEl.className = 'save-status'; }, 4000);
    }
}
