# ---- Stage 1: Builder ----
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files and install all dependencies
COPY package*.json ./
RUN npm ci

# Copy source and prisma schema
COPY src ./src
COPY prisma ./prisma
COPY tsconfig.json ./

# Generate Prisma client and build TypeScript
RUN npx prisma generate
RUN npm run build

# ---- Stage 2: Runner ----
FROM node:20-alpine AS runner

WORKDIR /app

# Copy package files from builder and install only production deps
COPY --from=builder /app/package*.json ./
RUN npm ci --only=production

# Copy compiled output, prisma schema, and generated client
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma

EXPOSE 8000

CMD ["sh", "-c", "npx prisma db push && node dist/index.js"]
