const Docker = require('dockerode');
const docker = new Docker();

// ─── UTILITAR: rulează o comandă rapidă în container ──────────
async function runCmd(container, cmd) {
    try {
        const exec = await container.exec({
            Cmd: ['/bin/bash', '-c', cmd],
            AttachStdout: true,
            AttachStderr: true,
            Tty: false
        });
        const stream = await exec.start({ detach: false });
        return new Promise((resolve) => {
            let out = '';
            container.modem.demuxStream(
                stream,
                { write: (d) => { out += d.toString('utf8'); } },
                { write: (d) => { out += d.toString('utf8'); } }
            );
            stream.on('end', () => resolve(out.trim()));
        });
    } catch (err) {
        console.error('[Docker] runCmd error:', err.message);
        return '';
    }
}

// ─── CREARE / PORNIRE CONTAINER ───────────────────────────────
async function createContainerForUser(userId) {
    const containerName = `eccc-user-${userId}`;

    try {
        const existingContainers = await docker.listContainers({ all: true });
        const isCreated = existingContainers.some(c => c.Names.includes(`/${containerName}`));

        if (isCreated) {
            const container = docker.getContainer(containerName);
            try { await container.start(); } catch (e) { if (e.statusCode !== 304) throw e; }

            // Asigurăm că workspace există chiar și pe containere vechi
            await runCmd(container, 'mkdir -p /home/student/workspace && chown -R student:student /home/student/workspace 2>/dev/null || true');

            const info = await container.inspect();
            return info.Id;
        }

        const container = await docker.createContainer({
            Image: 'eccc-student-env',
            name: containerName,
            Tty: true,
            OpenStdin: true,
            StdinOnce: false,
            Cmd: ['/bin/sh'],
            HostConfig: {
                Memory: 128 * 1024 * 1024,
                CpuQuota: 50000
            }
        });

        await container.start();

        // Inițializăm workspace-ul după pornire (pentru imagini vechi fără director)
        await runCmd(container, 'mkdir -p /home/student/workspace && chown -R student:student /home/student/workspace 2>/dev/null || true');

        const info = await container.inspect();
        return info.Id;

    } catch (err) {
        console.error('[Docker] Eroare la creare container:', err.message);
        throw err;
    }
}

// ─── STREAM TERMINAL (bash interactiv) ───────────────────────
async function getContainerStream(userId, projectName) {
    const containerName = `eccc-user-${userId}`;
    const container = docker.getContainer(containerName);

    // Dacă avem un proiect specific, mergem în folderul lui; altfel în workspace
    const workspacePath = projectName
        ? `/home/student/workspace/${projectName}`
        : `/home/student/workspace`;

    try {
        // PASUL 1: Asigurăm că directorul există (asta era sursa erorii)
        await runCmd(container, `mkdir -p "${workspacePath}"`);

        // PASUL 2: Deschidem sesiunea bash interactivă
        const exec = await container.exec({
            Cmd: ['/bin/bash', '-il'],
            WorkingDir: workspacePath,
            AttachStdin: true,
            AttachStdout: true,
            AttachStderr: true,
            Tty: true
        });

        return await exec.start({ stdin: true, hijack: true, Tty: true });

    } catch (err) {
        console.error(`[Docker] Eroare stream pentru user ${userId}:`, err.message);

        // FALLBACK: dacă WorkingDir eșuează, deschidem bash fără director specific
        try {
            console.log('[Docker] Încercăm fallback fără WorkingDir...');
            const exec = await container.exec({
                Cmd: ['/bin/bash', '-c', `mkdir -p "${workspacePath}" && cd "${workspacePath}" && exec bash -il`],
                AttachStdin: true,
                AttachStdout: true,
                AttachStderr: true,
                Tty: true
            });
            return await exec.start({ stdin: true, hijack: true, Tty: true });
        } catch (fallbackErr) {
            console.error('[Docker] Fallback eșuat:', fallbackErr.message);
            return null;
        }
    }
}

// ─── SETUP PROIECT ────────────────────────────────────────────
async function setupProjectInContainer(userId, projectName, lang) {
    const containerName = `eccc-user-${userId}`;
    const container = docker.getContainer(containerName);

    try {
        const ext = lang === 'python' ? 'py' : (lang === 'cpp' ? 'cpp' : 'c');
        const workspacePath = `/home/student/workspace/${projectName}`;

        const template = lang === 'python'
            ? `def main():\n    print("Hello from EduCode!")\n\nif __name__ == "__main__":\n    main()`
            : lang === 'cpp'
                ? `#include <iostream>\nusing namespace std;\n\nint main() {\n    cout << "Hello from EduCode!" << endl;\n    return 0;\n}`
                : `#include <stdio.h>\n\nint main() {\n    printf("Hello from EduCode!\\n");\n    return 0;\n}`;

        const base64Code = Buffer.from(template).toString('base64');
        const setupCmd = `mkdir -p "${workspacePath}" && echo '${base64Code}' | base64 -d > "${workspacePath}/main.${ext}"`;

        await runCmd(container, setupCmd);

    } catch (err) {
        console.error('[Docker] setupProject error:', err.message);
        throw err;
    }
}

// ─── SALVARE FIȘIER ───────────────────────────────────────────
async function saveFileInContainer(userId, projectName, code, lang) {
    const containerName = `eccc-user-${userId}`;
    const container = docker.getContainer(containerName);
    const ext = lang === 'python' ? 'py' : (lang === 'cpp' ? 'cpp' : 'c');
    const filePath = `/home/student/workspace/${projectName}/main.${ext}`;

    try {
        const base64Code = Buffer.from(code).toString('base64');
        await runCmd(container, `mkdir -p "/home/student/workspace/${projectName}" && echo '${base64Code}' | base64 -d > "${filePath}"`);
    } catch (err) {
        console.error('[Docker] Autosave eșuat:', err.message);
    }
}

// ─── CITIRE FIȘIER ────────────────────────────────────────────
async function readFileFromContainer(userId, projectName, lang) {
    const containerName = `eccc-user-${userId}`;
    const container = docker.getContainer(containerName);
    const ext = lang === 'python' ? 'py' : (lang === 'cpp' ? 'cpp' : 'c');
    const filePath = `/home/student/workspace/${projectName}/main.${ext}`;

    try {
        const exec = await container.exec({
            Cmd: ['cat', filePath],
            AttachStdout: true,
            AttachStderr: true,
            Tty: false
        });
        const stream = await exec.start({ detach: false });

        return new Promise((resolve) => {
            let output = '';
            container.modem.demuxStream(
                stream,
                { write: (d) => { output += d.toString('utf8'); } },
                { write: () => {} }
            );
            stream.on('end', () => resolve(output));
        });
    } catch (err) {
        console.error('[Docker] readFile error:', err.message);
        return '';
    }
}

// ─── RULARE INTERACTIVĂ ───────────────────────────────────────
async function runCodeInteractive(userId, projectName, code, lang, socket) {
    const containerName = `eccc-user-${userId}`;
    const container = docker.getContainer(containerName);

    try {
        const base64Code = Buffer.from(code).toString('base64');
        const workspacePath = `/home/student/workspace/${projectName}`;
        let filename, runCmd;

        if (lang === 'cpp') {
            filename = 'main.cpp';
            runCmd = `mkdir -p "${workspacePath}" && echo '${base64Code}' | base64 -d > "${workspacePath}/${filename}" && cd "${workspacePath}" && g++ "${filename}" -o main_exec 2>&1 && ./main_exec`;
        } else if (lang === 'c') {
            filename = 'main.c';
            runCmd = `mkdir -p "${workspacePath}" && echo '${base64Code}' | base64 -d > "${workspacePath}/${filename}" && cd "${workspacePath}" && gcc "${filename}" -o main_exec 2>&1 && ./main_exec`;
        } else {
            filename = 'main.py';
            runCmd = `mkdir -p "${workspacePath}" && echo '${base64Code}' | base64 -d > "${workspacePath}/${filename}" && cd "${workspacePath}" && python3 -u "${filename}"`;
        }

        const exec = await container.exec({
            Cmd: ['/bin/bash', '-c', runCmd],
            AttachStdin: true,
            AttachStdout: true,
            AttachStderr: true,
            Tty: false
        });
        const stream = await exec.start({ stdin: true, hijack: true, Tty: false });

        container.modem.demuxStream(
            stream,
            { write: (d) => socket.emit('run-output', { type: 'stdout', text: d.toString('utf8') }) },
            { write: (d) => socket.emit('run-output', { type: 'stderr', text: d.toString('utf8') }) }
        );

        stream.on('end', () => socket.emit('run-finished'));
        return stream;

    } catch (err) {
        socket.emit('run-output', { type: 'stderr', text: '[EduCode Error] ' + err.message });
        socket.emit('run-finished');
        return null;
    }
}

// ─── VERIFICARE SINTAXĂ ───────────────────────────────────────
async function checkSyntaxInContainer(userId, projectName, code, lang) {
    const containerName = `eccc-user-${userId}`;
    const container = docker.getContainer(containerName);

    try {
        const base64Code = Buffer.from(code).toString('base64');
        const workspacePath = `/home/student/workspace/${projectName}`;
        let filename, checkCmd;

        if (lang === 'cpp') {
            filename = 'main.cpp';
            checkCmd = `mkdir -p "${workspacePath}" && echo '${base64Code}' | base64 -d > "${workspacePath}/${filename}" && cd "${workspacePath}" && g++ -fsyntax-only "${filename}" 2>&1`;
        } else if (lang === 'c') {
            filename = 'main.c';
            checkCmd = `mkdir -p "${workspacePath}" && echo '${base64Code}' | base64 -d > "${workspacePath}/${filename}" && cd "${workspacePath}" && gcc -fsyntax-only "${filename}" 2>&1`;
        } else {
            filename = 'main.py';
            checkCmd = `mkdir -p "${workspacePath}" && echo '${base64Code}' | base64 -d > "${workspacePath}/${filename}" && cd "${workspacePath}" && python3 -m py_compile "${filename}" 2>&1`;
        }

        const exec = await container.exec({
            Cmd: ['/bin/bash', '-c', checkCmd],
            AttachStdout: true,
            AttachStderr: true,
            Tty: false
        });
        const stream = await exec.start({ detach: false });

        return new Promise((resolve) => {
            let output = '';
            container.modem.demuxStream(
                stream,
                { write: (d) => { output += d.toString('utf8'); } },
                { write: (d) => { output += d.toString('utf8'); } }
            );
            stream.on('end', () => resolve(output));
        });

    } catch (err) {
        return err.message;
    }
}

// ─── FILE SYSTEM ─────────────────────────────────────────────
async function listFilesInContainer(userId, path) {
    const containerName = `eccc-user-${userId}`;
    const container = docker.getContainer(containerName);

    try {
        // Creăm directorul dacă nu există, înainte de ls
        await runCmd(container, `mkdir -p "${path}" 2>/dev/null || true`);

        const exec = await container.exec({
            Cmd: ['/bin/bash', '-c', `ls -1p "${path}" 2>/dev/null || echo ""`],
            AttachStdout: true,
            AttachStderr: true,
            Tty: false
        });
        const stream = await exec.start({ detach: false });

        return new Promise((resolve) => {
            let output = '';
            container.modem.demuxStream(
                stream,
                { write: (d) => { output += d.toString('utf8'); } },
                { write: () => {} }
            );
            stream.on('end', () => {
                const lines = output.split('\n').map(l => l.trim()).filter(l => l !== '');
                const files = lines.map(line => {
                    const isDir = line.endsWith('/');
                    return { name: isDir ? line.slice(0, -1) : line, isDir };
                });
                resolve(files);
            });
        });

    } catch (err) {
        console.error('[Docker] listFiles error:', err.message);
        return [];
    }
}

async function deleteInContainer(userId, path) {
    const containerName = `eccc-user-${userId}`;
    const container = docker.getContainer(containerName);
    try {
        await runCmd(container, `rm -rf "${path}"`);
        return true;
    } catch (err) {
        console.error('[Docker] delete error:', err.message);
        return false;
    }
}

async function renameInContainer(userId, oldPath, newPath) {
    const containerName = `eccc-user-${userId}`;
    const container = docker.getContainer(containerName);
    try {
        await runCmd(container, `mv "${oldPath}" "${newPath}"`);
        return true;
    } catch (err) {
        console.error('[Docker] rename error:', err.message);
        return false;
    }
}

async function mkdirInContainer(userId, path) {
    const containerName = `eccc-user-${userId}`;
    const container = docker.getContainer(containerName);
    try {
        await runCmd(container, `mkdir -p "${path}"`);
        return true;
    } catch (err) {
        console.error('[Docker] mkdir error:', err.message);
        return false;
    }
}

module.exports = {
    createContainerForUser,
    getContainerStream,
    setupProjectInContainer,
    runCodeInteractive,
    checkSyntaxInContainer,
    saveFileInContainer,
    readFileFromContainer,
    listFilesInContainer,
    deleteInContainer,
    renameInContainer,
    mkdirInContainer
};
