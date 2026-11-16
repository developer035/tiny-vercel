
#!/bin/bash
set -Eeuo pipefail

echo "Starting Tiny Vercel build worker..."

if [[ -z "${GIT_REPO_URL:-}" ]]; then
    echo "ERROR: GIT_REPO_URL is not configured"
    exit 1
fi

if [[ -z "${PROJECT_ID:-}" ]]; then
    echo "ERROR: PROJECT_ID is not configured"
    exit 1
fi

echo "Cloning repository: $GIT_REPO_URL"

rm -rf /home/app/output

git clone --depth 1 \
    --branch "${GIT_BRANCH:-main}" \
    "$GIT_REPO_URL" \
    /home/app/output

echo "Repository cloned successfully"

exec node /home/app/script.js
