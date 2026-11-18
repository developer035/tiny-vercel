#!/bin/bash
set -e

# Initialize FNM environment
export FNM_DIR="/usr/local/fnm"
export PATH="/usr/local/fnm:$PATH"
eval "$(fnm env --shell bash)"

# Delegate build and deployment orchestration to script.js
exec node /home/app/script.js
