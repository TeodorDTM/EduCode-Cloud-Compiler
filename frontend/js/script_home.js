// ==========================================
// 1. INIȚIALIZARE
// ==========================================
const mockUserId = 1; 
const mockUserName = "Teodor"; 

window.addEventListener('DOMContentLoaded', () => {
    document.getElementById('user-name').innerText = mockUserName;
    fetchProjects();
});

// ==========================================
// 2. GENERAREA CARDURILOR DE PROIECTE (DIN DB)
// ==========================================
async function fetchProjects() {
    try {
        const res = await fetch(`/api/projects/${mockUserId}`);
        const data = await res.json();

        if (data.success) {
            renderProjects(data.projects);
        }
    } catch (err) {
        console.error("Nu s-au putut încărca proiectele", err);
    }
}

function renderProjects(projects) {
    const grid = document.getElementById('projects-grid');
    grid.innerHTML = ''; 

    if (!projects || projects.length === 0) {
        grid.innerHTML = '<p style="color: var(--text-muted);">Nu ai niciun proiect. Creează unul nou!</p>';
        return;
    }

    projects.forEach(project => {
        const card = document.createElement('div');
        card.className = 'project-card';
        
        const dateObj = new Date(project.created_at);
        const formattedDate = `${dateObj.getDate()}.${dateObj.getMonth() + 1}.${dateObj.getFullYear()}`;

        card.onclick = () => {
            window.location.href = `workspace.html?lang=${project.lang}&name=${encodeURIComponent(project.title)}`;
        };

        card.innerHTML = `
            <div class="card-overlay">
                <div class="card-info">
                    <h4>${project.title}</h4>
                    <span>${formattedDate}</span>
                </div>
                <div class="lang-icon" style="background-color: rgba(255,255,255,0.1); border-radius: 5px; width:28px; height:28px; display:flex; align-items:center; justify-content:center; font-size: 10px; font-weight: bold;">
                    ${project.lang.toUpperCase()}
                </div>
            </div>
        `;
        grid.appendChild(card);
    });
}

// ==========================================
// 3. LOGICA MODALULUI (CREARE PROIECT REAL)
// ==========================================
const btnNewProject = document.getElementById('btn-new-project');
const modalNewProject = document.getElementById('modal-new-project');
const btnCancelModal = document.getElementById('btn-cancel-modal');
const formNewProject = document.getElementById('form-new-project');

btnNewProject.addEventListener('click', () => {
    modalNewProject.classList.add('active');
    document.getElementById('project-name').focus();
});

btnCancelModal.addEventListener('click', () => {
    modalNewProject.classList.remove('active');
    formNewProject.reset();
});

modalNewProject.addEventListener('click', (e) => {
    if (e.target === modalNewProject) {
        modalNewProject.classList.remove('active');
        formNewProject.reset();
    }
});

formNewProject.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const projectName = document.getElementById('project-name').value;
    const projectLang = document.getElementById('project-lang').value;
    
    const submitBtn = formNewProject.querySelector('button[type="submit"]');
    submitBtn.innerText = "Se creează...";
    submitBtn.disabled = true;

    try {
        const response = await fetch('/api/projects', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                name: projectName,
                lang: projectLang,
                userId: mockUserId
            })
        });

        const data = await response.json();

        if (data.success) {
            // Aruncăm utilizatorul direct în IDE
            window.location.href = `workspace.html?lang=${projectLang}&name=${encodeURIComponent(projectName)}`;
        } else {
            alert("Eroare la crearea proiectului: " + data.error);
            submitBtn.innerText = "Create Project";
            submitBtn.disabled = false;
        }
    } catch (err) {
        alert("Eroare de conexiune la server.");
        submitBtn.innerText = "Create Project";
        submitBtn.disabled = false;
    }
});