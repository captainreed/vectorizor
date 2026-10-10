# syntax=docker/dockerfile:1

# --- Build: client bundle (dist/), bundled server (dist-server/), production node_modules ---
FROM node:20-bookworm-slim AS build
# Toolchain for better-sqlite3, in case its prebuilt binary can't be downloaded.
RUN apt-get update \
 && apt-get install -y --no-install-recommends python3 make g++ \
 && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build && npm run build:server && npm prune --omit=dev

# --- Runtime: same base image, so the compiled native module matches ---
FROM node:20-bookworm-slim
ENV NODE_ENV=production \
    PORT=3000 \
    VECTORIZOR_DB=/data/vectorizor.db \
    STATIC_DIR=/app/dist
WORKDIR /app
COPY --from=build /app/package.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/dist-server ./dist-server
# The SQLite database lives on a mounted volume at /data.
RUN mkdir -p /data && chown node:node /data
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=3s CMD node -e "fetch('http://127.0.0.1:3000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "dist-server/index.js"]
