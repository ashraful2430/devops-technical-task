# ── Stage 1: Install dependencies ─────────────────────────────────────────────
FROM node:20-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci --prefer-offline

# ── Stage 2: Run tests (build fails if tests fail) ────────────────────────────
FROM deps AS test
COPY . .
RUN npm test

# ── Stage 3: Production image ─────────────────────────────────────────────────
FROM node:20-alpine AS production

# Create non-root user for security
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

WORKDIR /app

# Environment variable configuration (overridable at runtime)
ENV NODE_ENV=production \
    PORT=3000 \
    APP_VERSION=1.0.0 \
    LOG_LEVEL=info


# Install only production dependencies
COPY package*.json ./
RUN npm ci --omit=dev --prefer-offline && npm cache clean --force

# Copy application source
COPY app/ ./app/

# Give ownership to non-root user
RUN chown -R appuser:appgroup /app

# Switch to non-root user
USER appuser

EXPOSE 3000

# Health check — Docker marks container unhealthy if this fails
HEALTHCHECK --interval=15s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost:3000/healthz || exit 1

# Exec form so the process receives SIGTERM directly (enables graceful shutdown)
CMD ["node", "app/server.js"]