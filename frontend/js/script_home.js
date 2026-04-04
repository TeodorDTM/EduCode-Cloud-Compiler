// ==========================================
// 1. INIȚIALIZAREA NUMELUI UTILIZATORULUI
// ==========================================
const mockUserName = "Teodor"; 

window.addEventListener('DOMContentLoaded', () => {
    document.getElementById('user-name').innerText = mockUserName;
    renderProjects();
});

// ==========================================
// 2. GENERAREA CARDURILOR DE PROIECTE
// ==========================================
const myProjects = [
    { id: 1, title: "Data Analysis Tool", date: "12.04.2026", lang: "python", img: "assets/py-icon.png" },
    { id: 2, title: "Game Engine Core", date: "10.04.2026", lang: "cpp", img: "assets/cpp-icon.png" }
];

function renderProjects() {
    const grid = document.getElementById('projects-grid');
    grid.innerHTML = ''; 

    myProjects.forEach(project => {
        const card = document.createElement('div');
        card.className = 'project-card';
        
        // MODIFICAT: Când dai click, trimite limbajul și numele prin URL
        card.onclick = () => {
            window.location.href = `workspace.html?lang=${project.lang}&name=${encodeURIComponent(project.title)}`;
        };

        card.innerHTML = `
            <div class="card-overlay">
                <div class="card-info">
                    <h4>${project.title}</h4>
                    <span>${project.date}</span>
                </div>
                <div class="lang-icon" style="background-color: rgba(255,255,255,0.1); border-radius: 5px; width:28px; height:28px; display:flex; align-items:center; justify-content:center; font-size: 10px;">${project.lang.toUpperCase()}</div>
            </div>
        `;

        grid.appendChild(card);
    });
}

// ==========================================
// 3. LOGICA MODALULUI (POP-UP) NEW PROJECT
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

formNewProject.addEventListener('submit', (e) => {
    e.preventDefault();
    
    const projectName = document.getElementById('project-name').value;
    const projectLang = document.getElementById('project-lang').value;

    // MODIFICAT: Redirecționare reală către workspace cu setările alese
    window.location.href = `workspace.html?lang=${projectLang}&name=${encodeURIComponent(projectName)}`;
});