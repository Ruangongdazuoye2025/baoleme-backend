FROM node:22.16.0

ENV NODE_ENV=production

RUN mkdir /app
WORKDIR /app

COPY package.json package-lock.json ./

RUN npm install
RUN npm install -g typescript

COPY . .

EXPOSE 3000

# 根据SERVICES环境变量决定启动方式
CMD if [ "$SERVICES" = "api" ]; then \
        npm run build && npm start; \
    else \
        sh scripts/start-services.sh; \
    fi
