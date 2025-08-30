FROM node:22.16.0

ENV NODE_ENV=production

RUN mkdir /app
WORKDIR /app

COPY package.json package-lock.json ./

RUN npm install
RUN npm install -g typescript

COPY . .

EXPOSE 3000

CMD ["sh", "scripts/start-services.sh"]
