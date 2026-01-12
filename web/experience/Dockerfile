# Build stage for Rust LMS
FROM rustlang/rust:nightly AS rust-builder
WORKDIR /usr/src/app
COPY . .
RUN apt-get update && apt-get install -y pkg-config libssl-dev && rm -rf /var/lib/apt/lists/*
RUN cargo build --release -p lms-service

# Build stage for Next.js Experience
FROM node:18-alpine AS node-builder
WORKDIR /app
COPY web/experience/package*.json ./
RUN npm install
COPY web/experience/ .
RUN npm run build

# Final stage
FROM node:18-slim AS runner
WORKDIR /app
ENV NODE_ENV production

# Install system dependencies for Rust binary
RUN apt-get update && apt-get install -y openssl ca-certificates && rm -rf /var/lib/apt/lists/*

# Install sharp for Next.js image optimization
RUN npm install sharp

# Copy LMS binary
COPY --from=rust-builder /usr/src/app/target/release/lms-service ./

# Copy Experience frontend
COPY --from=node-builder /app/public ./public
COPY --from=node-builder /app/.next/standalone ./
COPY --from=node-builder /app/.next/static ./.next/static

# Copy entrypoint
COPY web/experience/entrypoint.sh ./
RUN chmod +x entrypoint.sh

EXPOSE 3003 3002
CMD ["./entrypoint.sh"]
