FROM debian:bookworm-slim

# Install essentials + curl & unzip for fnm
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
    git ca-certificates bash curl unzip python3 make g++ && \
    rm -rf /var/lib/apt/lists/*

# Set up FNM (Fast Node Manager) globally
ENV FNM_DIR="/usr/local/fnm"
ENV PATH="/usr/local/fnm:$PATH"

RUN curl -fsSL https://vercel.app | bash -s -- --install-dir "/usr/local/fnm" --skip-shell && \
    eval "$(fnm env --shell bash)" && \
    # Pre-cache common LTS versions so builds start instantly
    fnm install 18 && \
    fnm install 20 && \
    fnm install 22 && \
    fnm default 20

# Enable corepack (adds yarn and pnpm support out of the box)
RUN eval "$(fnm env --shell bash)" && corepack enable

WORKDIR /home/app

COPY package*.json ./
RUN eval "$(fnm env --shell bash)" && npm ci

COPY main.sh script.js ./

# Normalize Windows CRLF line endings
RUN sed -i 's/\r$//' /home/app/main.sh && \
    chmod 755 /home/app/main.sh

ENTRYPOINT ["/bin/bash", "/home/app/main.sh"]
