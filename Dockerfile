FROM node:20-alpine AS builder

WORKDIR /app

# Корневые сертификаты и инструменты для проверки TLS
RUN apk add --no-cache \
    ca-certificates \
    openssl \
    && update-ca-certificates

COPY package*.json ./

RUN npm ci

COPY tsconfig.json ./
COPY src ./src

RUN npm run build


FROM node:20-alpine AS runtime

WORKDIR /app

ENV NODE_ENV=production

# CA-сертификаты обязательны для HTTPS-запросов из Node.js
RUN apk add --no-cache \
    ca-certificates \
    openssl \
    && update-ca-certificates

COPY package*.json ./

RUN npm ci --omit=dev \
    && npm cache clean --force

COPY --from=builder /app/dist ./dist

RUN mkdir -p /app/data /app/logs

EXPOSE 3011

CMD ["node", "dist/index.js"]
