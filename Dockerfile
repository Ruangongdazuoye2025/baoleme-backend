FROM node:22.16.0

WORKDIR /app

COPY package*.json ./

RUN npm ci

COPY . .

EXPOSE 3000

CMD sh scripts/start-server.sh