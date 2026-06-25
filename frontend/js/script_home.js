let allProjects = [];
let session = null;

window.addEventListener('DOMContentLoaded', () => {
    session = requireAuth();
    if (!session) return;

    // Populăm numele utilizatorului
    const name = getDisplayName();
    document.getElementById('user-name').textContent = name;
    document.getElementById('greeting-name').textContent = name;

    fetchProjects();
    initSearch();
    initModal();
});

// ─── FETCH PROJECTS ────────────────────────────────────────────
async function fetchProjects() {
    const grid = document.getElementById('projects-grid');
    grid.innerHTML = '<div class="loading-projects">Loading projects...</div>';
    try {
        const res = await fetch(`/api/projects/${session.userId}`);
        const data = await res.json();
        if (data.success) {
            allProjects = data.projects || [];
            renderProjects(allProjects);
        } else {
            grid.innerHTML = '<p style="color:var(--text-muted)">Eroare la încărcarea proiectelor.</p>';
        }
    } catch (err) {
        grid.innerHTML = '<p style="color:var(--text-muted)">Nu s-a putut conecta la server.</p>';
    }
}

// ─── RENDER PROJECTS ───────────────────────────────────────────
const langColors = { python: '#3b82f6', cpp: '#6366f1', c: '#10b981' };
const langLabels = { python: 'PY', cpp: 'C++', c: 'C' };

function renderProjects(projects) {
    const grid = document.getElementById('projects-grid');
    const noResults = document.getElementById('no-results');
    grid.innerHTML = '';

    if (!projects || projects.length === 0) {
        const query = document.getElementById('search-input').value.trim();
        if (query) {
            noResults.style.display = 'flex';
        } else {
            noResults.style.display = 'none';
            grid.innerHTML = `<div class="empty-state">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>
                <p>No projects yet. Create your first one!</p>
            </div>`;
        }
        return;
    }

    noResults.style.display = 'none';

    projects.forEach(project => {
        const card = document.createElement('div');
        card.className = 'project-card';

        const dateObj = new Date(project.created_at);
        const formattedDate = dateObj.toLocaleDateString('ro-RO');
        const color = langColors[project.lang] || '#4a4563';

        card.innerHTML = `
            <div class="card-bg" style="background: linear-gradient(135deg, ${color}22 0%, #111827 100%);"></div>
            <div class="card-lang-bar" style="background: ${color};"></div>
            <div class="card-overlay">
                <div class="card-info">
                    <h4>${escapeHtml(project.title)}</h4>
                    <span>${formattedDate}</span>
                </div>
                <div class="lang-badge" style="color:${color}; border-color:${color}40; background:${color}15;">
                    ${langLabels[project.lang] || project.lang.toUpperCase()}
                </div>
            </div>
            <button class="card-delete-btn" data-id="${project.id}" data-name="${escapeHtml(project.title)}" title="Delete project">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
            </button>
        `;

        card.addEventListener('click', (e) => {
            if (e.target.closest('.card-delete-btn')) return;
            window.location.href = `workspace.html?lang=${project.lang}&name=${encodeURIComponent(project.title)}`;
        });

        card.querySelector('.card-delete-btn').addEventListener('click', async (e) => {
            e.stopPropagation();
            if (!confirm(`Delete project "${project.title}"? This cannot be undone.`)) return;
            try {
                const res = await fetch(`/api/projects/${project.id}`, {
                    method: 'DELETE',
                    headers: getAuthHeaders()
                });
                const data = await res.json();
                if (data.success) {
                    allProjects = allProjects.filter(p => p.id !== project.id);
                    filterProjects();
                } else {
                    alert('Eroare la ștergere: ' + data.error);
                }
            } catch { alert('Eroare de server.'); }
        });

        grid.appendChild(card);
    });
}

// ─── SEARCH ────────────────────────────────────────────────────
function initSearch() {
    const input = document.getElementById('search-input');
    input.addEventListener('input', filterProjects);
}

function filterProjects() {
    const query = document.getElementById('search-input').value.trim().toLowerCase();
    if (!query) { renderProjects(allProjects); return; }
    const filtered = allProjects.filter(p => p.title.toLowerCase().includes(query) || p.lang.toLowerCase().includes(query));
    renderProjects(filtered);
}

// ─── MODAL CREATE PROJECT ─────────────────────────────────────
function initModal() {
    const modal = document.getElementById('modal-new-project');
    const btnOpen = document.getElementById('btn-new-project');
    const btnCancel = document.getElementById('btn-cancel-modal');
    const form = document.getElementById('form-new-project');

    btnOpen.addEventListener('click', () => {
        modal.classList.add('active');
        document.getElementById('project-name').focus();
        document.getElementById('modal-error').textContent = '';
    });

    btnCancel.addEventListener('click', closeModal);
    modal.addEventListener('click', e => { if (e.target === modal) closeModal(); });

    function closeModal() {
        modal.classList.remove('active');
        form.reset();
        document.getElementById('modal-error').textContent = '';
    }

    form.addEventListener('submit', async e => {
        e.preventDefault();
        const name = document.getElementById('project-name').value.trim();
        const lang = document.getElementById('project-lang').value;
        const btn = document.getElementById('btn-create-project');
        const errEl = document.getElementById('modal-error');
        errEl.textContent = '';

        if (!/^[a-zA-Z0-9_\-]+$/.test(name)) {
            errEl.textContent = 'Numele poate conține doar litere, cifre, _ sau -.';
            return;
        }
        if (allProjects.some(p => p.title.toLowerCase() === name.toLowerCase())) {
            errEl.textContent = 'Ai deja un proiect cu acest nume.';
            return;
        }

        btn.textContent = 'Creating...';
        btn.disabled = true;

        try {
            const res = await fetch('/api/projects', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, lang, userId: session.userId })
            });
            const data = await res.json();
            if (data.success) {
                window.location.href = `workspace.html?lang=${lang}&name=${encodeURIComponent(name)}`;
            } else {
                errEl.textContent = data.error || 'Eroare la creare.';
                btn.textContent = 'Create Project';
                btn.disabled = false;
            }
        } catch {
            errEl.textContent = 'Eroare de conexiune la server.';
            btn.textContent = 'Create Project';
            btn.disabled = false;
        }
    });
}

// ─── UTILS ────────────────────────────────────────────────────
function escapeHtml(str) {
    return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
