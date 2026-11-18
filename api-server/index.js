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

// Redis subscriber setup (Aiven Valkey / Redis)
const REDIS_URL = process.env.REDIS_URL || "";
let subscriber = null;

if (REDIS_URL) {
    subscriber = new Redis(REDIS_URL);

    subscriber.on('connect', () => {
        console.log('Connected to Redis/Valkey subscriber successfully');
    });

    subscriber.on('error', (err) => {
        console.error('Redis subscriber error:', err.message);
    });

    // Pattern subscribe to all project logs
    subscriber.psubscribe('logs:*', (err, count) => {
        if (err) {
            console.error('Failed to subscribe to logs pattern:', err.message);
        } else {
            console.log(`Subscribed to Redis logs pattern: logs:* (active subscriptions: ${count})`);
        }
    });

    // Handle incoming messages on matching pattern
    subscriber.on('pmessage', (pattern, channel, message) => {
        try {
            const parsed = JSON.parse(message);
            const logContent = parsed.log || message;
            const projectSlug = parsed.project || channel.replace('logs:', '');

            // 1. Live logs displayed in terminal of API server
            console.log(`[BUILD LOG | ${projectSlug}] ${logContent}`);

            // 2. Broadcast to Socket.io rooms (for frontend consumption)
            io.to(channel).emit('message', message);
            io.to(projectSlug).emit('message', message);
        } catch {
            console.log(`[BUILD LOG | ${channel}] ${message}`);
            io.to(channel).emit('message', message);
        }
    });
} else {
    console.warn('REDIS_URL not set. Redis subscriber is disabled.');
}

// Socket.io connection for frontend clients
io.on('connection', (socket) => {
    console.log(`WebSocket client connected: ${socket.id}`);

    // Client requests to subscribe to logs for a specific project
    socket.on('subscribe', (channelOrSlug) => {
        socket.join(channelOrSlug);
        // Also join the prefixed channel name if slug was provided
        if (!channelOrSlug.startsWith('logs:')) {
            socket.join(`logs:${channelOrSlug}`);
        }
        console.log(`Client ${socket.id} joined room for: ${channelOrSlug}`);
        socket.emit('message', JSON.stringify({ log: `Connected to log stream for ${channelOrSlug}` }));
    });

    socket.on('disconnect', () => {
        console.log(`WebSocket client disconnected: ${socket.id}`);
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

        console.log(`Creating project: ${projectSlug}`);
        console.log(`Repository: ${gitURL}`);

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

        console.log(`Build execution submitted for ${projectSlug}. Try out at http://${projectSlug}.localhost:8000 after deployment completion`);

        return res.status(202).json({
            status: 'queued',
            message: 'Project build started successfully',
            data: {
                projectSlug,
                url: `http://${projectSlug}.localhost:8000`
            }
        });

    } catch (error) {
        console.error('Cloud Run error:', error);

        return res.status(500).json({
            status: 'error',
            message: 'Failed to start project build'
        });
    }
});

// Start server
const PORT = process.env.PORT || 9000;

server.listen(PORT, () => {
    console.log(`Tiny Vercel API running on port ${PORT}`);
});
