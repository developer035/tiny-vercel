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

function formatBytes(bytes) {
    if (!bytes || bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
}

function publishLog(log, { level = "info", stage = "build", meta = {} } = {}) {
    const logStr = typeof log === "string" ? log : JSON.stringify(log);
    console.log(logStr);

    try {
        const payload = JSON.stringify({
            project: PROJECT_ID,
            log: logStr,
            level,
            stage,
            timestamp: new Date().toISOString(),
            ...meta
        });

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
        publishLog(`Running: ${command} ${args.join(" ")}`, { level: "cmd", stage: "build" });

        const child = spawn(command, args, {
            ...options,
            shell: true
        });

        child.stdout.on("data", (data) => {
            const lines = data.toString().trim().split("\n");
            for (const line of lines) {
                if (line) publishLog(line, { level: "info", stage: "build" });
            }
        });

        child.stderr.on("data", (data) => {
            const lines = data.toString().trim().split("\n");
            for (const line of lines) {
                if (line) publishLog(line, { level: "warn", stage: "build" });
            }
        });

        child.on("error", (err) => {
            publishLog(`Command failed to start: ${err.message}`, { level: "error", stage: "build" });
            reject(err);
        });

        child.on("close", (code) => {
            if (code !== 0) {
                const err = new Error(`${command} exited with code ${code}`);
                publishLog(`Error: ${err.message}`, { level: "error", stage: "build" });
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

    publishLog(`[Step 2/2] Synchronizing assets to Cloudflare R2 (${files.length} files detected)...`, {
        level: "step",
        stage: "upload",
        meta: { totalFiles: files.length }
    });

    let uploadedCount = 0;

    for (const filePath of files) {
        uploadedCount++;
        const relativePath = path.relative(distPath, filePath)
            .split(path.sep)
            .join("/");

        const key = `__outputs/${PROJECT_ID}/${relativePath}`;
        const fileStats = fs.statSync(filePath);
        const fileSizeFormatted = formatBytes(fileStats.size);

        await s3Client.send(new PutObjectCommand({
            Bucket: "tiny-vercel",
            Key: key,
            Body: fs.createReadStream(filePath),
            ContentType: mime.lookup(filePath) || "application/octet-stream"
        }));

        publishLog(`[${uploadedCount}/${files.length}] Uploaded: ${relativePath} (${fileSizeFormatted})`, {
            level: "upload",
            stage: "upload",
            meta: {
                current: uploadedCount,
                total: files.length,
                file: relativePath,
                size: fileStats.size
            }
        });
    }
}

async function main() {
    publishLog("┌────────────────────────────────────────────────────────────┐", { level: "step", stage: "init" });
    publishLog("│               TINY VERCEL BUILD WORKER                     │", { level: "step", stage: "init" });
    publishLog(`│  Project  : ${PROJECT_ID.padEnd(46)} │`, { level: "info", stage: "init" });
    publishLog(`│  Output   : ${OUTPUT_DIR.padEnd(46)} │`, { level: "info", stage: "init" });
    publishLog(`│  Started  : ${new Date().toISOString().padEnd(46)} │`, { level: "info", stage: "init" });
    publishLog("└────────────────────────────────────────────────────────────┘", { level: "step", stage: "init" });

    const projectPath = path.join(__dirname, "output");
    const distPath = path.resolve(projectPath, OUTPUT_DIR);

    publishLog(`[Step 1/2] Verifying build output directory: ${OUTPUT_DIR}`, {
        level: "step",
        stage: "build"
    });

    // Upload generated files
    await uploadFiles(distPath);

    const deploymentUrl = `http://${PROJECT_ID}.localhost:8000`;
    publishLog("┌────────────────────────────────────────────────────────────┐", { level: "ready", stage: "ready" });
    publishLog("│                  DEPLOYMENT SUCCESSFUL                     │", { level: "ready", stage: "ready" });
    publishLog(`│  Target URL: ${deploymentUrl.padEnd(45)} │`, { level: "ready", stage: "ready" });
    publishLog("└────────────────────────────────────────────────────────────┘", { level: "ready", stage: "ready" });

    try {
        await publisher.quit();
    } catch {
        publisher.disconnect();
    }
}

main().catch(async (error) => {
    const errorMsg = error.message || String(error);
    console.error("BUILD FAILED:", error);

    try {
        publishLog("┌────────────────────────────────────────────────────────────┐", { level: "error", stage: "error" });
        publishLog("│                     BUILD / DEPLOY FAILED                  │", { level: "error", stage: "error" });
        publishLog(`│  Error: ${errorMsg.slice(0, 50).padEnd(50)} │`, { level: "error", stage: "error" });
        publishLog("└────────────────────────────────────────────────────────────┘", { level: "error", stage: "error" });
        await publisher.quit();
    } catch {
        publisher.disconnect();
    }

    process.exit(1);
});
