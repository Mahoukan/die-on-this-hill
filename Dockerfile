FROM node:22-bookworm-slim AS base
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

FROM base AS dependencies
COPY package.json package-lock.json ./
RUN npm ci

FROM base AS production-dependencies
ENV NODE_ENV=production
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

FROM base AS builder
ENV NODE_ENV=production
COPY --from=dependencies /app/node_modules ./node_modules
COPY . .
RUN npm run build
RUN rm -rf /app/.next/cache

FROM node:22-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    HOST=0.0.0.0 \
    PORT=3000 \
    CUSTOM_PACKS_DIR=/data/custom-packs

COPY --from=production-dependencies --chown=node:node /app/node_modules ./node_modules
COPY --from=builder --chown=node:node /app/.next ./.next
COPY --from=builder --chown=node:node /app/public ./public
COPY --from=builder --chown=node:node /app/server ./server
COPY --from=builder --chown=node:node /app/packs ./packs
COPY --from=builder --chown=node:node /app/shared ./shared
COPY --from=builder --chown=node:node /app/server.ts ./server.ts
COPY --from=builder --chown=node:node /app/next.config.ts ./next.config.ts
COPY --from=builder --chown=node:node /app/package.json ./package.json

RUN mkdir -p /data/custom-packs && chown -R node:node /data

USER node
EXPOSE 3000
VOLUME ["/data/custom-packs"]

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:' + (process.env.PORT || '3000') + '/api/health').then((response) => { if (!response.ok) process.exit(1); }).catch(() => process.exit(1));"

CMD ["npm", "run", "start"]
