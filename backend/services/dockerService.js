const Docker = require('dockerode');
const docker = new Docker();

async function createContainerForUser(userId) {
    const containerName = `eccc-user-${userId}`;
    try {
        const existingContainers = await docker.listContainers({ all: true });
        const isCreated = existingContainers.some(c => c.Names.includes(`/${containerName}`));

        if (isCreated) {
            const container = docker.getContainer(containerName);
            try { await container.start(); } catch (startErr) { if (startErr.statusCode !== 304) throw startErr; }
            return container.id;
        }

        const container = await docker.createContainer({
            Image: 'eccc-student-env', 
            name: containerName,
            Tty: true, OpenStdin: true, StdinOnce: false,  
            Cmd: ['/bin/sh'],  
            HostConfig: { Memory: 128 * 1024 * 1024, CpuQuota: 50000 }
        });

        await container.start();
        return container.id;
    } catch (err) {
        console.error("[Docker] Eroare la creare:", err.message);
        throw err;
    }
}

async function getContainerStream(userId, projectName) {
    const containerName = `eccc-user-${userId}`;
    const container = docker.getContainer(containerName);
    const workspacePath = projectName ? `/home/student/workspace/${projectName}` : `/home/student/workspace`;

    try {
        const exec = await container.exec({
            Cmd: ['/bin/bash', '-il'], 
            WorkingDir: workspacePath, 
            AttachStdin: true, AttachStdout: true, AttachStderr: true, Tty: true 
        });
        return await exec.start({ stdin: true, hijack: true, Tty: true });
    } catch (err) {
        console.error(`[Docker] Eroare stream:`, err.message);
        return null;
    }
}

async function setupProjectInContainer(userId, projectName, lang) {
    const containerName = `eccc-user-${userId}`;
    const container = docker.getContainer(containerName);

    try {
        const ext = lang === 'python' ? 'py' : (lang === 'cpp' ? 'cpp' : 'c');
        const workspacePath = `/home/student/workspace/${projectName}`;
        
        const template = lang === 'python' 
            ? 'def main():\n    print("Hello from EduCode!")\n\nif __name__ == "__main__":\n    main()' 
            : '#include <iostream>\nusing namespace std;\n\nint main() {\n    cout << "Hello from EduCode!" << endl;\n    return 0;\n}';
            
        const base64Code = Buffer.from(template).toString('base64');
        const setupCmd = `mkdir -p ${workspacePath} && echo ${base64Code} | base64 -d > ${workspacePath}/main.${ext}`;

        const exec = await container.exec({ Cmd: ['/bin/bash', '-c', setupCmd], AttachStdout: true, AttachStderr: true });
        await exec.start();
    } catch (err) {
        throw err;
    }
}

async function saveFileInContainer(userId, projectName, code, lang) {
    const containerName = `eccc-user-${userId}`;
    const container = docker.getContainer(containerName);
    const ext = lang === 'python' ? 'py' : (lang === 'cpp' ? 'cpp' : 'c');
    const filePath = `/home/student/workspace/${projectName}/main.${ext}`;
    
    try {
        const base64Code = Buffer.from(code).toString('base64');
        const cmd = `echo ${base64Code} | base64 -d > "${filePath}"`;
        const exec = await container.exec({ Cmd: ['/bin/bash', '-c', cmd] });
        await exec.start();
    } catch (err) {
        console.error("[Docker] Autosave eșuat:", err.message);
    }
}

async function readFileFromContainer(userId, projectName, lang) {
    const containerName = `eccc-user-${userId}`;
    const container = docker.getContainer(containerName);
    const ext = lang === 'python' ? 'py' : (lang === 'cpp' ? 'cpp' : 'c');
    const filePath = `/home/student/workspace/${projectName}/main.${ext}`;
    
    try {
        const exec = await container.exec({ Cmd: ['cat', filePath], AttachStdout: true, AttachStderr: true, Tty: false });
        const stream = await exec.start({ detach: false });
        
        return new Promise((resolve) => {
            let output = '';
            container.modem.demuxStream(stream, 
                { write: (data) => { output += data.toString('utf8'); } }, 
                { write: (data) => { } }
            );
            stream.on('end', () => resolve(output));
        });
    } catch (err) { return null; }
}

async function runCodeInteractive(userId, projectName, code, lang, socket) {
    const containerName = `eccc-user-${userId}`;
    const container = docker.getContainer(containerName);

    try {
        const base64Code = Buffer.from(code).toString('base64');
        const workspacePath = `/home/student/workspace/${projectName}`;
        let filename, runCmd;

        if (lang === 'cpp') {
            filename = 'main.cpp';
            runCmd = `mkdir -p ${workspacePath} && echo ${base64Code} | base64 -d > ${workspacePath}/${filename} && cd ${workspacePath} && g++ ${filename} -o main && ./main`;
        } else if (lang === 'c') {
            filename = 'main.c';
            runCmd = `mkdir -p ${workspacePath} && echo ${base64Code} | base64 -d > ${workspacePath}/${filename} && cd ${workspacePath} && gcc ${filename} -o main && ./main`;
        } else {
            filename = 'main.py';
            runCmd = `mkdir -p ${workspacePath} && echo ${base64Code} | base64 -d > ${workspacePath}/${filename} && cd ${workspacePath} && python3 -u ${filename}`;
        }

        const exec = await container.exec({ Cmd: ['/bin/bash', '-c', runCmd], AttachStdin: true, AttachStdout: true, AttachStderr: true, Tty: false });
        const stream = await exec.start({ stdin: true, hijack: true, Tty: false });
        
        container.modem.demuxStream(stream, 
            { write: (data) => socket.emit('run-output', { type: 'stdout', text: data.toString('utf8') }) }, 
            { write: (data) => socket.emit('run-output', { type: 'stderr', text: data.toString('utf8') }) }
        );

        stream.on('end', () => socket.emit('run-finished'));
        return stream;
    } catch (err) {
        socket.emit('run-output', { type: 'stderr', text: err.message });
        socket.emit('run-finished');
    }
}

async function checkSyntaxInContainer(userId, projectName, code, lang) {
    const containerName = `eccc-user-${userId}`;
    const container = docker.getContainer(containerName);

    try {
        const base64Code = Buffer.from(code).toString('base64');
        const workspacePath = `/home/student/workspace/${projectName}`;
        let filename, checkCmd;

        if (lang === 'cpp') {
            filename = 'main.cpp';
            checkCmd = `mkdir -p ${workspacePath} && echo ${base64Code} | base64 -d > ${workspacePath}/${filename} && cd ${workspacePath} && g++ -fsyntax-only ${filename} 2>&1`;
        } else if (lang === 'c') {
            filename = 'main.c';
            checkCmd = `mkdir -p ${workspacePath} && echo ${base64Code} | base64 -d > ${workspacePath}/${filename} && cd ${workspacePath} && gcc -fsyntax-only ${filename} 2>&1`;
        } else {
            filename = 'main.py';
            checkCmd = `mkdir -p ${workspacePath} && echo ${base64Code} | base64 -d > ${workspacePath}/${filename} && cd ${workspacePath} && python3 -m py_compile ${filename} 2>&1`;
        }

        const exec = await container.exec({ Cmd: ['/bin/bash', '-c', checkCmd], AttachStdout: true, AttachStderr: true, Tty: false });
        const stream = await exec.start({ detach: false });
        
        return new Promise((resolve) => {
            let output = '';
            container.modem.demuxStream(stream, 
                { write: (data) => { output += data.toString('utf8'); } },
                { write: (data) => { output += data.toString('utf8'); } }
            );
            stream.on('end', () => resolve(output)); 
        });
    } catch (err) { return err.message; }
}

// =========================================================
// FUNCȚII NOI: VIRTUAL FILE SYSTEM (EXPLORER)
// =========================================================

// Listează fișierele cu ls -1p (fișierele pe rând, folderele se termină cu "/")
async function listFilesInContainer(userId, path) {
    const containerName = `eccc-user-${userId}`;
    const container = docker.getContainer(containerName);
    try {
        const exec = await container.exec({ Cmd: ['/bin/bash', '-c', `ls -1p "${path}"`], AttachStdout: true, AttachStderr: true, Tty: false });
        const stream = await exec.start({ detach: false });
        
        return new Promise((resolve) => {
            let output = '';
            container.modem.demuxStream(stream, 
                { write: (data) => { output += data.toString('utf8'); } }, 
                { write: (data) => { } }
            );
            stream.on('end', () => {
                const lines = output.split('\n').map(l => l.trim()).filter(l => l !== '');
                const files = lines.map(line => {
                    const isDir = line.endsWith('/');
                    const name = isDir ? line.slice(0, -1) : line;
                    return { name, isDir };
                });
                resolve(files);
            });
        });
    } catch (err) { throw err; }
}

async function deleteInContainer(userId, path) {
    const containerName = `eccc-user-${userId}`;
    const container = docker.getContainer(containerName);
    try {
        const exec = await container.exec({ Cmd: ['/bin/bash', '-c', `rm -rf "${path}"`] });
        await exec.start();
        return true;
    } catch (err) { return false; }
}

async function renameInContainer(userId, oldPath, newPath) {
    const containerName = `eccc-user-${userId}`;
    const container = docker.getContainer(containerName);
    try {
        const exec = await container.exec({ Cmd: ['/bin/bash', '-c', `mv "${oldPath}" "${newPath}"`] });
        await exec.start();
        return true;
    } catch (err) { return false; }
}

async function mkdirInContainer(userId, path) {
    const containerName = `eccc-user-${userId}`;
    const container = docker.getContainer(containerName);
    try {
        const exec = await container.exec({ Cmd: ['/bin/bash', '-c', `mkdir -p "${path}"`] });
        await exec.start();
        return true;
    } catch (err) { return false; }
}

module.exports = { 
    createContainerForUser, getContainerStream, setupProjectInContainer, runCodeInteractive, 
    checkSyntaxInContainer, saveFileInContainer, readFileFromContainer,
    listFilesInContainer, deleteInContainer, renameInContainer, mkdirInContainer
};