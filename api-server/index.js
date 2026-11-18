const { generateSlug } = require('random-word-slugs');
require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const Redis = require('ioredis');
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

// In-memory log history buffer for new subscribers and REST polling
const MAX_LOG_HISTORY = 150;
const logHistory = new Map();

function storeLog(project, payload) {
    if (!project) return;
    if (!logHistory.has(project)) {
        logHistory.set(project, []);
    }
    const history = logHistory.get(project);
    history.push(payload);
    if (history.length > MAX_LOG_HISTORY) {
        history.shift();
    }
}

function formatTerminalLog(payload) {
    const timeStr = payload.timestamp
        ? new Date(payload.timestamp).toLocaleTimeString("en-GB")
        : new Date().toLocaleTimeString("en-GB");

    const project = (payload.project || "unknown").slice(0, 18).padEnd(16);
    const stage = (payload.stage || "build").toLowerCase();
    const level = (payload.level || "info").toLowerCase();

    let stageBadge;
    switch (stage) {
        case "provisioning":
            stageBadge = `${ANSI.magenta}[PROVISION]${ANSI.reset}`;
            break;
        case "container":
            stageBadge = `${ANSI.blue}[CONTAINER]${ANSI.reset}`;
            break;
        case "source":
            stageBadge = `${ANSI.cyan}[SOURCE]   ${ANSI.reset}`;
            break;
        case "environment":
            stageBadge = `${ANSI.yellow}[ENV]      ${ANSI.reset}`;
            break;
        case "install":
            stageBadge = `${ANSI.blue}[INSTALL]  ${ANSI.reset}`;
            break;
        case "build":
            stageBadge = `${ANSI.magenta}[BUILD]    ${ANSI.reset}`;
            break;
        case "upload":
            stageBadge = `${ANSI.yellow}[UPLOAD]   ${ANSI.reset}`;
            break;
        case "ready":
            stageBadge = `${ANSI.green}[READY]    ${ANSI.reset}`;
            break;
        case "error":
            stageBadge = `${ANSI.red}[ERROR]    ${ANSI.reset}`;
            break;
        default:
            stageBadge = `${ANSI.gray}[${stage.toUpperCase().slice(0, 9).padEnd(9)}]${ANSI.reset}`;
    }

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
        case "stdout":
            levelBadge = `${ANSI.gray}• OUT   ${ANSI.reset}`;
            messageColor = ANSI.reset;
            break;
        case "stderr":
            levelBadge = `${ANSI.yellow}• ERR   ${ANSI.reset}`;
            messageColor = ANSI.yellow;
            break;
        default:
            levelBadge = `${ANSI.gray}• INFO  ${ANSI.reset}`;
            messageColor = ANSI.reset;
    }

    const timeCol = `${ANSI.gray}${timeStr}${ANSI.reset}`;
    const projectCol = `${ANSI.cyan}${ANSI.bold}${project}${ANSI.reset}`;
    const sep = `${ANSI.gray}│${ANSI.reset}`;

    return `${timeCol} ${sep} ${projectCol} ${sep} ${stageBadge} ${sep} ${levelBadge} ${sep} ${messageColor}${payload.log}${ANSI.reset}`;
}

// Unified log ingestion handler (handles formatting, caching, and broadcasting)
function handleIncomingLog(payload, channel) {
    storeLog(payload.project, payload);

    // 1. Terminal log
    console.log(formatTerminalLog(payload));

    // 2. Broadcast structured payload to Socket.io rooms
    const payloadStr = JSON.stringify(payload);
    if (channel) {
        io.to(channel).emit('message', payloadStr);
    }
    if (payload.project) {
        io.to(`logs:${payload.project}`).emit('message', payloadStr);
        io.to(payload.project).emit('message', payloadStr);
    }
}

// Redis Pub/Sub setup (Aiven Valkey / Redis)
const REDIS_URL = process.env.REDIS_URL || "";
let subscriber = null;
let publisher = null;

if (REDIS_URL) {
    subscriber = new Redis(REDIS_URL);
    publisher = new Redis(REDIS_URL);

    subscriber.on('connect', () => {
        console.log(`${ANSI.green}✔${ANSI.reset} Connected to Redis/Valkey subscriber successfully`);
    });

    subscriber.on('error', (err) => {
        console.error(`${ANSI.red}✖ Redis subscriber error:${ANSI.reset}`, err.message);
    });

    publisher.on('connect', () => {
        console.log(`${ANSI.green}✔${ANSI.reset} Connected to Redis/Valkey publisher successfully`);
    });

    publisher.on('error', (err) => {
        console.error(`${ANSI.red}✖ Redis publisher error:${ANSI.reset}`, err.message);
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
                category: parsed.category || 'build',
                timestamp: parsed.timestamp || new Date().toISOString(),
                ...parsed
            };
        } catch {
            payload = {
                project: channel.replace('logs:', ''),
                log: message,
                level: 'info',
                stage: 'build',
                category: 'build',
                timestamp: new Date().toISOString()
            };
        }

        handleIncomingLog(payload, channel);
    });
} else {
    console.warn(`${ANSI.yellow}⚠ REDIS_URL not set. Redis subscriber/publisher is disabled.${ANSI.reset}`);
}

/**
 * Publishes an API-generated log event (e.g. provisioning / dispatching).
 */
function publishApiLog(project, log, { stage = "provisioning", category = "container", level = "info", meta = {} } = {}) {
    const payload = {
        project,
        log,
        stage,
        category,
        level,
        timestamp: new Date().toISOString(),
        ...meta
    };

    if (publisher) {
        // Publish to Redis; subscriber.on('pmessage') will ingest and broadcast
        publisher.publish(`logs:${project}`, JSON.stringify(payload));
    } else {
        // Direct local dispatch when Redis is disabled
        handleIncomingLog(payload, `logs:${project}`);
    }
}

// Socket.io connection for frontend clients
io.on('connection', (socket) => {
    console.log(`${ANSI.gray}[WS]${ANSI.reset} Client connected: ${socket.id}`);

    // Client requests to subscribe to logs for a specific project
    socket.on('subscribe', (channelOrSlug) => {
        const projectSlug = channelOrSlug.replace('logs:', '');
        socket.join(channelOrSlug);
        socket.join(projectSlug);
        socket.join(`logs:${projectSlug}`);

        console.log(`${ANSI.gray}[WS]${ANSI.reset} Socket ${socket.id} subscribed to: ${channelOrSlug}`);

        // Replay historical logs if available so initial provisioning logs are never lost
        const history = logHistory.get(projectSlug);
        if (history && history.length > 0) {
            for (const item of history) {
                socket.emit('message', JSON.stringify(item));
            }
        } else {
            socket.emit('message', JSON.stringify({
                project: projectSlug,
                log: `Connected to log stream for ${projectSlug}`,
                level: 'info',
                stage: 'provisioning',
                category: 'container',
                timestamp: new Date().toISOString()
            }));
        }
    });

    socket.on('disconnect', () => {
        console.log(`${ANSI.gray}[WS]${ANSI.reset} Client disconnected: ${socket.id}`);
    });
});

// Cloud Run configuration
const config = {
    PROJECT_ID: process.env.GCP_PROJECT_ID,
    REGION: process.env.GCP_REGION || 'asia-south1',
    JOB: process.env.CLOUD_RUN_JOB || 'tiny-vercel'
};

// Cloud Run Jobs client
let runClient = null;
if (config.PROJECT_ID) {
    runClient = new JobsClient();
} else {
    console.warn(`${ANSI.yellow}⚠ GCP_PROJECT_ID is missing from environment variables. Cloud Run Job dispatch will fail if triggered.${ANSI.reset}`);
}

// Health check
app.get('/', (req, res) => {
    res.json({
        message: 'Tiny Vercel API is running'
    });
});

// Retrieve log history for a project
app.get('/project/:slug/logs', (req, res) => {
    const { slug } = req.params;
    const logs = logHistory.get(slug) || [];
    res.json({
        project: slug,
        total: logs.length,
        logs
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

        // 1. Log provisioning receipt
        publishApiLog(projectSlug, `Received deployment request for repository: ${gitURL}`, {
            stage: 'provisioning',
            category: 'container',
            level: 'info'
        });

        publishApiLog(projectSlug, `[Step 0/5] Initiating Google Cloud Run Job '${config.JOB}' in region '${config.REGION}'...`, {
            stage: 'provisioning',
            category: 'container',
            level: 'step'
        });

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

        if (!runClient) {
            throw new Error('GCP_PROJECT_ID is not configured on this server');
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

        // 2. Log successful dispatch
        publishApiLog(projectSlug, `Cloud Run Job container dispatched. Waiting for build worker to boot...`, {
            stage: 'provisioning',
            category: 'container',
            level: 'info'
        });

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

        if (req.body && req.body.gitURL) {
            // If we have a project slug or error to emit
            const fallbackSlug = "error";
            publishApiLog(fallbackSlug, `Failed to dispatch build container: ${error.message}`, {
                stage: 'error',
                category: 'container',
                level: 'error'
            });
        }

        return res.status(500).json({
            status: 'error',
            message: 'Failed to start project build',
            error: error.message
        });
    }
});

// Start server
const PORT = process.env.PORT || 9000;

server.listen(PORT, () => {
    console.log(`${ANSI.green}🚀 Tiny Vercel API running on port ${PORT}${ANSI.reset}`);
});
