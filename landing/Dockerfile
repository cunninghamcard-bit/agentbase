FROM node:22-slim AS builder

WORKDIR /app

# Use Chinese npm mirror + install bun
RUN npm config set registry https://registry.npmmirror.com && \
    npm install -g bun

COPY package.json bun.lock* ./
RUN bun install --frozen-lockfile 2>/dev/null || bun install

COPY . .

ENV NEXT_TELEMETRY_DISABLED=1
RUN bun run build

# --- Production ---
FROM node:22-slim AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

EXPOSE 3000

CMD ["node", "server.js"]
