FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY tsconfig.json ./
COPY src ./src

RUN npm run build


FROM node:20-alpine AS runtime

WORKDIR /app

ENV NODE_ENV=production

RUN addgroup -S appgroup \
  && adduser -S appuser -G appgroup

COPY package*.json ./
RUN npm ci --omit=dev \
  && npm cache clean --force

COPY --from=builder /app/dist ./dist

RUN mkdir -p /app/data /app/logs \
  && chown -R appuser:appgroup /app

USER appuser

EXPOSE 3011

CMD ["node", "dist/index.js"]
