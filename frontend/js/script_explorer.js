let session = null;
const basePath = '/home/student/workspace';
let currentPath = basePath;
let selectedFile = null;

const fileGrid = document.getElementById('file-grid');
const breadcrumbsDiv = document.getElementById('breadcrumbs');
const contextMenu = document.getElementById('context-menu');

const iconFolder = `<svg class="file-icon folder" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5" fill="none"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>`;
const iconFile = `<svg class="file-icon file" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5" fill="none"><path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"></path><polyline points="13 2 13 9 20 9"></polyline></svg>`;
const iconCode = `<svg class="file-icon cpp" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><polyline points="16 18 22 12 16 6"></polyline><polyline points="8 6 2 12 8 18"></polyline></svg>`;
const iconPython = `<svg class="file-icon python" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M12 2C8 2 6 4 6 7v2h6v1H5C3 10 2 11.5 2 14s1 4 3 4h2v-2.5C7 13 9 12 12 12s5 1 5 3.5V18h2c2 0 3-1.5 3-4s-1-4-3-4h-6V9h6V7c0-3-2-5-7-5z"/></svg>`;

window.addEventListener('DOMContentLoaded', () => {
    session = requireAuth();
    if (!session) return;
    loadDirectory(currentPath);
});

async function loadDirectory(path) {
    fileGrid.innerHTML = '<div class="loading-text">Loading...</div>';
    try {
        const res = await fetch(`/api/fs/list?userId=${session.userId}&path=${encodeURIComponent(path)}`);
        const data = await res.json();
        if (data.success) {
            currentPath = path;
            renderBreadcrumbs();
            renderFiles(data.files);
        } else {
            fileGrid.innerHTML = `<div class="loading-text" style="color:#ef4444;">Error: ${data.error}</div>`;
        }
    } catch {
        fileGrid.innerHTML = '<div class="loading-text" style="color:#ef4444;">Connection error.</div>';
    }
}

function renderBreadcrumbs() {
    breadcrumbsDiv.innerHTML = '';
    const relative = currentPath.replace(basePath, '');
    const parts = ['workspace', ...relative.split('/').filter(p => p)];
    let buildPath = basePath;

    parts.forEach((part, index) => {
        if (index > 0) buildPath += '/' + part;
        const isLast = index === parts.length - 1;
        const span = document.createElement('span');
        span.className = 'crumb' + (isLast ? ' active' : '');
        span.textContent = part;
        if (!isLast) {
            const p = buildPath;
            span.onclick = () => loadDirectory(p);
        }
        breadcrumbsDiv.appendChild(span);
        if (!isLast) {
            const sep = document.createElement('span');
            sep.className = 'crumb-separator';
            sep.textContent = '>';
            breadcrumbsDiv.appendChild(sep);
        }
    });
}

function renderFiles(files) {
    fileGrid.innerHTML = '';
    if (!files || files.length === 0) {
        fileGrid.innerHTML = '<div class="loading-text">This folder is empty.</div>';
        return;
    }

    files.sort((a, b) => {
        if (a.isDir && !b.isDir) return -1;
        if (!a.isDir && b.isDir) return 1;
        return a.name.localeCompare(b.name);
    });

    files.forEach(file => {
        const item = document.createElement('div');
        item.className = 'file-item';

        let icon = iconFile;
        if (file.isDir) icon = iconFolder;
        else if (file.name.endsWith('.py')) icon = iconPython;
        else if (file.name.endsWith('.cpp') || file.name.endsWith('.c') || file.name.endsWith('.h')) icon = iconCode;

        item.innerHTML = `${icon}<span class="file-name">${file.name}</span>`;

        item.addEventListener('dblclick', () => {
            if (file.isDir) {
                loadDirectory(`${currentPath}/${file.name}`);
            } else {
                showToast('Open the project from the Home page to edit files.');
            }
        });

        item.addEventListener('contextmenu', e => {
            e.preventDefault();
            selectedFile = file.name;
            contextMenu.style.top = `${e.clientY}px`;
            contextMenu.style.left = `${e.clientX}px`;
            contextMenu.classList.add('active');
        });

        fileGrid.appendChild(item);
    });
}

document.addEventListener('click', () => contextMenu.classList.remove('active'));

document.getElementById('ctx-delete').addEventListener('click', async () => {
    if (!selectedFile) return;
    if (!confirm(`Delete "${selectedFile}"? This cannot be undone.`)) return;
    try {
        const res = await fetch('/api/fs/delete', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: session.userId, path: `${currentPath}/${selectedFile}` })
        });
        const data = await res.json();
        if (data.success) { loadDirectory(currentPath); showToast('Deleted successfully.'); }
        else alert('Error: ' + data.error);
    } catch { alert('Server error.'); }
});

document.getElementById('ctx-rename').addEventListener('click', async () => {
    if (!selectedFile) return;
    const newName = prompt(`New name for "${selectedFile}":`, selectedFile);
    if (!newName || newName === selectedFile) return;
    try {
        const res = await fetch('/api/fs/rename', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                userId: session.userId,
                oldPath: `${currentPath}/${selectedFile}`,
                newPath: `${currentPath}/${newName}`
            })
        });
        const data = await res.json();
        if (data.success) { loadDirectory(currentPath); showToast('Renamed successfully.'); }
        else alert('Error: ' + data.error);
    } catch { alert('Server error.'); }
});

document.getElementById('btn-refresh').addEventListener('click', () => loadDirectory(currentPath));

document.getElementById('btn-new-folder').addEventListener('click', async () => {
    const name = prompt('Folder name:');
    if (!name) return;
    try {
        const res = await fetch('/api/fs/mkdir', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: session.userId, path: `${currentPath}/${name}` })
        });
        const data = await res.json();
        if (data.success) { loadDirectory(currentPath); showToast('Folder created.'); }
        else alert('Error: ' + data.error);
    } catch { alert('Server error.'); }
});

// ─── TOAST ────────────────────────────────────────────────────
function showToast(msg) {
    let t = document.getElementById('toast');
    if (!t) {
        t = document.createElement('div');
        t.id = 'toast';
        t.style.cssText = `position:fixed;bottom:28px;right:28px;background:#1e293b;color:#fff;
            border:1px solid #ffffff42;padding:10px 20px;border-radius:10px;font-size:13px;
            z-index:9999;transition:opacity 0.3s;`;
        document.body.appendChild(t);
    }
    t.textContent = msg;
    t.style.opacity = '1';
    clearTimeout(t._timer);
    t._timer = setTimeout(() => { t.style.opacity = '0'; }, 2500);
}
