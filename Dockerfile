FROM node:20-alpine AS builder

WORKDIR /app

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

RUN apk add --no-cache \
    ca-certificates \
    openssl \
    && update-ca-certificates

COPY certs/russian_trusted_root_ca_pem.crt \
     /usr/local/share/ca-certificates/russian_trusted_root_ca.crt

COPY certs/russian_trusted_root_ca_gost_2025_pem.crt \
     /usr/local/share/ca-certificates/russian_trusted_root_ca_gost_2025.crt

COPY certs/russian_trusted_sub_ca_pem.crt \
     /usr/local/share/ca-certificates/russian_trusted_sub_ca.crt

RUN update-ca-certificates

COPY package*.json ./

RUN npm ci --omit=dev \
    && npm cache clean --force

COPY --from=builder /app/dist ./dist

RUN mkdir -p /app/data /app/logs

ENV NODE_EXTRA_CA_CERTS=/etc/ssl/certs/ca-certificates.crt

EXPOSE 3011

CMD ["node", "dist/index.js"]
