const Docker = require('dockerode');
const docker = new Docker();

async function createContainerForUser(userId) {
    const containerName = `eccc-user-${userId}`;

    try {
        console.log(`[Docker] Se pregătește containerul pentru ID: ${userId}`);

        const existingContainers = await docker.listContainers({ all: true });
        const isCreated = existingContainers.some(c => c.Names.includes(`/${containerName}`));

        if (isCreated) {
            console.log(`[Docker] Containerul ${containerName} există deja. Încercăm pornirea...`);
            const container = docker.getContainer(containerName);
            
            try {
                await container.start();
            } catch (startErr) {
                if (startErr.statusCode === 304) {
                    console.log(`[Docker] Succes invizibil: Containerul rula deja. Mergem mai departe!`);
                } else {
                    throw startErr;
                }
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
        console.log(`[Docker] Container NOU creat și pornit: ${containerName}`);
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
            AttachStdin: true,
            AttachStdout: true,
            AttachStderr: true,
            Tty: true 
        });

        const stream = await exec.start({ stdin: true, hijack: true, Tty: true });
        console.log(`[Docker] Stream generat cu succes pentru ${containerName}`);
        
        return stream;

    } catch (err) {
        console.error(`[Docker] Eroare la generarea stream-ului:`, err.message);
        return null;
    }
}

module.exports = { createContainerForUser, getContainerStream };