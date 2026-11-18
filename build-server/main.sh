#!/bin/bash
set -e

# Load fnm into the current shell session
export FNM_DIR="/usr/local/fnm"
export PATH="/usr/local/fnm:$PATH"
eval "$(fnm env --shell bash)"

# 1. Clone the user's repo
git clone "$GIT_REPOSITORY_URL" /home/app/output
cd /home/app/output

# 2. Detect and switch Node version
# Priority: Env var from your platform -> .nvmrc / .node-version -> default (20)
if [ -n "$NODE_VERSION" ]; then
    echo "Using platform-specified Node version: $NODE_VERSION"
    fnm install "$NODE_VERSION"
    fnm use "$NODE_VERSION"
elif [ -f ".nvmrc" ] || [ -f ".node-version" ]; then
    echo "Detected version file in repo..."
    fnm install
    fnm use
else
    echo "Using default Node 20"
    fnm use 20
fi

# Enable corepack for the active Node version (unlocks yarn/pnpm)
corepack enable

# 3. Auto-detect Package Manager & Build
if [ -f "pnpm-lock.yaml" ]; then
    echo "Detected pnpm"
    pnpm install --frozen-lockfile
    pnpm run build
elif [ -f "yarn.lock" ]; then
    echo "Detected yarn"
    yarn install --frozen-lockfile
    yarn build
else
    echo "Detected npm"
    npm install
    npm run build
fi

# 4. Run your upload script (S3 / R2 / Cloud Storage)
cd /home/app
node script.js
