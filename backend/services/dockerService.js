const Docker = require('dockerode');
const docker = new Docker();

async function createContainerForUser(userId) {
    const containerName = `eccc-user-${userId}`;
    try {
        const existingContainers = await docker.listContainers({ all: true });
        const isCreated = existingContainers.some(c => c.Names.includes(`/${containerName}`));

        if (isCreated) {
            const container = docker.getContainer(containerName);
            try {
                await container.start();
            } catch (startErr) {
                if (startErr.statusCode !== 304) throw startErr;
            }
            return container.id;
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
        return container.id;
    } catch (err) {
        console.error("[Docker] Eroare la creare:", err.message);
        throw err;
    }
}

async function getContainerStream(userId) {
    const containerName = `eccc-user-${userId}`;
    const container = docker.getContainer(containerName);
    try {
        const exec = await container.exec({
            Cmd: ['/bin/bash', '-il'], 
            AttachStdin: true, AttachStdout: true, AttachStderr: true, Tty: true 
        });
        return await exec.start({ stdin: true, hijack: true, Tty: true });
    } catch (err) {
        console.error(`[Docker] Eroare stream:`, err.message);
        return null;
    }
}

// NOU: Funcția pentru rularea codului (necesară pentru butonul Run)
async function runCodeInContainer(userId, code, lang) {
    const containerName = `eccc-user-${userId}`;
    const container = docker.getContainer(containerName);
    try {
        const base64Code = Buffer.from(code).toString('base64');
        let filename, runCmd;

        if (lang === 'cpp') {
            filename = 'main.cpp';
            runCmd = `echo ${base64Code} | base64 -d > ${filename} && g++ ${filename} -o main && ./main`;
        } else if (lang === 'c') {
            filename = 'main.c';
            runCmd = `echo ${base64Code} | base64 -d > ${filename} && gcc ${filename} -o main && ./main`;
        } else {
            filename = 'main.py';
            runCmd = `echo ${base64Code} | base64 -d > ${filename} && python3 ${filename}`;
        }

        const exec = await container.exec({
            Cmd: ['/bin/bash', '-c', runCmd],
            AttachStdout: true, AttachStderr: true, Tty: true
        });

        const stream = await exec.start({ detach: false });
        return new Promise((resolve, reject) => {
            let output = '';
            stream.on('data', (chunk) => { output += chunk.toString('utf8'); });
            stream.on('end', () => resolve(output));
            stream.on('error', (err) => reject(err));
        });
    } catch (err) {
        throw err;
    }
}

module.exports = { createContainerForUser, getContainerStream, runCodeInContainer };