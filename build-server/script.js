const { spawn } = require("child_process");
const path = require("path");
const fs = require("fs");
const {
    S3Client,
    PutObjectCommand
} = require("@aws-sdk/client-s3");
const mime = require("mime-types");
const Redis = require("ioredis");

const PROJECT_ID = process.env.PROJECT_ID;
const OUTPUT_DIR = process.env.OUTPUT_DIR || "dist";

// Aiven Valkey / Redis connection URL from environment (left empty by default)
const REDIS_URL = process.env.REDIS_URL || "";

// Initialize Redis publisher
const publisher = new Redis(REDIS_URL);

publisher.on("error", (err) => {
    console.error("Redis publisher error:", err.message);
});

// Channel name based on the project slug
const CHANNEL_NAME = process.env.REDIS_CHANNEL || `logs:${PROJECT_ID}`;

function publishLog(log) {
    const logStr = typeof log === "string" ? log : JSON.stringify(log);
    console.log(logStr);

    try {
        const payload = JSON.stringify({ log: logStr, project: PROJECT_ID });
        publisher.publish(CHANNEL_NAME, payload);

        // Also publish directly to project slug if different from CHANNEL_NAME
        if (PROJECT_ID && CHANNEL_NAME !== PROJECT_ID) {
            publisher.publish(PROJECT_ID, payload);
        }
    } catch (err) {
        console.error("Failed to publish log:", err.message);
    }
}

const requiredEnv = [
    "CLOUDFLARE_ACCOUNT_ID",
    "R2_ACCESS_KEY_ID",
    "R2_SECRET_ACCESS_KEY",
    "PROJECT_ID"
];

for (const key of requiredEnv) {
    if (!process.env[key]) {
        throw new Error(`Missing environment variable: ${key}`);
    }
}

const s3Client = new S3Client({
    region: "auto",
    endpoint: `https://${process.env.CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY
    }
});

function run(command, args, options = {}) {
    return new Promise((resolve, reject) => {
        publishLog(`Running: ${command} ${args.join(" ")}`);

        const child = spawn(command, args, {
            ...options,
            shell: true
        });

        child.stdout.on("data", (data) => {
            const lines = data.toString().trim().split("\n");
            for (const line of lines) {
                if (line) publishLog(line);
            }
        });

        child.stderr.on("data", (data) => {
            const lines = data.toString().trim().split("\n");
            for (const line of lines) {
                if (line) publishLog(`[stderr] ${line}`);
            }
        });

        child.on("error", (err) => {
            publishLog(`Command failed to start: ${err.message}`);
            reject(err);
        });

        child.on("close", (code) => {
            if (code !== 0) {
                const err = new Error(`${command} exited with code ${code}`);
                publishLog(`Error: ${err.message}`);
                reject(err);
            } else {
                resolve();
            }
        });
    });
}

function getAllFiles(dir) {
    let files = [];

    for (const entry of fs.readdirSync(dir, {
        withFileTypes: true
    })) {
        const fullPath = path.join(dir, entry.name);

        if (entry.isDirectory()) {
            files.push(...getAllFiles(fullPath));
        } else if (entry.isFile()) {
            files.push(fullPath);
        }
    }

    return files;
}

async function uploadFiles(distPath) {
    if (!fs.existsSync(distPath)) {
        throw new Error(`Output directory not found: ${distPath}`);
    }

    const files = getAllFiles(distPath);

    if (files.length === 0) {
        throw new Error("Build output directory is empty");
    }

    publishLog(`Uploading ${files.length} files to R2...`);

    for (const filePath of files) {
        const relativePath = path.relative(distPath, filePath)
            .split(path.sep)
            .join("/");

        const key = `__outputs/${PROJECT_ID}/${relativePath}`;

        publishLog(`Uploading: ${relativePath}`);

        await s3Client.send(new PutObjectCommand({
            Bucket: "tiny-vercel",
            Key: key,
            Body: fs.createReadStream(filePath),
            ContentType: mime.lookup(filePath) || "application/octet-stream"
        }));

        publishLog(`Uploaded: ${relativePath}`);
    }
}

async function main() {
    publishLog("================================");
    publishLog("Tiny Vercel Build Worker Started");
    publishLog(`Project: ${PROJECT_ID}`);
    publishLog("================================");

    // The repo is cloned and built by main.sh before this script runs
    const projectPath = path.join(__dirname, "output");

    // Upload generated files
    const distPath = path.resolve(projectPath, OUTPUT_DIR);

    await uploadFiles(distPath);

    publishLog("================================");
    publishLog("Deployment completed successfully");
    publishLog("================================");

    try {
        await publisher.quit();
    } catch {
        publisher.disconnect();
    }
}

main().catch(async (error) => {
    console.error("BUILD FAILED:", error);
    try {
        publishLog(`BUILD FAILED: ${error.message || error}`);
        await publisher.quit();
    } catch {
        publisher.disconnect();
    }
    process.exit(1);
});
