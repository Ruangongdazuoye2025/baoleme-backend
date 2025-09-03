FROM node:22.16.0

ENV NODE_ENV=production

RUN mkdir /app
WORKDIR /app

COPY package.json package-lock.json ./

RUN npm install
RUN npm install -g typescript

COPY . .

RUN npm install --include=dev
RUN npx prisma generate
RUN npm run build
RUN npm prune --omit=dev

EXPOSE 3000

CMD ["sh", "-c", "sh scripts/start-services.sh"]