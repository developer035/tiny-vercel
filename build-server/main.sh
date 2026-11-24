#!/bin/bash
set -e

# Initialize FNM environment
export FNM_DIR="/usr/local/fnm"
export PATH="/usr/local/fnm:$PATH"
eval "$(fnm env --shell bash)"

# Dynamically initialize Kafka CA certificate if passed via environment
CA_DATA="${KAFKA_CA_CERT:-${KAFKA_CA_CONTENT:-${KAFKA_CA_PEM:-$KAFKA_CA_PATH}}}"
if [ -n "$CA_DATA" ] && [[ "$CA_DATA" == *"BEGIN CERTIFICATE"* ]]; then
    # Write PEM certificate to /home/app/kafka.pem dynamically
    printf "%b\n" "$CA_DATA" > /home/app/kafka.pem
    export KAFKA_CA_PATH="/home/app/kafka.pem"
fi

# Delegate build and deployment orchestration to script.js
exec node /home/app/script.js
