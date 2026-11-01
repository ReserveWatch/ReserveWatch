# syntax=docker/dockerfile:1
# ReserveWatch — XRPL commodity-token health monitor (Express + xrpl.js)
FROM node:24-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY tsconfig.json ./
COPY src ./src
RUN npm run build && npm prune --omit=dev

FROM node:24-slim
ENV NODE_ENV=production \
    PORT=8080 \
    DATA_DIR=/data \
    POLL_INTERVAL_SEC=300
WORKDIR /app
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY package.json ./
COPY public ./public
RUN mkdir -p /data
EXPOSE 8080
CMD ["node", "dist/server.js"]
