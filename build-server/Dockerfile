
FROM node:20-bookworm-slim

RUN apt-get update && \
    apt-get install -y --no-install-recommends git ca-certificates bash && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /home/app

COPY package*.json ./

RUN npm ci

COPY main.sh script.js ./

# Normalize Windows CRLF line endings
RUN sed -i 's/\r$//' /home/app/main.sh && \
    chmod 755 /home/app/main.sh

ENTRYPOINT ["/bin/bash", "/home/app/main.sh"]
