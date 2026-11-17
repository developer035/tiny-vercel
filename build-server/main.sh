
#!/bin/bash

echo "=================================="
echo "TINY VERCEL CONTAINER INITIALIZED"
echo "=================================="

echo "Node version:"
node --version

echo "NPM version:"
npm --version

echo "Working directory:"
pwd

echo "Environment validation:"
echo "GIT_REPO_URL: ${GIT_REPO_URL:+SET}"
echo "PROJECT_ID: ${PROJECT_ID:+SET}"

set -Eeuo pipefail

echo "Starting repository clone..."

export GIT_REPO_URL="$GIT_REPO_URL"

git clone "$GIT_REPO_URL" /home/app/output

exec node script.js