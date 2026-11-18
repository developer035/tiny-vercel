const { generateSlug } = require('random-word-slugs');
require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const Redis = require('ioredis');
const crypto = require('crypto');
const { JobsClient } = require('@google-cloud/run').v2;

const app = express();
app.use(express.json());

// Set up HTTP Server and Socket.io
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: '*',
        methods: ['GET', 'POST']
    }
});

// ANSI styling palette for beautiful terminal output
const ANSI = {
    reset: "\x1b[0m",
    bold: "\x1b[1m",
    dim: "\x1b[2m",
    gray: "\x1b[90m",
    cyan: "\x1b[36m",
    green: "\x1b[32m",
    yellow: "\x1b[33m",
    blue: "\x1b[34m",
    magenta: "\x1b[35m",
    red: "\x1b[31m"
};

function formatTerminalLog(payload) {
    const timeStr = payload.timestamp
        ? new Date(payload.timestamp).toLocaleTimeString("en-GB")
        : new Date().toLocaleTimeString("en-GB");

    const project = (payload.project || "unknown").slice(0, 18).padEnd(16);
    const level = (payload.level || "info").toLowerCase();

    let levelBadge;
    let messageColor = ANSI.reset;

    switch (level) {
        case "ready":
        case "success":
            levelBadge = `${ANSI.green}✔ READY ${ANSI.reset}`;
            messageColor = `${ANSI.bold}${ANSI.green}`;
            break;
        case "upload":
            levelBadge = `${ANSI.yellow}☁ UPLOAD${ANSI.reset}`;
            messageColor = ANSI.yellow;
            break;
        case "step":
            levelBadge = `${ANSI.blue}ℹ STEP  ${ANSI.reset}`;
            messageColor = `${ANSI.bold}${ANSI.cyan}`;
            break;
        case "warn":
            levelBadge = `${ANSI.yellow}⚠ WARN  ${ANSI.reset}`;
            messageColor = ANSI.yellow;
            break;
        case "error":
            levelBadge = `${ANSI.red}✖ ERROR ${ANSI.reset}`;
            messageColor = `${ANSI.bold}${ANSI.red}`;
            break;
        case "cmd":
            levelBadge = `${ANSI.magenta}⚡ CMD   ${ANSI.reset}`;
            messageColor = ANSI.magenta;
            break;
        default:
            levelBadge = `${ANSI.gray}• INFO  ${ANSI.reset}`;
            messageColor = ANSI.reset;
    }

    const timeCol = `${ANSI.gray}${timeStr}${ANSI.reset}`;
    const projectCol = `${ANSI.cyan}${ANSI.bold}${project}${ANSI.reset}`;
    const sep = `${ANSI.gray}│${ANSI.reset}`;

    return `${timeCol} ${sep} ${projectCol} ${sep} ${levelBadge} ${sep} ${messageColor}${payload.log}${ANSI.reset}`;
}

// Redis subscriber setup (Aiven Valkey / Redis)
const REDIS_URL = process.env.REDIS_URL || "";
let subscriber = null;

if (REDIS_URL) {
    subscriber = new Redis(REDIS_URL);

    subscriber.on('connect', () => {
        console.log(`${ANSI.green}✔${ANSI.reset} Connected to Redis/Valkey subscriber successfully`);
    });

    subscriber.on('error', (err) => {
        console.error(`${ANSI.red}✖ Redis subscriber error:${ANSI.reset}`, err.message);
    });

    // Pattern subscribe to all project logs
    subscriber.psubscribe('logs:*', (err, count) => {
        if (err) {
            console.error(`${ANSI.red}✖ Failed to subscribe to logs pattern:${ANSI.reset}`, err.message);
        } else {
            console.log(`${ANSI.cyan}ℹ Subscribed to Redis logs pattern:${ANSI.reset} logs:* (active: ${count})`);
        }
    });

    // Handle incoming messages on matching pattern
    subscriber.on('pmessage', (pattern, channel, message) => {
        let payload;

        try {
            const parsed = JSON.parse(message);
            payload = {
                project: parsed.project || channel.replace('logs:', ''),
                log: parsed.log || message,
                level: parsed.level || 'info',
                stage: parsed.stage || 'build',
                timestamp: parsed.timestamp || new Date().toISOString(),
                ...parsed
            };
        } catch {
            payload = {
                project: channel.replace('logs:', ''),
                log: message,
                level: 'info',
                stage: 'build',
                timestamp: new Date().toISOString()
            };
        }

        // 1. Beautifully formatted terminal log
        console.log(formatTerminalLog(payload));

        // 2. Broadcast structured payload to Socket.io rooms (for frontend consumption)
        const payloadStr = JSON.stringify(payload);
        io.to(channel).emit('message', payloadStr);
        io.to(payload.project).emit('message', payloadStr);
    });
} else {
    console.warn(`${ANSI.yellow}⚠ REDIS_URL not set. Redis subscriber is disabled.${ANSI.reset}`);
}

// Socket.io connection for frontend clients
io.on('connection', (socket) => {
    console.log(`${ANSI.gray}[WS]${ANSI.reset} Client connected: ${socket.id}`);

    // Client requests to subscribe to logs for a specific project
    socket.on('subscribe', (channelOrSlug) => {
        socket.join(channelOrSlug);
        if (!channelOrSlug.startsWith('logs:')) {
            socket.join(`logs:${channelOrSlug}`);
        }
        console.log(`${ANSI.gray}[WS]${ANSI.reset} Socket ${socket.id} subscribed to: ${channelOrSlug}`);
        
        socket.emit('message', JSON.stringify({
            project: channelOrSlug.replace('logs:', ''),
            log: `Connected to log stream for ${channelOrSlug}`,
            level: 'info',
            stage: 'init',
            timestamp: new Date().toISOString()
        }));
    });

    socket.on('disconnect', () => {
        console.log(`${ANSI.gray}[WS]${ANSI.reset} Client disconnected: ${socket.id}`);
    });
});

const { GoogleAuth } = require('google-auth-library');

const auth = new GoogleAuth({
    scopes: ['https://www.googleapis.com/auth/cloud-platform']
});

// Cloud Run configuration
const config = {
    PROJECT_ID: process.env.GCP_PROJECT_ID,
    REGION: process.env.GCP_REGION || 'asia-south1',
    JOB: process.env.CLOUD_RUN_JOB || 'tiny-vercel'
};

// Cloud Run Jobs client
const runClient = new JobsClient();

// Validate configuration
if (!config.PROJECT_ID) {
    throw new Error('GCP_PROJECT_ID is missing from environment variables');
}

// Health check
app.get('/', (req, res) => {
    res.json({
        message: 'Tiny Vercel API is running'
    });
});

// Create project and trigger build
app.post('/project', async (req, res) => {
    try {
        const { gitURL } = req.body;

        if (!gitURL) {
            return res.status(400).json({
                error: 'GitHub repository URL is required'
            });
        }

        // Basic GitHub URL validation
        let repositoryURL;

        try {
            repositoryURL = new URL(gitURL);
        } catch {
            return res.status(400).json({
                error: 'Invalid repository URL'
            });
        }

        if (
            repositoryURL.hostname !== 'github.com' ||
            !repositoryURL.pathname.split('/').filter(Boolean).length
        ) {
            return res.status(400).json({
                error: 'Please provide a valid GitHub repository URL'
            });
        }

        // Generate project slug
        const projectSlug = generateSlug();

        // Cloud Run Job resource name
        const jobName =
            `projects/${config.PROJECT_ID}` +
            `/locations/${config.REGION}` +
            `/jobs/${config.JOB}`;

        console.log(`${ANSI.cyan}ℹ Creating project:${ANSI.reset} ${projectSlug}`);
        console.log(`${ANSI.gray}  Repository:${ANSI.reset} ${gitURL}`);

        // Prepare container environment variables
        const containerEnv = [
            {
                name: 'GIT_REPOSITORY_URL',
                value: gitURL
            },
            {
                name: 'PROJECT_ID',
                value: projectSlug
            }
        ];

        // Pass REDIS_URL to Cloud Run Job container if configured
        if (REDIS_URL) {
            containerEnv.push({
                name: 'REDIS_URL',
                value: REDIS_URL
            });
        }

        // Trigger Cloud Run Job
        const [operation] = await runClient.runJob({
            name: jobName,
            overrides: {
                containerOverrides: [
                    {
                        name: 'builder-image',
                        env: containerEnv
                    }
                ]
            }
        });

        console.log(`${ANSI.green}✔ Build submitted for ${projectSlug}.${ANSI.reset} Live preview will be at: http://${projectSlug}.localhost:8000`);

        return res.status(202).json({
            status: 'queued',
            message: 'Project build started successfully',
            data: {
                projectSlug,
                url: `http://${projectSlug}.localhost:8000`
            }
        });

    } catch (error) {
        console.error(`${ANSI.red}✖ Cloud Run error:${ANSI.reset}`, error);

        return res.status(500).json({
            status: 'error',
            message: 'Failed to start project build'
        });
    }
});

// Start server
const PORT = process.env.PORT || 9000;

server.listen(PORT, () => {
    console.log(`${ANSI.green}🚀 Tiny Vercel API running on port ${PORT}${ANSI.reset}`);
});
