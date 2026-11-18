FROM debian:bookworm-slim

# Use bash for RUN so pipes behave predictably
SHELL ["/bin/bash", "-c"]

# Install essentials + curl & unzip for fnm
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
    git ca-certificates bash curl unzip python3 make g++ && \
    rm -rf /var/lib/apt/lists/*

# Set up FNM (Fast Node Manager) globally
ENV FNM_DIR="/usr/local/fnm"
ENV PATH="/usr/local/fnm:/usr/local/fnm/aliases/default/bin:$PATH"

# Install fnm and pre-cache Node versions so builds start fast
RUN curl -fsSL https://fnm.vercel.app/install | bash -s -- --install-dir "/usr/local/fnm" --skip-shell && \
    fnm install 20 && \
    fnm install 22 && \
    fnm install 24 && \
    fnm default 24

# Enable corepack (adds yarn and pnpm support out of the box)
RUN corepack enable

WORKDIR /home/app

COPY package*.json ./
RUN npm ci

COPY main.sh script.js ./

# Normalize Windows CRLF line endings
RUN sed -i 's/\r$//' /home/app/main.sh && \
    chmod 755 /home/app/main.sh

ENTRYPOINT ["/bin/bash", "/home/app/main.sh"]