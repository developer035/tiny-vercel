const { spawn } = require("child_process");
const path = require("path");
const fs = require("fs");
const {
    S3Client,
    PutObjectCommand
} = require("@aws-sdk/client-s3");
const mime = require("mime-types");

const PROJECT_ID = process.env.PROJECT_ID;
const OUTPUT_DIR = process.env.OUTPUT_DIR || "dist";

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
        console.log(`Running: ${command} ${args.join(" ")}`);

        const child = spawn(command, args, {
            ...options,
            stdio: "inherit"
        });

        child.on("error", reject);

        child.on("close", (code) => {
            if (code !== 0) {
                reject(new Error(`${command} exited with code ${code}`));
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

    console.log(`Uploading ${files.length} files to R2...`);

    for (const filePath of files) {
        const relativePath = path.relative(distPath, filePath)
            .split(path.sep)
            .join("/");

        const key = `__outputs/${PROJECT_ID}/${relativePath}`;

        console.log(`Uploading: ${relativePath}`);

        await s3Client.send(new PutObjectCommand({
            Bucket: "tiny-vercel",
            Key: key,
            Body: fs.createReadStream(filePath),
            ContentType: mime.lookup(filePath) || "application/octet-stream"
        }));

        console.log(`Uploaded: ${relativePath}`);
    }
}

async function main() {
    console.log("================================");
    console.log("Tiny Vercel Build Worker Started");
    console.log("Project:", PROJECT_ID);
    console.log("================================");

    // The repo is cloned and built by main.sh before this script runs
    const projectPath = path.join(__dirname, "output");

    // Upload generated files
    const distPath = path.resolve(projectPath, OUTPUT_DIR);

    await uploadFiles(distPath);

    console.log("================================");
    console.log("Deployment completed successfully");
    console.log("================================");
}

main().catch((error) => {
    console.error("BUILD FAILED:", error);
    process.exit(1);
});