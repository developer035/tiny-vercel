const express = require("express");
const path = require("path");
const {
    S3Client,
    GetObjectCommand
} = require("@aws-sdk/client-s3");
require("dotenv").config();


const app = express();
const PORT = process.env.PORT || 8000;

const s3 = new S3Client({
    region: "auto",
    endpoint: `https://${process.env.CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY
    }
});

const BUCKET = "tiny-vercel";

app.get(/.*/, async (req, res) => {
    try {
        // 1. Resolve hostname
        const hostname = req.hostname;
        const subdomain = hostname.split(".")[0];

        // TODO: Replace with database lookup.
        const projectId = subdomain;

        // 2. Resolve requested file
        let requestedPath = decodeURIComponent(req.path);

        if (requestedPath === "/") {
            requestedPath = "/index.html";
        }

        // Prevent path traversal
        const normalizedPath = path.posix.normalize(requestedPath);

        if (
            normalizedPath.includes("..") ||
            normalizedPath.startsWith("//")
        ) {
            return res.status(400).send("Invalid path");
        }

        // 3. Build R2 object key
        const key = `__outputs/${projectId}${normalizedPath}`;

        console.log("Fetching from R2:", key);

        // 4. Fetch authenticated object
        const result = await s3.send(
            new GetObjectCommand({
                Bucket: BUCKET,
                Key: key
            })
        );

        // 5. Forward response headers
        res.setHeader(
            "Content-Type",
            result.ContentType || "application/octet-stream"
        );

        if (result.ETag) {
            res.setHeader("ETag", result.ETag);
        }

        if (result.CacheControl) {
            res.setHeader("Cache-Control", result.CacheControl);
        }

        if (result.ContentLength !== undefined) {
            res.setHeader("Content-Length", result.ContentLength);
        }

        // 6. Stream R2 object to browser
        result.Body.pipe(res);

    } catch (error) {
        console.error("Proxy error:", error);

        if (error.name === "NoSuchKey" || error.name === "NotFound") {
            return res.status(404).send("Page not found");
        }

        if (!res.headersSent) {
            res.status(502).send("Unable to fetch website");
        } else {
            res.destroy(error);
        }
    }
});

app.listen(PORT, () => {
    console.log(`Tiny Vercel Proxy running on ${PORT}`);
});
