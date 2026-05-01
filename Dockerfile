FROM node:24-bookworm-slim AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
COPY packages/proto/package.json packages/proto/package.json
COPY packages/shared/package.json packages/shared/package.json
COPY packages/database/package.json packages/database/package.json
COPY packages/claude-plugin/package.json packages/claude-plugin/package.json
COPY packages/control-plane/package.json packages/control-plane/package.json
COPY packages/gateway/package.json packages/gateway/package.json
COPY packages/history-sync/package.json packages/history-sync/package.json
COPY packages/telegram/package.json packages/telegram/package.json
RUN npm install

FROM deps AS build
COPY . .
RUN npm run check && npm run build

FROM node:24-bookworm-slim AS runtime
ENV NODE_ENV=production
WORKDIR /app
RUN groupadd --system agentg && useradd --system --gid agentg --home-dir /app agentg
COPY package.json package-lock.json* ./
COPY packages/proto/package.json packages/proto/package.json
COPY packages/shared/package.json packages/shared/package.json
COPY packages/database/package.json packages/database/package.json
COPY packages/claude-plugin/package.json packages/claude-plugin/package.json
COPY packages/control-plane/package.json packages/control-plane/package.json
COPY packages/gateway/package.json packages/gateway/package.json
COPY packages/history-sync/package.json packages/history-sync/package.json
COPY packages/telegram/package.json packages/telegram/package.json
RUN npm install --omit=dev && npm cache clean --force
COPY --from=build --chown=agentg:agentg /app/packages/database/dist ./packages/database/dist
COPY --from=build --chown=agentg:agentg /app/packages/control-plane/dist ./packages/control-plane/dist
COPY --from=build --chown=agentg:agentg /app/packages/control-plane/dist-server ./packages/control-plane/dist-server
COPY --from=build --chown=agentg:agentg /app/packages/gateway/dist ./packages/gateway/dist
COPY --from=build --chown=agentg:agentg /app/packages/history-sync/dist ./packages/history-sync/dist
COPY --from=build --chown=agentg:agentg /app/packages/telegram/dist ./packages/telegram/dist
RUN mkdir -p /app/td-data/database /app/td-data/files && chown -R agentg:agentg /app
USER agentg
CMD ["npm", "--workspace", "@agentg/telegram", "run", "start"]
