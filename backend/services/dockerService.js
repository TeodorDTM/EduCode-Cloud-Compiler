const Docker = require('dockerode');
const docker = new Docker();

// ═══════════════════════════════════════════════════════════════
//  HELPERS
// ═══════════════════════════════════════════════════════════════

/**
 * Asteapta pana cand containerul e in starea "running".
 * Polling la fiecare 300ms, timeout implicit 10s.
 */
async function waitUntilRunning(container, maxMs = 10000) {
    const deadline = Date.now() + maxMs;
    while (Date.now() < deadline) {
        try {
            const info = await container.inspect();
            if (info.State.Running) return true;
            if (info.State.Status === 'exited' || info.State.Status === 'dead') {
                console.warn('[Docker] Container a iesit/mort, incerc restart...');
                await container.start();
            }
        } catch (e) { /* ignoram erorile de inspect in timpul pornirii */ }
        await new Promise(r => setTimeout(r, 300));
    }
    console.warn('[Docker] waitUntilRunning: timeout dupa', maxMs, 'ms');
    return false;
}

/**
 * Creaza directorul in container (fire-and-forget).
 * Reincerca de 3 ori daca containerul nu e gata inca (409).
 */
async function ensureDir(container, dirPath) {
    for (let attempt = 1; attempt <= 4; attempt++) {
        try {
            const exec = await container.exec({
                Cmd: ['mkdir', '-p', dirPath],
                AttachStdout: false,
                AttachStderr: false
            });
            await exec.start({ detach: true });
            // Mic delay ca mkdir sa fie finalizat
            await new Promise(r => setTimeout(r, 200));
            return; // succes
        } catch (err) {
            const is409 = err.statusCode === 409;
            const is404 = err.statusCode === 404;
            if ((is409 || is404) && attempt < 4) {
                console.log(`[Docker] ensureDir retry ${attempt}/3 (${err.message})`);
                await new Promise(r => setTimeout(r, 600 * attempt));
            } else {
                console.error(`[Docker] ensureDir error (attempt ${attempt}):`, err.message);
                return; // nu aruncam eroarea - nu e critic
            }
        }
    }
}

/**
 * Ruleaza o comanda si returneaza stdout+stderr.
 * Cu timeout de siguranta (default 8s).
 */
async function runCmd(container, cmd, timeoutMs = 8000) {
    return new Promise(async (resolve) => {
        const timer = setTimeout(() => {
            console.warn('[Docker] runCmd timeout:', cmd.slice(0, 80));
            resolve('');
        }, timeoutMs);

        try {
            const exec = await container.exec({
                Cmd: ['/bin/bash', '-c', cmd],
                AttachStdout: true,
                AttachStderr: true,
                Tty: false
            });
            const stream = await exec.start({ detach: false });
            let out = '';
            container.modem.demuxStream(
                stream,
                { write: (d) => { out += d.toString('utf8'); } },
                { write: (d) => { out += d.toString('utf8'); } }
            );
            const done = () => { clearTimeout(timer); resolve(out.trim()); };
            stream.on('end',    done);
            stream.on('close',  done);
            stream.on('finish', done);
        } catch (err) {
            clearTimeout(timer);
            console.error('[Docker] runCmd error:', err.message);
            resolve('');
        }
    });
}

// ═══════════════════════════════════════════════════════════════
//  CONTAINER LIFECYCLE
// ═══════════════════════════════════════════════════════════════

/**
 * Creaza sau porneste containerul unui user.
 * Aceasta functie este IDEMPOTENTA:
 * - daca containerul nu exista → il creaza si porneste
 * - daca exista dar e oprit   → il porneste
 * - daca exista si ruleaza    → nu face nimic
 * In toate cazurile asteapta pana e running si creeaza /workspace.
 */
async function createContainerForUser(userId) {
    const containerName = `eccc-user-${userId}`;
    console.log(`[Docker] createContainerForUser → ${containerName}`);

    try {
        const existing = await docker.listContainers({ all: true });
        const found    = existing.find(c => c.Names.includes(`/${containerName}`));

        if (found) {
            const container = docker.getContainer(containerName);
            const info      = await container.inspect();
            const status    = info.State.Status;

            if (status !== 'running') {
                console.log(`[Docker] Container ${containerName} status="${status}", pornind...`);
                try { await container.start(); } catch (e) {
                    // 304 = deja running (race condition), altfel arunca
                    if (e.statusCode !== 304) throw e;
                }
                // ASTEPTAM pana e efectiv running inainte de orice exec
                const ok = await waitUntilRunning(container, 12000);
                if (!ok) console.warn(`[Docker] Container ${containerName} nu a pornit la timp.`);
            } else {
                console.log(`[Docker] Container ${containerName} deja running.`);
            }

            await ensureDir(container, '/home/student/workspace');
            const info2 = await container.inspect();
            return info2.Id;
        }

        // ─── Container nou ────────────────────────────────────────
        console.log(`[Docker] Creare container nou: ${containerName}`);
        const container = await docker.createContainer({
            Image: 'eccc-student-env',
            name: containerName,
            Tty: true, OpenStdin: true, StdinOnce: false,
            Cmd: ['/bin/sh'],
            HostConfig: { Memory: 128 * 1024 * 1024, CpuQuota: 50000 }
        });

        await container.start();
        await waitUntilRunning(container, 12000);
        await ensureDir(container, '/home/student/workspace');

        const info = await container.inspect();
        console.log(`[Docker] Container creat si pornit: ${info.Id.slice(0,12)}`);
        return info.Id;

    } catch (err) {
        console.error('[Docker] createContainerForUser error:', err.message);
        throw err;
    }
}

/**
 * Opreste si sterge complet containerul unui user.
 * Apelat cand contul este sters.
 */
async function removeContainerForUser(userId) {
    const containerName = `eccc-user-${userId}`;
    console.log(`[Docker] Stergere container: ${containerName}`);
    try {
        const container = docker.getContainer(containerName);
        try { await container.stop({ t: 3 }); } catch (e) { /* ignoram daca nu ruleaza */ }
        await container.remove({ force: true });
        console.log(`[Docker] Container ${containerName} sters.`);
        return true;
    } catch (err) {
        // 404 = containerul nici nu exista, e ok
        if (err.statusCode !== 404) console.error('[Docker] removeContainer error:', err.message);
        return false;
    }
}

// ═══════════════════════════════════════════════════════════════
//  TERMINAL STREAM
// ═══════════════════════════════════════════════════════════════
async function getContainerStream(userId, projectName) {
    const containerName = `eccc-user-${userId}`;
    const container     = docker.getContainer(containerName);
    const workPath      = projectName
        ? `/home/student/workspace/${projectName}`
        : `/home/student/workspace`;

    await ensureDir(container, workPath);

    try {
        const exec = await container.exec({
            Cmd: ['/bin/bash', '-il'],
            WorkingDir: workPath,
            AttachStdin: true, AttachStdout: true, AttachStderr: true,
            Tty: true
        });
        return await exec.start({ stdin: true, hijack: true, Tty: true });
    } catch (err) {
        console.error('[Docker] getContainerStream error:', err.message);
        try {
            const exec = await container.exec({
                Cmd: ['/bin/bash', '-c', `cd "${workPath}" && exec bash -il`],
                AttachStdin: true, AttachStdout: true, AttachStderr: true,
                Tty: true
            });
            return await exec.start({ stdin: true, hijack: true, Tty: true });
        } catch (fe) {
            console.error('[Docker] fallback stream error:', fe.message);
            return null;
        }
    }
}

// ═══════════════════════════════════════════════════════════════
//  PROJECT
// ═══════════════════════════════════════════════════════════════
async function setupProjectInContainer(userId, projectName, lang) {
    const container = docker.getContainer(`eccc-user-${userId}`);
    const ext       = lang === 'python' ? 'py' : (lang === 'cpp' ? 'cpp' : 'c');
    const workPath  = `/home/student/workspace/${projectName}`;
    const template  = lang === 'python'
        ? `def main():\n    print("Hello from EduCode!")\n\nif __name__ == "__main__":\n    main()`
        : lang === 'cpp'
            ? `#include <iostream>\nusing namespace std;\n\nint main() {\n    cout << "Hello from EduCode!" << endl;\n    return 0;\n}`
            : `#include <stdio.h>\n\nint main() {\n    printf("Hello from EduCode!\\n");\n    return 0;\n}`;

    const b64 = Buffer.from(template).toString('base64');
    await runCmd(container,
        `mkdir -p "${workPath}" && printf '%s' "$(echo '${b64}' | base64 -d)" > "${workPath}/main.${ext}"`
    );
    console.log(`[Docker] Project "${projectName}" (${lang}) setup OK`);
}

// ═══════════════════════════════════════════════════════════════
//  SAVE / READ
// ═══════════════════════════════════════════════════════════════
async function saveFileInContainer(userId, projectName, code, lang) {
    const container = docker.getContainer(`eccc-user-${userId}`);
    const ext       = lang === 'python' ? 'py' : (lang === 'cpp' ? 'cpp' : 'c');
    const filePath  = `/home/student/workspace/${projectName}/main.${ext}`;
    const b64       = Buffer.from(code).toString('base64');
    await runCmd(container,
        `mkdir -p "/home/student/workspace/${projectName}" && printf '%s' "$(echo '${b64}' | base64 -d)" > "${filePath}"`
    );
}

async function readFileFromContainer(userId, projectName, lang) {
    const container = docker.getContainer(`eccc-user-${userId}`);
    const ext       = lang === 'python' ? 'py' : (lang === 'cpp' ? 'cpp' : 'c');
    const filePath  = `/home/student/workspace/${projectName}/main.${ext}`;
    try {
        const exec   = await container.exec({ Cmd: ['cat', filePath], AttachStdout: true, AttachStderr: true, Tty: false });
        const stream = await exec.start({ detach: false });
        return new Promise((resolve) => {
            let output = '';
            container.modem.demuxStream(stream, { write: (d) => { output += d.toString('utf8'); } }, { write: () => {} });
            const done = () => resolve(output);
            stream.on('end', done); stream.on('close', done); stream.on('finish', done);
        });
    } catch (err) { console.error('[Docker] readFile error:', err.message); return ''; }
}

// ═══════════════════════════════════════════════════════════════
//  RUN / SYNTAX CHECK
// ═══════════════════════════════════════════════════════════════
async function runCodeInteractive(userId, projectName, code, lang, socket) {
    const container = docker.getContainer(`eccc-user-${userId}`);
    const workPath  = `/home/student/workspace/${projectName}`;
    const b64       = Buffer.from(code).toString('base64');
    let shellCmd;

    if (lang === 'cpp') {
        shellCmd = `mkdir -p "${workPath}" && printf '%s' "$(echo '${b64}' | base64 -d)" > "${workPath}/main.cpp" && cd "${workPath}" && g++ main.cpp -o main_exec 2>&1 && ./main_exec`;
    } else if (lang === 'c') {
        shellCmd = `mkdir -p "${workPath}" && printf '%s' "$(echo '${b64}' | base64 -d)" > "${workPath}/main.c" && cd "${workPath}" && gcc main.c -o main_exec 2>&1 && ./main_exec`;
    } else {
        shellCmd = `mkdir -p "${workPath}" && printf '%s' "$(echo '${b64}' | base64 -d)" > "${workPath}/main.py" && cd "${workPath}" && python3 -u main.py`;
    }

    try {
        const exec   = await container.exec({ Cmd: ['/bin/bash', '-c', shellCmd], AttachStdin: true, AttachStdout: true, AttachStderr: true, Tty: false });
        const stream = await exec.start({ stdin: true, hijack: true, Tty: false });
        container.modem.demuxStream(stream,
            { write: (d) => socket.emit('run-output', { type: 'stdout', text: d.toString('utf8') }) },
            { write: (d) => socket.emit('run-output', { type: 'stderr', text: d.toString('utf8') }) }
        );
        stream.on('end',   () => socket.emit('run-finished'));
        stream.on('close', () => socket.emit('run-finished'));
        return stream;
    } catch (err) {
        socket.emit('run-output', { type: 'stderr', text: '[EduCode Error] ' + err.message + '\n' });
        socket.emit('run-finished');
        return null;
    }
}

async function checkSyntaxInContainer(userId, projectName, code, lang) {
    const container = docker.getContainer(`eccc-user-${userId}`);
    const workPath  = `/home/student/workspace/${projectName}`;
    const b64       = Buffer.from(code).toString('base64');
    let checkCmd;
    if (lang === 'cpp') {
        checkCmd = `mkdir -p "${workPath}" && printf '%s' "$(echo '${b64}' | base64 -d)" > "${workPath}/main.cpp" && g++ -fsyntax-only "${workPath}/main.cpp" 2>&1`;
    } else if (lang === 'c') {
        checkCmd = `mkdir -p "${workPath}" && printf '%s' "$(echo '${b64}' | base64 -d)" > "${workPath}/main.c" && gcc -fsyntax-only "${workPath}/main.c" 2>&1`;
    } else {
        checkCmd = `mkdir -p "${workPath}" && printf '%s' "$(echo '${b64}' | base64 -d)" > "${workPath}/main.py" && python3 -m py_compile "${workPath}/main.py" 2>&1`;
    }
    return await runCmd(container, checkCmd, 15000);
}

// ═══════════════════════════════════════════════════════════════
//  FILE SYSTEM
// ═══════════════════════════════════════════════════════════════
async function listFilesInContainer(userId, dirPath) {
    const container = docker.getContainer(`eccc-user-${userId}`);
    await ensureDir(container, dirPath);
    const output = await runCmd(container,
        `find "${dirPath}" -maxdepth 1 -mindepth 1 \\( -type f -o -type d \\) -printf "%y\\t%s\\t%T@\\t%f\\n" 2>/dev/null || ls -1p "${dirPath}" 2>/dev/null`
    );
    if (!output) return [];
    return output.split('\n').filter(l => l.trim()).map(line => {
        const parts = line.split('\t');
        if (parts.length >= 4) {
            const [type, size, mtime, ...rest] = parts;
            const name = rest.join('\t').trim();
            if (!name) return null;
            return { name, isDir: type === 'd', size: parseInt(size) || 0, mtime: Math.round(parseFloat(mtime)) || 0 };
        }
        const name = line.trim(); if (!name) return null;
        const isDir = name.endsWith('/');
        return { name: isDir ? name.slice(0,-1) : name, isDir, size: 0, mtime: 0 };
    }).filter(Boolean).sort((a,b) => { if(a.isDir&&!b.isDir)return -1; if(!a.isDir&&b.isDir)return 1; return a.name.localeCompare(b.name); });
}

async function readFilePreviewFromContainer(userId, filePath) {
    const container = docker.getContainer(`eccc-user-${userId}`);
    return await runCmd(container, `head -c 4096 "${filePath}" 2>/dev/null`);
}

async function createFileInContainer(userId, dirPath, fileName, content) {
    const container = docker.getContainer(`eccc-user-${userId}`);
    const b64 = Buffer.from(content || '').toString('base64');
    await runCmd(container, `mkdir -p "${dirPath}" && printf '%s' "$(echo '${b64}' | base64 -d)" > "${dirPath}/${fileName}"`);
    return true;
}

async function deleteInContainer(userId, path) {
    const container = docker.getContainer(`eccc-user-${userId}`);
    await runCmd(container, `rm -rf "${path}"`);
    return true;
}

async function renameInContainer(userId, oldPath, newPath) {
    const container = docker.getContainer(`eccc-user-${userId}`);
    await runCmd(container, `mv "${oldPath}" "${newPath}"`);
    return true;
}

async function copyInContainer(userId, sourcePath, destPath) {
    const container = docker.getContainer(`eccc-user-${userId}`);
    await runCmd(container, `cp -r "${sourcePath}" "${destPath}"`);
    return true;
}

async function mkdirInContainer(userId, path) {
    const container = docker.getContainer(`eccc-user-${userId}`);
    await ensureDir(container, path);
    return true;
}

module.exports = {
    createContainerForUser, removeContainerForUser,
    getContainerStream, setupProjectInContainer,
    runCodeInteractive, checkSyntaxInContainer,
    saveFileInContainer, readFileFromContainer,
    listFilesInContainer, readFilePreviewFromContainer,
    createFileInContainer, deleteInContainer,
    renameInContainer, copyInContainer, mkdirInContainer
};

// ─── UPLOAD FILE TO CONTAINER (via Docker putArchive) ─────────
// Folosim API-ul nativ Docker in loc de shell - mai sigur pt binare
function buildTarBuffer(fileName, fileData) {
    const BLOCK  = 512;
    const header = Buffer.alloc(BLOCK, 0);

    Buffer.from(fileName.slice(0, 99) + '\0',           'ascii').copy(header,   0);
    Buffer.from('0000644\0',                             'ascii').copy(header, 100);
    Buffer.from('0000000\0',                             'ascii').copy(header, 108);
    Buffer.from('0000000\0',                             'ascii').copy(header, 116);
    Buffer.from(fileData.length.toString(8).padStart(11,'0') + '\0', 'ascii').copy(header, 124);
    Buffer.from(Math.floor(Date.now()/1000).toString(8).padStart(11,'0') + '\0', 'ascii').copy(header, 136);
    header.fill(0x20, 148, 156);       // checksum placeholder = spaces
    header[156] = 0x30;                // type = '0' regular file
    Buffer.from('ustar\0', 'ascii').copy(header, 257);
    Buffer.from('00',      'ascii').copy(header, 263);

    // Calcul checksum
    let sum = 0;
    for (let i = 0; i < BLOCK; i++) sum += header[i];
    Buffer.from(sum.toString(8).padStart(6,'0') + '\0 ', 'ascii').copy(header, 148);

    // Date + padding la multiplu de 512
    const padded = Buffer.alloc(Math.ceil(Math.max(fileData.length,1) / BLOCK) * BLOCK, 0);
    fileData.copy(padded);

    return Buffer.concat([header, padded, Buffer.alloc(BLOCK * 2, 0)]);
}

async function uploadFileToContainer(userId, targetPath, fileName, base64Content) {
    const container = docker.getContainer(`eccc-user-${userId}`);
    try {
        const fileData  = Buffer.from(base64Content, 'base64');
        const tarBuffer = buildTarBuffer(fileName, fileData);

        // Asiguram ca directorul tinta exista
        await ensureDir(container, targetPath);

        // Incarcam prin API-ul Docker nativ (nu prin shell)
        const { Readable } = require('stream');
        const tarStream = new Readable();
        tarStream.push(tarBuffer);
        tarStream.push(null);

        await container.putArchive(tarStream, { path: targetPath });
        console.log(`[Docker] Upload OK: "${fileName}" → ${targetPath}`);
        return true;
    } catch (err) {
        console.error('[Docker] uploadFile error:', err.message);
        throw err;
    }
}

// Re-exportam cu functia noua
module.exports = Object.assign(module.exports, { uploadFileToContainer });
