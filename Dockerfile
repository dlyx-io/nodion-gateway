# Stage 1: Build frontend
FROM node:22-slim AS frontend-builder
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ .
RUN npm run build

# Stage 2: Build backend
FROM node:22-slim AS backend-builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# Stage 3: Production image
FROM node:22-slim
WORKDIR /app
COPY --from=backend-builder /app/dist ./dist
COPY --from=backend-builder /app/node_modules ./node_modules
COPY --from=backend-builder /app/package.json ./
COPY --from=backend-builder /app/drizzle ./drizzle
COPY --from=frontend-builder /app/frontend/dist ./frontend/dist
RUN mkdir -p /data
VOLUME /data
ENV DB_DIALECT=sqlite
ENV DB_PATH=/data/gateway.db
ENV PORT=80
EXPOSE 80
CMD ["node", "dist/index.js"]
