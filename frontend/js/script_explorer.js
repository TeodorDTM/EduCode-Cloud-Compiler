const mockUserId = 1;
const basePath = '/home/student/workspace';
let currentPath = basePath;
let selectedFile = null; // Stochează fișierul pe care s-a dat click dreapta

const fileGrid = document.getElementById('file-grid');
const breadcrumbsDiv = document.getElementById('breadcrumbs');
const contextMenu = document.getElementById('context-menu');

// SVG-uri pentru tipuri de fișiere
const iconFolder = `<svg class="file-icon folder" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>`;
const iconFile = `<svg class="file-icon file" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5"><path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"></path><polyline points="13 2 13 9 20 9"></polyline></svg>`;
const iconCode = `<svg class="file-icon cpp" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><polyline points="16 18 22 12 16 6"></polyline><polyline points="8 6 2 12 8 18"></polyline></svg>`;

window.addEventListener('DOMContentLoaded', () => {
    loadDirectory(currentPath);
});

async function loadDirectory(path) {
    fileGrid.innerHTML = '<div class="loading-text">Loading...</div>';
    
    try {
        const res = await fetch(`/api/fs/list?userId=${mockUserId}&path=${encodeURIComponent(path)}`);
        const data = await res.json();
        
        if (data.success) {
            currentPath = path;
            renderBreadcrumbs();
            renderFiles(data.files);
        } else {
            fileGrid.innerHTML = `<div class="loading-text" style="color:#ef4444;">Eroare: ${data.error}</div>`;
        }
    } catch (err) {
        fileGrid.innerHTML = '<div class="loading-text" style="color:#ef4444;">Eroare de conexiune.</div>';
    }
}

function renderBreadcrumbs() {
    breadcrumbsDiv.innerHTML = '';
    const parts = currentPath.replace(basePath, 'workspace').split('/').filter(p => p !== '');
    
    let buildPath = basePath;
    
    parts.forEach((part, index) => {
        if (index > 0) buildPath += `/${part}`;
        
        const isLast = index === parts.length - 1;
        const span = document.createElement('span');
        span.className = `crumb ${isLast ? 'active' : ''}`;
        span.innerText = part;
        
        if (!isLast) {
            const currentBuildPath = buildPath; // Salvăm calea curentă pentru onclick
            span.onclick = () => loadDirectory(currentBuildPath);
        }
        
        breadcrumbsDiv.appendChild(span);
        
        if (!isLast) {
            const sep = document.createElement('span');
            sep.className = 'crumb-separator';
            sep.innerText = '>';
            breadcrumbsDiv.appendChild(sep);
        }
    });
}

function renderFiles(files) {
    fileGrid.innerHTML = '';
    
    if (files.length === 0) {
        fileGrid.innerHTML = '<div class="loading-text">This folder is empty.</div>';
        return;
    }

    // Sortăm folderele primele
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
        else if (file.name.endsWith('.cpp') || file.name.endsWith('.c') || file.name.endsWith('.py')) icon = iconCode;

        item.innerHTML = `
            ${icon}
            <span class="file-name">${file.name}</span>
        `;

        // Dublu click pentru a intra în folder
        item.addEventListener('dblclick', () => {
            if (file.isDir) {
                loadDirectory(`${currentPath}/${file.name}`);
            } else {
                // Dacă e fișier sursă, putem să-l trimitem la workspace opțional
                alert("Poți edita codul intrând în proiect din pagina Home.");
            }
        });

        // Click dreapta pentru meniu
        item.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            selectedFile = file.name;
            
            contextMenu.style.top = `${e.clientY}px`;
            contextMenu.style.left = `${e.clientX}px`;
            contextMenu.classList.add('active');
        });

        fileGrid.appendChild(item);
    });
}

// Ascunde meniul contextual când dai click în altă parte
document.addEventListener('click', () => contextMenu.classList.remove('active'));

// Acțiunea de Delete
document.getElementById('ctx-delete').addEventListener('click', async () => {
    if (!selectedFile) return;
    const confirmDelete = confirm(`Ești sigur că vrei să ștergi "${selectedFile}"? Această acțiune este ireversibilă.`);
    
    if (confirmDelete) {
        const targetPath = `${currentPath}/${selectedFile}`;
        try {
            const res = await fetch('/api/fs/delete', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId: mockUserId, path: targetPath })
            });
            const data = await res.json();
            if (data.success) loadDirectory(currentPath);
            else alert("Eroare la ștergere: " + data.error);
        } catch (err) { alert("Eroare server."); }
    }
});

// Acțiunea de Rename
document.getElementById('ctx-rename').addEventListener('click', async () => {
    if (!selectedFile) return;
    const newName = prompt(`Introdu un nume nou pentru "${selectedFile}":`, selectedFile);
    
    if (newName && newName !== selectedFile) {
        const oldPath = `${currentPath}/${selectedFile}`;
        const newPath = `${currentPath}/${newName}`;
        
        try {
            const res = await fetch('/api/fs/rename', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId: mockUserId, oldPath, newPath })
            });
            const data = await res.json();
            if (data.success) loadDirectory(currentPath);
            else alert("Eroare la redenumire: " + data.error);
        } catch (err) { alert("Eroare server."); }
    }
});

document.getElementById('btn-refresh').addEventListener('click', () => loadDirectory(currentPath));

document.getElementById('btn-new-folder').addEventListener('click', async () => {
    const folderName = prompt("Numele folderului:");
    if (folderName) {
        const targetPath = `${currentPath}/${folderName}`;
        try {
            const res = await fetch('/api/fs/mkdir', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId: mockUserId, path: targetPath })
            });
            const data = await res.json();
            if (data.success) loadDirectory(currentPath);
            else alert("Eroare la creare: " + data.error);
        } catch (err) { alert("Eroare server."); }
    }
});