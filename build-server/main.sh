#!/bin/bash
set -e

export FNM_DIR="/usr/local/fnm"
export PATH="/usr/local/fnm:$PATH"
eval "$(fnm env --shell bash)"

# 1. Clone the user's repo
git clone --depth 1 "$GIT_REPOSITORY_URL" /home/app/output
cd /home/app/output

# 2. Pick Node version: env var -> .nvmrc/.node-version -> default (20)
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

# Node 25+ no longer bundles corepack
if ! command -v corepack >/dev/null 2>&1; then
    npm install -g corepack
fi
corepack enable

# 3. Detect package manager
if [ -f "pnpm-lock.yaml" ]; then
    PM="pnpm"
    DEFAULT_INSTALL="pnpm install --frozen-lockfile || pnpm install --no-frozen-lockfile"
    DEFAULT_BUILD="pnpm run build"
elif [ -f "yarn.lock" ]; then
    PM="yarn"
    DEFAULT_INSTALL="yarn install --frozen-lockfile || yarn install"
    DEFAULT_BUILD="yarn build"
elif [ -f "package-lock.json" ]; then
    PM="npm"
    DEFAULT_INSTALL="npm ci || npm install"
    DEFAULT_BUILD="npm run build"
else
    PM="npm"
    DEFAULT_INSTALL="npm install"
    DEFAULT_BUILD="npm run build"
fi
echo "Detected $PM"

INSTALL_CMD="${INSTALL_COMMAND:-$DEFAULT_INSTALL}"
BUILD_CMD="${BUILD_COMMAND:-$DEFAULT_BUILD}"

# 4. Install and build (retry build for old webpack projects on newer Node)
echo "Install: $INSTALL_CMD"
bash -c "$INSTALL_CMD"

echo "Build: $BUILD_CMD"
if ! bash -c "$BUILD_CMD"; then
    echo "Build failed, retrying with legacy OpenSSL provider..."
    NODE_OPTIONS="--openssl-legacy-provider" bash -c "$BUILD_CMD"
fi

# 5. Detect output dir if not set
if [ -z "$OUTPUT_DIR" ]; then
    for d in dist build out public; do
        if [ -d "$d" ]; then
            export OUTPUT_DIR="$d"
            break
        fi
    done
fi
echo "Using output directory: ${OUTPUT_DIR:-dist}"

# 6. Upload
cd /home/app
node script.js