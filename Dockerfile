FROM node:24-bookworm-slim AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
COPY packages/framework/package.json packages/framework/package.json
COPY packages/gateway/package.json packages/gateway/package.json
COPY packages/dashboard/package.json packages/dashboard/package.json
COPY packages/claude-plugin/package.json packages/claude-plugin/package.json
COPY packages/policies/package.json packages/policies/package.json
COPY packages/triggers/package.json packages/triggers/package.json
COPY packages/llm-runner/package.json packages/llm-runner/package.json
COPY packages/telegram/package.json packages/telegram/package.json
COPY packages/tdlib-docs/package.json packages/tdlib-docs/package.json
RUN npm install

FROM deps AS build
COPY . .
RUN npm run check && npm run build

FROM node:24-bookworm-slim AS runtime
ENV NODE_ENV=production
WORKDIR /app
RUN groupadd --system agentg && useradd --system --gid agentg --home-dir /app agentg
COPY package.json package-lock.json* ./
COPY packages/framework/package.json packages/framework/package.json
COPY packages/gateway/package.json packages/gateway/package.json
COPY packages/dashboard/package.json packages/dashboard/package.json
COPY packages/claude-plugin/package.json packages/claude-plugin/package.json
COPY packages/policies/package.json packages/policies/package.json
COPY packages/triggers/package.json packages/triggers/package.json
COPY packages/llm-runner/package.json packages/llm-runner/package.json
COPY packages/telegram/package.json packages/telegram/package.json
COPY packages/tdlib-docs/package.json packages/tdlib-docs/package.json
RUN npm install --include=dev && npm cache clean --force
COPY --from=build --chown=agentg:agentg /app/packages ./packages
COPY --from=build --chown=agentg:agentg /app/config ./config
RUN mkdir -p /app/td-data/database /app/td-data/files && chown -R agentg:agentg /app
USER agentg
CMD ["npm", "run", "dev:telegram"]
