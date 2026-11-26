const { generateSlug } = require('random-word-slugs');
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { z } = require('zod');
const { PrismaClient } = require('@prisma/client');
const { clerkMiddleware, getAuth, verifyToken } = require('@clerk/express');
const http = require('http');
const { Server } = require('socket.io');
const { JobsClient } = require('@google-cloud/run').v2;
const { createClient } = require('@clickhouse/client');
const { Kafka } = require('kafkajs');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');
const path = require('path');

const app = express();

// Prisma client with extended timeouts to handle Neon serverless pooler scale-to-zero
const dbUrl = process.env.DATABASE_URL || '';
const prisma = new PrismaClient(dbUrl ? {
    datasources: {
        db: {
            url: dbUrl.includes('connect_timeout=')
                ? dbUrl
                : `${dbUrl}${dbUrl.includes('?') ? '&' : '?'}connect_timeout=15&pool_timeout=30`
        }
    }
} : {});

app.use(express.json());
app.use(cors());

if (!process.env.CLERK_SECRET_KEY) {
    console.warn(`${ANSI.yellow}⚠ CLERK_SECRET_KEY is missing from environment variables. Protected routes will reject requests.${ANSI.reset}`);
}

// Mount full @clerk/express middleware when CLERK_PUBLISHABLE_KEY is also configured;
// otherwise verify Bearer session JWTs directly using verifyToken + CLERK_SECRET_KEY.
if (process.env.CLERK_PUBLISHABLE_KEY && process.env.CLERK_SECRET_KEY) {
    app.use(clerkMiddleware());
}

async function requireUser(req, res) {
    if (!process.env.CLERK_SECRET_KEY) {
        res.status(500).json({
            status: 'error',
            error: 'Authentication is not configured on this server (CLERK_SECRET_KEY missing)'
        });
        return null;
    }

    if (process.env.CLERK_PUBLISHABLE_KEY) {
        const { userId } = getAuth(req);
        if (!userId) {
            res.status(401).json({ status: 'error', error: 'Unauthorized' });
            return null;
        }
        return userId;
    }

    const authHeader = req.headers.authorization || '';
    const match = authHeader.match(/^Bearer\s+(.+)$/i);
    if (!match) {
        res.status(401).json({ status: 'error', error: 'Unauthorized' });
        return null;
    }

    try {
        const payload = await verifyToken(match[1], {
            secretKey: process.env.CLERK_SECRET_KEY
        });
        if (!payload?.sub) {
            res.status(401).json({ status: 'error', error: 'Unauthorized' });
            return null;
        }
        return payload.sub;
    } catch {
        res.status(401).json({ status: 'error', error: 'Unauthorized' });
        return null;
    }
}

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

// Per-deployment debounce timers for status updates (prevents pool exhaustion on burst logs)
const deploymentStatusDebounce = new Map(); // deploymentId -> { status, rank, timer }

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

    // 2. Broadcast structured payload to Socket.io canonical room exactly once
    const payloadStr = JSON.stringify(payload);
    const targetRoom = channel || (payload.project ? `logs:${payload.project}` : null);
    if (targetRoom) {
        io.to(targetRoom).emit('message', payloadStr);
    }
}

// =========================================================================
// Deployment Status Lifecycle Tracking
// =========================================================================
const DEPLOYMENT_ALLOWED_FROM = {
    IN_PROGRESS: ['NOT_STARTED', 'QUEUED'],
    READY: ['NOT_STARTED', 'QUEUED', 'IN_PROGRESS'],
    FAIL: ['NOT_STARTED', 'QUEUED', 'IN_PROGRESS']
};
const DEPLOYMENT_STATUS_RANK = {
    NOT_STARTED: 0,
    QUEUED: 1,
    IN_PROGRESS: 2,
    READY: 3,
    FAIL: 3
};
const deploymentStatusCache = new Map();

function cacheDeploymentStatus(deploymentId, status) {
    if (deploymentStatusCache.size > 500) {
        const oldestKey = deploymentStatusCache.keys().next().value;
        deploymentStatusCache.delete(oldestKey);
    }
    deploymentStatusCache.set(deploymentId, status);
}

async function updateDeploymentStatus(deploymentId, projectSlug, nextStatus, projectId = null) {
    if (!deploymentId || !DEPLOYMENT_ALLOWED_FROM[nextStatus]) return false;

    const cachedStatus = deploymentStatusCache.get(deploymentId);
    if (cachedStatus && DEPLOYMENT_STATUS_RANK[cachedStatus] >= DEPLOYMENT_STATUS_RANK[nextStatus]) {
        return false;
    }

    try {
        const result = await prisma.deployment.updateMany({
            where: {
                id: deploymentId,
                status: { in: DEPLOYMENT_ALLOWED_FROM[nextStatus] }
            },
            data: { status: nextStatus }
        });

        cacheDeploymentStatus(deploymentId, nextStatus);

        if (result.count > 0) {
            console.log(`${ANSI.cyan}[DB]${ANSI.reset} Deployment ${deploymentId.slice(0, 8)} status -> ${nextStatus}`);
            io.emit('deployment:status', {
                deploymentId,
                project: projectSlug || '',
                projectId: projectId || null,
                status: nextStatus,
                timestamp: new Date().toISOString()
            });
            return true;
        }
    } catch (err) {
        console.error(`${ANSI.red}✖ Failed to update deployment status (${deploymentId} -> ${nextStatus}):${ANSI.reset}`, err.message);
    }
    return false;
}

// =========================================================================
// Aiven ClickHouse client
// =========================================================================
const clickhouseHost = process.env.CLICKHOUSE_HOST || '';
let clickhouseClient = null;

if (clickhouseHost) {
    const formattedUrl = clickhouseHost.startsWith('http://') || clickhouseHost.startsWith('https://')
        ? clickhouseHost
        : `https://${clickhouseHost}:${process.env.CLICKHOUSE_PORT || 8443}`;

    clickhouseClient = createClient({
        url: formattedUrl,
        database: process.env.CLICKHOUSE_DATABASE || 'default',
        username: process.env.CLICKHOUSE_USER || 'avnadmin',
        password: process.env.CLICKHOUSE_PASSWORD || ''
    });

    console.log(`${ANSI.green}✔${ANSI.reset} ClickHouse client initialized (${formattedUrl})`);
} else {
    console.warn(`${ANSI.yellow}⚠ CLICKHOUSE_HOST not set. ClickHouse client is disabled.${ANSI.reset}`);
}

// =========================================================================
// Aiven Kafka consumer (api-server side)
// Subscribes to 'container-logs', inserts every log row into ClickHouse
// =========================================================================
const KAFKA_BROKER = process.env.KAFKA_BROKER || '';
const KAFKA_USERNAME = process.env.KAFKA_USERNAME || '';
const KAFKA_PASSWORD = process.env.KAFKA_PASSWORD || '';
const KAFKA_CA_CERT = process.env.KAFKA_CA_CERT || process.env.KAFKA_CA_CONTENT || process.env.KAFKA_CA_PEM || '';
const KAFKA_CA_PATH = process.env.KAFKA_CA_PATH || '';
const KAFKA_TOPIC = process.env.KAFKA_TOPIC || 'container-logs';

// Helper to resolve CA certificate content from env variable or file path
function resolveCaCertificateContent(input) {
    const raw = input || KAFKA_CA_CERT || KAFKA_CA_PATH;
    if (!raw) {
        const defaultPaths = [
            path.resolve(__dirname, 'kafca_ca.pem'),
            path.resolve(__dirname, 'Kafka_Ca.pem'),
            path.resolve(__dirname, 'kafka.pem'),
            path.resolve(__dirname, '..', 'build-server', 'kafca_ca.pem'),
            path.resolve(__dirname, '..', 'build-server', 'Kafka_Ca.pem'),
            path.resolve(__dirname, '..', 'build-server', 'kafka.pem')
        ];
        const found = defaultPaths.find(p => fs.existsSync(p));
        if (found) {
            try {
                return fs.readFileSync(found, 'utf-8');
            } catch {
                return null;
            }
        }
        return null;
    }

    let trimmed = raw.trim();
    if (trimmed.includes('\\n')) {
        trimmed = trimmed.replace(/\\n/g, '\n');
    }

    if (trimmed.includes('BEGIN CERTIFICATE')) {
        return trimmed;
    }

    const candidatePaths = [
        path.resolve(trimmed),
        path.resolve(__dirname, trimmed),
        path.resolve(__dirname, path.basename(trimmed)),
        path.resolve(__dirname, 'kafca_ca.pem'),
        path.resolve(__dirname, 'Kafka_Ca.pem'),
        path.resolve(__dirname, 'kafka.pem'),
        path.resolve(__dirname, '..', 'build-server', 'kafca_ca.pem'),
        path.resolve(__dirname, '..', 'build-server', 'Kafka_Ca.pem'),
        path.resolve(__dirname, '..', 'build-server', 'kafka.pem')
    ];
    const found = candidatePaths.find(p => fs.existsSync(p));
    if (found) {
        try {
            return fs.readFileSync(found, 'utf-8');
        } catch {
            return null;
        }
    }
    return null;
}

// Silence KafkaJS default partitioner warning (same as build-server)
process.env.KAFKAJS_NO_PARTITIONER_WARNING = '1';

let kafkaConsumer = null;

if (KAFKA_BROKER) {
    const brokers = KAFKA_BROKER.split(',').map(b => b.trim().replace(/^kafka:\/\//, ''));

    let sslConfig = true;
    const caCertContent = resolveCaCertificateContent(KAFKA_CA_CERT || KAFKA_CA_PATH);
    if (caCertContent) {
        sslConfig = { ca: [caCertContent] };
    }

    const kafkaInstance = new Kafka({
        clientId: 'api-server-log-consumer',
        brokers,
        ssl: sslConfig,
        ...(KAFKA_USERNAME && KAFKA_PASSWORD ? {
            sasl: {
                mechanism: process.env.KAFKA_SASL_MECHANISM || 'plain',
                username: KAFKA_USERNAME,
                password: KAFKA_PASSWORD
            }
        } : {})
    });

    kafkaConsumer = kafkaInstance.consumer({ groupId: 'api-server-logs-consumer' });
}

async function initKafkaConsumer() {
    if (!kafkaConsumer) {
        console.warn(`${ANSI.yellow}⚠ KAFKA_BROKER not set. Kafka consumer is disabled.${ANSI.reset}`);
        return;
    }

    try {
        await kafkaConsumer.connect();
        console.log(`${ANSI.green}✔${ANSI.reset} Kafka consumer connected`);

        await kafkaConsumer.subscribe({ topics: [KAFKA_TOPIC], fromBeginning: true });
        console.log(`${ANSI.cyan}ℹ${ANSI.reset} Kafka consumer subscribed to topic: ${KAFKA_TOPIC}`);

        await kafkaConsumer.run({
            eachBatch: async ({ batch, heartbeat, commitOffsetsIfNecessary, resolveOffset }) => {
                const messages = batch.messages;
                console.log(`${ANSI.gray}[Kafka]${ANSI.reset} Received ${messages.length} messages`);

                for (const message of messages) {
                    if (!message.value) continue;

                    let parsed;
                    try {
                        parsed = JSON.parse(message.value.toString());
                    } catch {
                        console.warn(`${ANSI.yellow}⚠ Skipping non-JSON Kafka message${ANSI.reset}`);
                        resolveOffset(message.offset);
                        continue;
                    }

                    const {
                        PROJECT_ID, project,
                        DEPLOYMENT_ID, deployment_id,
                        stage = 'build',
                        category = 'build',
                        level = 'info',
                        log = '',
                        timestamp,
                        ...rest
                    } = parsed;

                    const resolvedDeploymentId = DEPLOYMENT_ID || deployment_id || '';
                    const resolvedProjectId = PROJECT_ID || project || '';
                    const ts = timestamp || new Date().toISOString();
                    const rawMeta = Object.keys(rest).length ? JSON.stringify(rest) : '{}';

                    const logEventId = uuidv4();

                    if (clickhouseClient) {
                        try {
                            // ClickHouse DateTime64(3,'UTC') requires 'YYYY-MM-DD HH:MM:SS.mmm' — no T, no Z
                            const chTimestamp = ts.replace('T', ' ').replace(/Z$/, '').slice(0, 23);
                            await clickhouseClient.insert({
                                table: 'deployment_logs',
                                values: [{
                                    event_id: logEventId,
                                    deployment_id: resolvedDeploymentId,
                                    project_id: resolvedProjectId,
                                    stage,
                                    category,
                                    level,
                                    log: typeof log === 'string' ? log : JSON.stringify(log),
                                    timestamp: chTimestamp,
                                    raw_meta: rawMeta
                                }],
                                format: 'JSONEachRow'
                            });
                        } catch (err) {
                            console.error(`${ANSI.red}✖ ClickHouse insert error:${ANSI.reset}`, err.message);
                        }
                    }

                    // Update Deployment status in Postgres BEFORE broadcasting to Socket.io.
                    // Terminal stages (READY/FAIL) fire immediately; IN_PROGRESS is debounced per
                    // deployment to avoid exhausting the Prisma connection pool on burst logs.
                    if (resolvedDeploymentId) {
                        const isTerminal = (stage === 'ready' || level === 'ready') || (stage === 'error');
                        const nextStatus = (stage === 'ready' || level === 'ready')
                            ? 'READY'
                            : stage === 'error'
                                ? 'FAIL'
                                : ['container', 'source', 'environment', 'install', 'build', 'upload'].includes(stage)
                                    ? 'IN_PROGRESS'
                                    : null;

                        if (nextStatus) {
                            if (isTerminal) {
                                // Cancel any pending debounced IN_PROGRESS call and fire immediately
                                const pending = deploymentStatusDebounce.get(resolvedDeploymentId);
                                if (pending) {
                                    clearTimeout(pending.timer);
                                    deploymentStatusDebounce.delete(resolvedDeploymentId);
                                }
                                await updateDeploymentStatus(resolvedDeploymentId, resolvedProjectId, nextStatus);
                            } else {
                                // Debounce IN_PROGRESS: only keep highest-rank pending call per deployment
                                const pending = deploymentStatusDebounce.get(resolvedDeploymentId);
                                const nextRank = DEPLOYMENT_STATUS_RANK[nextStatus] || 0;
                                if (!pending || nextRank > pending.rank) {
                                    if (pending) clearTimeout(pending.timer);
                                    const timer = setTimeout(async () => {
                                        deploymentStatusDebounce.delete(resolvedDeploymentId);
                                        await updateDeploymentStatus(resolvedDeploymentId, resolvedProjectId, nextStatus);
                                    }, 300);
                                    deploymentStatusDebounce.set(resolvedDeploymentId, { status: nextStatus, rank: nextRank, timer });
                                }
                            }
                        }
                    }

                    // Forward real-time log to console and Socket.io clients (replacing Redis pub/sub)
                    const logPayload = {
                        event_id: logEventId,
                        project: resolvedProjectId,
                        deployment_id: resolvedDeploymentId,
                        stage,
                        category,
                        level,
                        log: typeof log === 'string' ? log : JSON.stringify(log),
                        timestamp: ts,
                        ...rest
                    };
                    handleIncomingLog(logPayload, `logs:${resolvedProjectId}`);

                    resolveOffset(message.offset);
                    await commitOffsetsIfNecessary(message.offset);
                    await heartbeat();
                }
            }
        });
    } catch (err) {
        console.error(`${ANSI.red}✖ Failed to start Kafka consumer:${ANSI.reset}`, err.message);
    }
}

/**
 * Publishes an API-generated log event (e.g. provisioning / dispatching).
 */
function publishApiLog(project, log, { stage = "provisioning", category = "container", level = "info", meta = {} } = {}) {
    const payload = {
        event_id: uuidv4(),
        project,
        log,
        stage,
        category,
        level,
        timestamp: new Date().toISOString(),
        ...meta
    };

    handleIncomingLog(payload, `logs:${project}`);
}

// Socket.io connection for frontend clients
io.on('connection', (socket) => {
    console.log(`${ANSI.gray}[WS]${ANSI.reset} Client connected: ${socket.id}`);

    // Client requests to subscribe to logs for a specific project
    socket.on('subscribe', (channelOrSlug) => {
        const projectSlug = channelOrSlug.replace('logs:', '');
        const canonicalRoom = `logs:${projectSlug}`;
        socket.join(canonicalRoom);

        console.log(`${ANSI.gray}[WS]${ANSI.reset} Socket ${socket.id} subscribed to: ${canonicalRoom}`);

        // Replay historical logs if available so initial provisioning logs are never lost
        const history = logHistory.get(projectSlug);
        if (history && history.length > 0) {
            for (const item of history) {
                socket.emit('message', JSON.stringify(item));
            }
        } else {
            socket.emit('message', JSON.stringify({
                event_id: uuidv4(),
                project: projectSlug,
                log: `Connected to log stream for ${projectSlug}`,
                level: 'info',
                stage: 'provisioning',
                category: 'container',
                timestamp: new Date().toISOString()
            }));
        }
    });

    // Client unsubscribes when leaving deployment page
    socket.on('unsubscribe', (channelOrSlug) => {
        const projectSlug = channelOrSlug.replace('logs:', '');
        const canonicalRoom = `logs:${projectSlug}`;
        socket.leave(canonicalRoom);
        console.log(`${ANSI.gray}[WS]${ANSI.reset} Socket ${socket.id} unsubscribed from: ${canonicalRoom}`);
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

// List authenticated user's projects with their deployments
app.get('/projects', async (req, res) => {
    const userId = await requireUser(req, res);
    if (!userId) return;

    try {
        const projects = await prisma.project.findMany({
            where: { ownerId: userId },
            orderBy: { createdAt: 'desc' },
            include: {
                Deployment: {
                    orderBy: { createdAt: 'desc' },
                    take: 5
                }
            }
        });

        return res.json({
            status: 'success',
            data: { projects }
        });
    } catch (error) {
        console.error(`${ANSI.red}✖ Error fetching projects:${ANSI.reset}`, error);
        return res.status(500).json({
            status: 'error',
            message: 'Failed to fetch projects',
            error: error.message
        });
    }
});

// Retrieve single project by ID (must be owned by authenticated user)
app.get('/project/:id', async (req, res) => {
    const userId = await requireUser(req, res);
    if (!userId) return;

    try {
        const { id } = req.params;

        const project = await prisma.project.findUnique({
            where: { id },
            include: {
                Deployment: {
                    orderBy: { createdAt: 'desc' }
                }
            }
        });

        if (!project) {
            return res.status(404).json({
                status: 'error',
                message: 'Project not found'
            });
        }

        if (project.ownerId !== userId) {
            return res.status(403).json({
                status: 'error',
                message: 'Forbidden: you do not have access to this project'
            });
        }

        return res.json({
            status: 'success',
            data: { project }
        });
    } catch (error) {
        console.error(`${ANSI.red}✖ Error fetching project:${ANSI.reset}`, error);
        return res.status(500).json({
            status: 'error',
            message: 'Failed to fetch project',
            error: error.message
        });
    }
});

function normalizeGithubUrl(rawUrl) {
    try {
        const parsed = new URL(String(rawUrl).trim());
        const host = parsed.hostname.toLowerCase();
        if (host !== 'github.com' && host !== 'www.github.com') {
            return null;
        }
        const segments = parsed.pathname.split('/').filter(Boolean);
        if (segments.length < 2) {
            return null;
        }
        const owner = segments[0].toLowerCase();
        const repo = segments[1].replace(/\.git$/i, '').toLowerCase();
        if (!owner || !repo) {
            return null;
        }
        return `https://github.com/${owner}/${repo}`;
    } catch {
        return null;
    }
}

// Create project in Postgres (Neon DB)
app.post('/project', async (req, res) => {
    const userId = await requireUser(req, res);
    if (!userId) return;

    try {
        const schema = z.object({
            name: z.string({ required_error: 'Project name is required' }).min(1, 'Project name is required'),
            gitURL: z.string({ required_error: 'GitHub repository URL is required' }).url('Invalid repository URL')
        });

        const safeParseResult = schema.safeParse(req.body);

        if (!safeParseResult.success) {
            return res.status(400).json({
                error: safeParseResult.error.errors
            });
        }

        const { name, gitURL } = safeParseResult.data;

        const canonicalGitURL = normalizeGithubUrl(gitURL);
        if (!canonicalGitURL) {
            return res.status(400).json({
                error: 'Please provide a valid GitHub repository URL (e.g. https://github.com/owner/repo)'
            });
        }

        // Enforce single project per GitHub repository per user across normalized variations
        const existingProjects = await prisma.project.findMany({
            where: { ownerId: userId },
            orderBy: { createdAt: 'asc' }
        });
        const duplicate = existingProjects.find((p) => {
            const normalizedExisting = normalizeGithubUrl(p.gitURL);
            return normalizedExisting
                ? normalizedExisting === canonicalGitURL
                : p.gitURL.trim().toLowerCase() === canonicalGitURL;
        });

        if (duplicate) {
            return res.status(409).json({
                status: 'error',
                message: `You already have a project ('${duplicate.name}') for this GitHub repository.`,
                data: { existingProject: duplicate }
            });
        }

        // Generate a globally unique project subdomain slug across all users
        let subDomain = generateSlug();
        for (let attempt = 0; attempt < 10; attempt++) {
            const slugTaken = await prisma.project.findFirst({
                where: { subDomain },
                select: { id: true }
            });
            if (!slugTaken) break;
            subDomain = generateSlug();
        }
        const slugStillTaken = await prisma.project.findFirst({
            where: { subDomain },
            select: { id: true }
        });
        if (slugStillTaken) {
            subDomain = `${generateSlug()}-${uuidv4().slice(0, 6)}`;
        }

        // Persist project in PostgreSQL via Neon DB
        const project = await prisma.project.create({
            data: {
                name,
                gitURL: canonicalGitURL,
                subDomain,
                ownerId: userId
            }
        });

        return res.status(201).json({
            status: 'success',
            data: { project }
        });
    } catch (error) {
        console.error(`${ANSI.red}✖ Database error creating project:${ANSI.reset}`, error);
        return res.status(500).json({
            status: 'error',
            message: 'Failed to create project in database',
            error: error.message
        });
    }
});

// Trigger a deployment for an existing project (owned by authenticated user)
app.post('/deploy', async (req, res) => {
    const userId = await requireUser(req, res);
    if (!userId) return;

    let createdDeploymentId = null;
    let projectSubDomain = '';
    let resolvedProjectUuid = null;

    try {
        const schema = z.object({
            projectId: z.string({ required_error: 'projectId is required' }).min(1, 'projectId cannot be empty')
        });

        const safeParseResult = schema.safeParse(req.body);

        if (!safeParseResult.success) {
            return res.status(400).json({
                error: safeParseResult.error.errors
            });
        }

        const { projectId } = safeParseResult.data;

        // Verify project exists in database
        const project = await prisma.project.findUnique({
            where: { id: projectId }
        });

        if (!project) {
            return res.status(404).json({
                error: 'Project not found'
            });
        }

        if (project.ownerId !== userId) {
            return res.status(403).json({
                status: 'error',
                error: 'Forbidden: you do not have access to this project'
            });
        }

        projectSubDomain = project.subDomain;
        resolvedProjectUuid = project.id;

        // Create deployment record with QUEUED status
        const deployment = await prisma.deployment.create({
            data: {
                project: { connect: { id: projectId } },
                status: 'QUEUED'
            }
        });
        createdDeploymentId = deployment.id;
        cacheDeploymentStatus(deployment.id, 'QUEUED');

        // Cloud Run Job resource name
        const jobName =
            `projects/${config.PROJECT_ID}` +
            `/locations/${config.REGION}` +
            `/jobs/${config.JOB}`;

        // 1. Log provisioning receipt
        publishApiLog(project.subDomain, `Received deployment request for project '${project.name}' (Deployment: ${deployment.id})`, {
            stage: 'provisioning',
            category: 'container',
            level: 'info'
        });

        publishApiLog(project.subDomain, `[Step 0/5] Initiating Google Cloud Run Job '${config.JOB}' in region '${config.REGION}'...`, {
            stage: 'provisioning',
            category: 'container',
            level: 'step'
        });

        // Prepare container environment variables
        const containerEnv = [
            {
                name: 'GIT_REPOSITORY_URL',
                value: project.gitURL
            },
            {
                name: 'PROJECT_ID',
                value: project.subDomain
            },
            {
                name: 'PROJECT_UUID',
                value: project.id
            },
            {
                name: 'DEPLOYMENT_ID',
                value: deployment.id
            }
        ];

        // Forward Kafka configuration to Cloud Run Job container if configured
        if (KAFKA_BROKER) {
            containerEnv.push(
                { name: 'KAFKA_BROKER', value: KAFKA_BROKER },
                { name: 'KAFKA_USERNAME', value: KAFKA_USERNAME },
                { name: 'KAFKA_PASSWORD', value: KAFKA_PASSWORD },
                { name: 'KAFKA_TOPIC', value: KAFKA_TOPIC }
            );
            if (process.env.KAFKA_SASL_MECHANISM) {
                containerEnv.push({ name: 'KAFKA_SASL_MECHANISM', value: process.env.KAFKA_SASL_MECHANISM });
            }

            // Resolve CA cert content to pass directly so Cloud Run receives PEM contents dynamically
            const caContent = resolveCaCertificateContent(KAFKA_CA_CERT || KAFKA_CA_PATH);
            if (caContent) {
                containerEnv.push(
                    { name: 'KAFKA_CA_CERT', value: caContent },
                    { name: 'KAFKA_CA_PATH', value: caContent }
                );
            }
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

        // Monitor Cloud Run Job LRO in the background as a fallback if Kafka misses final status
        if (operation && typeof operation.promise === 'function') {
            operation.promise()
                .then(async ([execution]) => {
                    const failedCount = execution?.failedCount || 0;
                    const succeededCount = execution?.succeededCount || 0;
                    if (failedCount > 0) {
                        await updateDeploymentStatus(deployment.id, project.subDomain, 'FAIL', project.id);
                    } else if (succeededCount > 0) {
                        await updateDeploymentStatus(deployment.id, project.subDomain, 'READY', project.id);
                    }
                })
                .catch(async (execErr) => {
                    console.error(`${ANSI.red}✖ Cloud Run Job execution error (${deployment.id}):${ANSI.reset}`, execErr?.message || execErr);
                    await updateDeploymentStatus(deployment.id, project.subDomain, 'FAIL', project.id);
                });
        }

        // 2. Log successful dispatch
        publishApiLog(project.subDomain, `Cloud Run Job container dispatched. Waiting for build worker to boot...`, {
            stage: 'provisioning',
            category: 'container',
            level: 'info'
        });

        return res.status(202).json({
            status: 'queued',
            message: 'Deployment queued and container dispatched successfully',
            data: {
                deploymentId: deployment.id,
                projectId: project.id,
                subDomain: project.subDomain,
                url: `http://${project.subDomain}.localhost:8000`
            }
        });

    } catch (error) {
        console.error(`${ANSI.red}✖ Deployment error:${ANSI.reset}`, error);

        if (createdDeploymentId) {
            await updateDeploymentStatus(createdDeploymentId, projectSubDomain, 'FAIL', resolvedProjectUuid);
        }

        return res.status(500).json({
            status: 'error',
            message: 'Failed to dispatch deployment',
            error: error.message
        });
    }
});

// Retrieve single deployment by ID (must belong to authenticated user's project)
app.get('/deployment/:id', async (req, res) => {
    const userId = await requireUser(req, res);
    if (!userId) return;

    try {
        const { id } = req.params;

        const deployment = await prisma.deployment.findUnique({
            where: { id },
            include: {
                project: true
            }
        });

        if (!deployment) {
            return res.status(404).json({
                status: 'error',
                message: 'Deployment not found'
            });
        }

        if (!deployment.project || deployment.project.ownerId !== userId) {
            return res.status(403).json({
                status: 'error',
                message: 'Forbidden: you do not have access to this deployment'
            });
        }

        return res.json({
            status: 'success',
            data: { deployment }
        });
    } catch (error) {
        console.error(`${ANSI.red}✖ Error fetching deployment:${ANSI.reset}`, error);
        return res.status(500).json({
            status: 'error',
            message: 'Failed to fetch deployment',
            error: error.message
        });
    }
});

// Retrieve log history for a project (public SSE / in-memory stream by random slug)
app.get('/project/:slug/logs', (req, res) => {
    const { slug } = req.params;
    const logs = logHistory.get(slug) || [];
    res.json({
        project: slug,
        total: logs.length,
        logs
    });
});

// Query deployment logs from ClickHouse data warehouse (must belong to authenticated user's project)
app.get('/logs/:id', async (req, res) => {
    const userId = await requireUser(req, res);
    if (!userId) return;

    try {
        const id = req.params.id;
        const limit = Number(req.query.limit) || 1000;

        const deployment = await prisma.deployment.findUnique({
            where: { id },
            include: {
                project: {
                    select: { ownerId: true }
                }
            }
        });

        if (!deployment) {
            return res.status(404).json({
                status: 'error',
                message: 'Deployment not found'
            });
        }

        if (!deployment.project || deployment.project.ownerId !== userId) {
            return res.status(403).json({
                status: 'error',
                message: 'Forbidden: you do not have access to these logs'
            });
        }

        if (!clickhouseClient) {
            return res.status(503).json({
                status: 'error',
                message: 'ClickHouse client is not configured on this server'
            });
        }

        const resultSet = await clickhouseClient.query({
            query: `
                SELECT event_id, deployment_id, project_id, stage, category, level, log, timestamp
                FROM deployment_logs
                WHERE deployment_id = {deployment_id: String}
                ORDER BY timestamp ASC
                LIMIT {limit: UInt32}
            `,
            query_params: { deployment_id: id, limit },
            format: 'JSONEachRow'
        });

        const logs = await resultSet.json();

        return res.json({
            status: 'success',
            deploymentId: id,
            total: logs.length,
            logs
        });
    } catch (error) {
        console.error(`${ANSI.red}✖ ClickHouse query error:${ANSI.reset}`, error.message);
        return res.status(500).json({
            status: 'error',
            message: 'Failed to fetch logs from ClickHouse',
            error: error.message
        });
    }
});

// Graceful shutdown handling
const gracefulShutdown = async (signal) => {
    console.log(`\n${ANSI.yellow}Received ${signal}. Shutting down API server gracefully...${ANSI.reset}`);
    try {
        await prisma.$disconnect();
        if (kafkaConsumer) await kafkaConsumer.disconnect();
        if (clickhouseClient) await clickhouseClient.close();
    } catch (err) {
        console.error('Error during shutdown cleanup:', err);
    }
    process.exit(0);
};

process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

// Boot the Kafka consumer (non-blocking)
initKafkaConsumer().catch(err => {
    console.error(`${ANSI.red}✖ Kafka consumer failed to start:${ANSI.reset}`, err.message);
});

// Start server
const PORT = process.env.PORT || 9000;

server.listen(PORT, () => {
    console.log(`${ANSI.green}🚀 Tiny Vercel API running on port ${PORT}${ANSI.reset}`);
});
