const { generateSlug } = require('random-word-slugs')
require('dotenv').config();
const express = require('express');
const crypto = require('crypto');
const { JobsClient } = require('@google-cloud/run').v2;

const app = express();
app.use(express.json());

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

        // Trigger Cloud Run Job
        const [operation] = await runClient.runJob({
            name: jobName,

            overrides: {
                containerOverrides: [
                    {
                        name: 'builder-image',
                        env: [
                            {
                                name: 'GIT_REPOSITORY_URL',
                                value: gitURL
                            },
                            {
                                name: 'PROJECT_ID',
                                value: projectSlug
                            }
                        ]
                    }
                ]
            }
        });

        console.log(`Build execution submitted for ${projectSlug} try out at http://${projectSlug}.localhost:8000 after deployment completion`);

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

app.listen(PORT, () => {
    console.log(`Tiny Vercel API running on port ${PORT}`);
});
