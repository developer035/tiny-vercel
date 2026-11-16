FROM ubuntu:resolute


RUN apt-get update && \
    apt-get upgrade -y && \
    apt-get install -y curl git ca-certificates && \
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash - && \
    apt-get install -y nodejs && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /home/app

COPY main.sh main.sh
COPY script.js script.js    
COPY package*.json .

RUN npm install

RUN chmod +x main.sh
RUN chmod +x script.js

ENTRYPOINT [ "/home/app/main.sh" ]