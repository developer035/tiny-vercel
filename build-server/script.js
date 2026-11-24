const { spawn } = require("child_process");
const path = require("path");
const fs = require("fs");
const os = require("os");
const {
    S3Client,
    PutObjectCommand
} = require("@aws-sdk/client-s3");
const mime = require("mime-types");
const { Kafka } = require("kafkajs");

const workerStartTime = Date.now();
const PROJECT_ID = process.env.PROJECT_ID;
const DEPLOYMENT_ID = process.env.DEPLOYMENT_ID || "";
const GIT_REPOSITORY_URL = process.env.GIT_REPOSITORY_URL;

// Aiven Apache Kafka configuration from environment variables
const KAFKA_BROKER = process.env.KAFKA_BROKER;
const KAFKA_USERNAME = process.env.KAFKA_USERNAME;
const KAFKA_PASSWORD = process.env.KAFKA_PASSWORD;
const KAFKA_CA_CERT = process.env.KAFKA_CA_CERT || process.env.KAFKA_CA_CONTENT || process.env.KAFKA_CA_PEM;
const KAFKA_CA_PATH = process.env.KAFKA_CA_PATH;
const TOPIC_NAME = process.env.KAFKA_TOPIC || "container-logs";

// Helper to resolve CA certificate content from env variable or file path
function resolveCaCertificateContent(input) {
    const raw = input || KAFKA_CA_CERT || KAFKA_CA_PATH;
    if (!raw) {
        const defaultPaths = [
            "/home/app/kafka.pem",
            "/home/app/kafca_ca.pem",
            "/home/app/Kafka_Ca.pem",
            path.resolve(__dirname, "kafka.pem"),
            path.resolve(__dirname, "kafca_ca.pem"),
            path.resolve(__dirname, "Kafka_Ca.pem")
        ];
        const found = defaultPaths.find(p => fs.existsSync(p));
        if (found) {
            try {
                return fs.readFileSync(found, "utf-8");
            } catch {
                return null;
            }
        }
        return null;
    }

    let trimmed = raw.trim();
    if (trimmed.includes("\\n")) {
        trimmed = trimmed.replace(/\\n/g, "\n");
    }

    if (trimmed.includes("BEGIN CERTIFICATE")) {
        return trimmed;
    }

    const candidatePaths = [
        trimmed,
        path.resolve(trimmed),
        path.resolve(__dirname, trimmed),
        path.resolve(__dirname, path.basename(trimmed)),
        "/home/app/kafka.pem",
        "/home/app/kafca_ca.pem",
        "/home/app/Kafka_Ca.pem"
    ];
    const found = candidatePaths.find(p => fs.existsSync(p));
    if (found) {
        try {
            return fs.readFileSync(found, "utf-8");
        } catch {
            return null;
        }
    }
    return null;
}

// Silence KafkaJS default partitioner warning
process.env.KAFKAJS_NO_PARTITIONER_WARNING = "1";

// Initialize Kafka client and producer
let kafka = null;
let producer = null;

if (KAFKA_BROKER) {
    const brokers = KAFKA_BROKER.split(",").map(b => b.trim().replace(/^kafka:\/\//, ""));

    let sslConfig = true;
    const caContent = resolveCaCertificateContent();
    if (caContent) {
        sslConfig = { ca: [caContent] };
    }

    const kafkaConfig = {
        clientId: `build-server-${DEPLOYMENT_ID || PROJECT_ID || "worker"}`,
        brokers,
        ssl: sslConfig
    };

    if (KAFKA_USERNAME && KAFKA_PASSWORD) {
        kafkaConfig.sasl = {
            mechanism: process.env.KAFKA_SASL_MECHANISM || "plain",
            username: KAFKA_USERNAME,
            password: KAFKA_PASSWORD
        };
    }

    kafka = new Kafka(kafkaConfig);
    producer = kafka.producer();
}

function formatBytes(bytes) {
    if (!bytes || bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
}

function publishLog(log, { stage = "build", category = "build", level = "info", meta = {} } = {}) {
    const logStr = typeof log === "string" ? log : JSON.stringify(log);
    console.log(logStr);

    if (!producer || !PROJECT_ID) return;

    try {
        const payload = JSON.stringify({
            PROJECT_ID,
            project: PROJECT_ID,
            ...(DEPLOYMENT_ID ? { DEPLOYMENT_ID, deployment_id: DEPLOYMENT_ID } : {}),
            stage,
            category,
            level,
            log: logStr,
            timestamp: new Date().toISOString(),
            ...meta
        });

        return producer.send({
            topic: TOPIC_NAME,
            messages: [
                {
                    key: `message-${Date.now()}`,
                    value: payload
                }
            ]
        }).catch((err) => {
            console.error("Failed to publish log to Kafka:", err.message);
        });
    } catch (err) {
        console.error("Failed to publish log:", err.message);
    }
}

// Graceful signal handling
const handleShutdown = async (signal) => {
    publishLog(`Received ${signal}. Shutting down build worker container...`, {
        stage: "container",
        category: "container",
        level: "warn"
    });
    if (producer) {
        try {
            await producer.disconnect();
        } catch (err) {
            console.error("Error disconnecting Kafka producer:", err.message);
        }
    }
    process.exit(143);
};
process.on("SIGTERM", () => handleShutdown("SIGTERM"));
process.on("SIGINT", () => handleShutdown("SIGINT"));

/**
 * Spawns a shell command in bash, ensuring FNM environment is loaded,
 * and streams stdout & stderr line-by-line to Kafka in real time.
 */
function runStreamingCommand(command, { cwd = "/home/app", stage = "build", category = "build", extraEnv = {}, nodeVersion = null } = {}) {
    return new Promise((resolve, reject) => {
        const startTime = Date.now();

        // Ensure FNM and bash environment are loaded for every child command
        const fnmHeader = 'export FNM_DIR="/usr/local/fnm"; export PATH="/usr/local/fnm:$PATH"; eval "$(fnm env --shell bash)" >/dev/null 2>&1 || true;';
        const nodeSwitch = nodeVersion ? `fnm use "${nodeVersion}" >/dev/null 2>&1 || true;` : "";
        const fullScript = `${fnmHeader} ${nodeSwitch} ${command}`;

        publishLog(`⚡ ${command}`, { stage, category, level: "cmd" });

        const child = spawn("/bin/bash", ["-c", fullScript], {
            cwd,
            env: {
                ...process.env,
                ...extraEnv,
                FNM_DIR: "/usr/local/fnm",
                PATH: `/usr/local/fnm:/usr/local/fnm/aliases/default/bin:${process.env.PATH || ""}`,
                CI: "true",
                FORCE_COLOR: "1"
            }
        });

        let stdoutBuffer = "";
        child.stdout.on("data", (data) => {
            stdoutBuffer += data.toString();
            const lines = stdoutBuffer.split("\n");
            stdoutBuffer = lines.pop(); // keep last partial line in buffer

            for (const rawLine of lines) {
                const line = rawLine.trimEnd();
                if (line) {
                    publishLog(line, { stage, category, level: "stdout" });
                }
            }
        });

        let stderrBuffer = "";
        child.stderr.on("data", (data) => {
            stderrBuffer += data.toString();
            const lines = stderrBuffer.split("\n");
            stderrBuffer = lines.pop();

            for (const rawLine of lines) {
                const line = rawLine.trimEnd();
                if (line) {
                    // Git progress / info messages are typically output to stderr
                    const isInfoProgress = stage === "source" || line.startsWith("Cloning into") || line.startsWith("Resolving") || line.startsWith("Receiving");
                    publishLog(line, {
                        stage,
                        category,
                        level: isInfoProgress ? "info" : "stderr"
                    });
                }
            }
        });

        child.on("error", (err) => {
            publishLog(`Command failed to start: ${err.message}`, { stage, category, level: "error" });
            reject(err);
        });

        child.on("close", (code) => {
            // Flush any remaining buffered lines
            if (stdoutBuffer.trim()) {
                publishLog(stdoutBuffer.trim(), { stage, category, level: "stdout" });
            }
            if (stderrBuffer.trim()) {
                const isInfoProgress = stage === "source";
                publishLog(stderrBuffer.trim(), { stage, category, level: isInfoProgress ? "info" : "stderr" });
            }

            const durationMs = Date.now() - startTime;
            if (code !== 0) {
                const err = new Error(`Command '${command}' exited with code ${code}`);
                err.code = code;
                err.durationMs = durationMs;
                reject(err);
            } else {
                resolve({ durationMs, code });
            }
        });
    });
}

function getAllFiles(dir) {
    let files = [];
    if (!fs.existsSync(dir)) return files;

    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            files.push(...getAllFiles(fullPath));
        } else if (entry.isFile()) {
            files.push(fullPath);
        }
    }
    return files;
}

async function uploadFiles(s3Client, distPath) {
    if (!fs.existsSync(distPath)) {
        throw new Error(`Output directory not found: ${distPath}`);
    }

    const files = getAllFiles(distPath);
    if (files.length === 0) {
        throw new Error(`Build output directory '${distPath}' is empty`);
    }

    let totalBytes = 0;
    for (const filePath of files) {
        totalBytes += fs.statSync(filePath).size;
    }

    publishLog(`[Step 5/5] Deploying build artifacts to Cloudflare R2...`, {
        level: "step",
        stage: "upload",
        category: "storage"
    });

    publishLog(`Synchronizing ${files.length} files (${formatBytes(totalBytes)}) to storage...`, {
        level: "info",
        stage: "upload",
        category: "storage",
        meta: { totalFiles: files.length, totalBytes }
    });

    const uploadStart = Date.now();
    let uploadedCount = 0;

    for (const filePath of files) {
        uploadedCount++;
        const relativePath = path.relative(distPath, filePath).split(path.sep).join("/");
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
            category: "storage",
            meta: {
                current: uploadedCount,
                total: files.length,
                file: relativePath,
                size: fileStats.size
            }
        });
    }

    const uploadDuration = ((Date.now() - uploadStart) / 1000).toFixed(1);
    publishLog(`✔ Successfully uploaded ${files.length} files (${formatBytes(totalBytes)}) in ${uploadDuration}s`, {
        level: "info",
        stage: "upload",
        category: "storage"
    });

    return { totalFiles: files.length, totalBytes };
}

async function init() {
    // Connect to Kafka producer
    if (producer) {
        try {
            await producer.connect();
            console.log("✔ Connected to Kafka producer successfully");
        } catch (err) {
            console.error("Failed to connect to Kafka producer:", err.message);
            producer = null;
        }
    }

    // Validate required environment variables
    const requiredEnv = [
        "CLOUDFLARE_ACCOUNT_ID",
        "R2_ACCESS_KEY_ID",
        "R2_SECRET_ACCESS_KEY",
        "PROJECT_ID",
        "GIT_REPOSITORY_URL"
    ];

    for (const key of requiredEnv) {
        if (!process.env[key]) {
            throw new Error(`Missing required environment variable: ${key}`);
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

    // =========================================================================
    // PHASE 1: Container Startup & Initialization
    // =========================================================================
    publishLog("┌────────────────────────────────────────────────────────────┐", { level: "step", stage: "container", category: "container" });
    publishLog("│               TINY VERCEL BUILD WORKER                     │", { level: "step", stage: "container", category: "container" });
    publishLog(`│  Project  : ${PROJECT_ID.padEnd(46)} │`, { level: "info", stage: "container", category: "container" });
    publishLog(`│  Platform : ${(os.type() + " " + os.arch()).padEnd(46)} │`, { level: "info", stage: "container", category: "container" });
    publishLog(`│  Runtime  : ${("Node " + process.version).padEnd(46)} │`, { level: "info", stage: "container", category: "container" });
    publishLog(`│  Started  : ${new Date().toISOString().padEnd(46)} │`, { level: "info", stage: "container", category: "container" });
    publishLog("└────────────────────────────────────────────────────────────┘", { level: "step", stage: "container", category: "container" });

    publishLog("Build worker container active. Initializing build environment...", {
        level: "info",
        stage: "container",
        category: "container"
    });

    const repoPath = path.join(__dirname, "output");

    // =========================================================================
    // PHASE 2: Source Code Retrieval (Git Clone)
    // =========================================================================
    publishLog(`[Step 1/5] Cloning repository: ${GIT_REPOSITORY_URL}...`, {
        level: "step",
        stage: "source",
        category: "git"
    });

    // Remove any leftover output directory from previous executions
    if (fs.existsSync(repoPath)) {
        fs.rmSync(repoPath, { recursive: true, force: true });
    }

    const cloneRes = await runStreamingCommand(`git clone --depth 1 "${GIT_REPOSITORY_URL}" "${repoPath}"`, {
        cwd: __dirname,
        stage: "source",
        category: "git"
    });

    let commitSummary = "latest commit";
    try {
        const { stdout } = require("child_process").spawnSync("git", ["log", "-1", "--oneline"], {
            cwd: repoPath,
            encoding: "utf-8"
        });
        if (stdout && stdout.trim()) {
            commitSummary = stdout.trim();
        }
    } catch {
        // non-critical if git log fails
    }

    publishLog(`✔ Cloned repository in ${(cloneRes.durationMs / 1000).toFixed(1)}s (HEAD: ${commitSummary})`, {
        level: "info",
        stage: "source",
        category: "git"
    });

    // =========================================================================
    // PHASE 3: Environment & Runtime Setup (FNM, Node.js, Corepack, Package Manager)
    // =========================================================================
    publishLog(`[Step 2/5] Setting up Node.js runtime and package manager...`, {
        level: "step",
        stage: "environment",
        category: "runtime"
    });

    // Determine target Node version: env var -> .nvmrc -> .node-version -> default 20
    let targetNodeVersion = "20";
    let nodeSource = "default (20)";

    if (process.env.NODE_VERSION) {
        targetNodeVersion = process.env.NODE_VERSION.trim();
        nodeSource = `environment variable ($NODE_VERSION=${targetNodeVersion})`;
    } else {
        const nvmrcPath = path.join(repoPath, ".nvmrc");
        const nodeVersionPath = path.join(repoPath, ".node-version");

        if (fs.existsSync(nvmrcPath)) {
            const raw = fs.readFileSync(nvmrcPath, "utf-8").trim();
            if (raw) {
                targetNodeVersion = raw.replace(/^v/, "");
                nodeSource = `.nvmrc (${targetNodeVersion})`;
            }
        } else if (fs.existsSync(nodeVersionPath)) {
            const raw = fs.readFileSync(nodeVersionPath, "utf-8").trim();
            if (raw) {
                targetNodeVersion = raw.replace(/^v/, "");
                nodeSource = `.node-version (${targetNodeVersion})`;
            }
        }
    }

    publishLog(`Configuring Node.js runtime via ${nodeSource}...`, {
        level: "info",
        stage: "environment",
        category: "runtime"
    });

    // Install and switch to target Node version using FNM
    await runStreamingCommand(`fnm install "${targetNodeVersion}" && fnm use "${targetNodeVersion}"`, {
        cwd: repoPath,
        stage: "environment",
        category: "runtime"
    });

    // Verify active Node and npm versions
    try {
        const verCheck = require("child_process").spawnSync("/bin/bash", [
            "-c",
            `export FNM_DIR="/usr/local/fnm"; export PATH="/usr/local/fnm:$PATH"; eval "$(fnm env --shell bash)"; fnm use "${targetNodeVersion}" >/dev/null 2>&1 || true; echo -n "Node: $(node -v), NPM: $(npm -v)"`
        ], { cwd: repoPath, encoding: "utf-8" });

        if (verCheck.stdout && verCheck.stdout.trim()) {
            publishLog(`Active runtime: ${verCheck.stdout.trim()}`, {
                level: "info",
                stage: "environment",
                category: "runtime"
            });
        }
    } catch {
        // fallback
    }

    // Enable Corepack for Yarn and PNPM support
    await runStreamingCommand(`if ! command -v corepack >/dev/null 2>&1; then npm install -g corepack; fi && corepack enable`, {
        cwd: repoPath,
        stage: "environment",
        category: "runtime"
    });

    // Detect Package Manager & set default install / build commands
    let PM = "npm";
    let defaultInstall = "npm install";
    let defaultBuild = "npm run build";

    if (fs.existsSync(path.join(repoPath, "pnpm-lock.yaml"))) {
        PM = "pnpm";
        defaultInstall = "pnpm install --frozen-lockfile || pnpm install --no-frozen-lockfile";
        defaultBuild = "pnpm run build";
    } else if (fs.existsSync(path.join(repoPath, "yarn.lock"))) {
        PM = "yarn";
        defaultInstall = "yarn install --frozen-lockfile || yarn install";
        defaultBuild = "yarn build";
    } else if (fs.existsSync(path.join(repoPath, "package-lock.json"))) {
        PM = "npm";
        defaultInstall = "npm ci || npm install";
        defaultBuild = "npm run build";
    }

    const installCmd = process.env.INSTALL_COMMAND || defaultInstall;
    const buildCmd = process.env.BUILD_COMMAND || defaultBuild;

    publishLog(`Detected package manager: ${PM}`, {
        level: "info",
        stage: "environment",
        category: "dependencies"
    });
    publishLog(`Resolved install command: ${installCmd}`, {
        level: "info",
        stage: "environment",
        category: "dependencies"
    });
    publishLog(`Resolved build command: ${buildCmd}`, {
        level: "info",
        stage: "environment",
        category: "dependencies"
    });

    // =========================================================================
    // PHASE 4: Dependency Installation
    // =========================================================================
    publishLog(`[Step 3/5] Installing project dependencies using ${PM}...`, {
        level: "step",
        stage: "install",
        category: "dependencies"
    });

    const installRes = await runStreamingCommand(installCmd, {
        cwd: repoPath,
        stage: "install",
        category: "dependencies",
        nodeVersion: targetNodeVersion
    });

    publishLog(`✔ Dependencies installed in ${(installRes.durationMs / 1000).toFixed(1)}s`, {
        level: "info",
        stage: "install",
        category: "dependencies"
    });

    // =========================================================================
    // PHASE 5: Project Build Execution
    // =========================================================================
    publishLog(`[Step 4/5] Building project...`, {
        level: "step",
        stage: "build",
        category: "build"
    });

    let buildRes;
    try {
        buildRes = await runStreamingCommand(buildCmd, {
            cwd: repoPath,
            stage: "build",
            category: "build",
            nodeVersion: targetNodeVersion
        });
    } catch (buildError) {
        publishLog(`Build failed, retrying with legacy OpenSSL provider (--openssl-legacy-provider)...`, {
            level: "warn",
            stage: "build",
            category: "build"
        });

        // Retry with NODE_OPTIONS="--openssl-legacy-provider" for older webpack/crypto projects
        buildRes = await runStreamingCommand(buildCmd, {
            cwd: repoPath,
            stage: "build",
            category: "build",
            nodeVersion: targetNodeVersion,
            extraEnv: {
                NODE_OPTIONS: "--openssl-legacy-provider"
            }
        });
    }

    publishLog(`✔ Build completed in ${(buildRes.durationMs / 1000).toFixed(1)}s`, {
        level: "info",
        stage: "build",
        category: "build"
    });

    // Determine output directory
    let detectedOutputDir = process.env.OUTPUT_DIR;
    if (!detectedOutputDir) {
        for (const candidate of ["dist", "build", "out", "public"]) {
            if (fs.existsSync(path.join(repoPath, candidate))) {
                detectedOutputDir = candidate;
                break;
            }
        }
    }

    // If still not found, check if repository root contains index.html
    if (!detectedOutputDir && fs.existsSync(path.join(repoPath, "index.html"))) {
        detectedOutputDir = ".";
    }

    if (!detectedOutputDir) {
        throw new Error("Could not find a valid build output directory. Checked: dist, build, out, public. Ensure your build script produces one of these directories or set OUTPUT_DIR.");
    }

    const distPath = path.resolve(repoPath, detectedOutputDir);
    publishLog(`✔ Build output verified at: '${detectedOutputDir}'`, {
        level: "info",
        stage: "build",
        category: "build",
        meta: { outputDir: detectedOutputDir }
    });

    // =========================================================================
    // PHASE 6: Asset Upload (Cloudflare R2)
    // =========================================================================
    const { totalFiles, totalBytes } = await uploadFiles(s3Client, distPath);

    // =========================================================================
    // PHASE 7: Ready / Deployment Success
    // =========================================================================
    const totalElapsedSec = ((Date.now() - workerStartTime) / 1000).toFixed(1);
    const deploymentUrl = `http://${PROJECT_ID}.localhost:8000`;

    publishLog("┌────────────────────────────────────────────────────────────┐", { level: "ready", stage: "ready", category: "deploy" });
    publishLog("│                  DEPLOYMENT SUCCESSFUL                     │", { level: "ready", stage: "ready", category: "deploy" });
    publishLog(`│  Target URL : ${deploymentUrl.padEnd(44)} │`, { level: "ready", stage: "ready", category: "deploy" });
    publishLog(`│  Total Time : ${(totalElapsedSec + "s").padEnd(44)} │`, { level: "ready", stage: "ready", category: "deploy" });
    publishLog(`│  Artifacts  : ${(totalFiles + " files (" + formatBytes(totalBytes) + ")").padEnd(44)} │`, { level: "ready", stage: "ready", category: "deploy" });
    publishLog("└────────────────────────────────────────────────────────────┘", { level: "ready", stage: "ready", category: "deploy" });

    // Clean up Kafka producer connection
    if (producer) {
        try {
            await producer.disconnect();
        } catch (err) {
            console.error("Error disconnecting Kafka producer:", err.message);
        }
    }
}

init().catch(async (error) => {
    const errorMsg = error.message || String(error);
    console.error("BUILD WORKER FATAL ERROR:", error);

    try {
        publishLog("┌────────────────────────────────────────────────────────────┐", { level: "error", stage: "error", category: "error" });
        publishLog("│                     DEPLOYMENT FAILED                      │", { level: "error", stage: "error", category: "error" });
        publishLog(`│  Error : ${errorMsg.slice(0, 48).padEnd(48)} │`, { level: "error", stage: "error", category: "error" });
        publishLog("└────────────────────────────────────────────────────────────┘", { level: "error", stage: "error", category: "error" });

        if (producer) {
            await producer.disconnect();
        }
    } catch {
        // ignore
    }

    process.exit(1);
});
