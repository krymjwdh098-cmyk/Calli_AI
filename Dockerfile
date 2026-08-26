# CalliQ AI - Production Multi-Stage Dockerfile
FROM node:20-alpine AS builder

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci

# Copy codebase and build production assets
COPY . .
RUN npm run build

# Production runner image
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

COPY package*.json ./
RUN npm ci --only=production

# Copy compiled dist outputs
COPY --from=builder /app/dist ./dist

# Expose container application port
EXPOSE 3000

CMD ["npm", "start"]
