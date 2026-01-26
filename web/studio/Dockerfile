# Build stage for Rust CMS
FROM rustlang/rust:nightly AS rust-builder
WORKDIR /usr/src/app
# Copy only necessary files for Rust build to optimize cache
COPY Cargo.toml Cargo.lock ./
COPY services ./services
COPY shared ./shared
RUN apt-get update && apt-get install -y pkg-config libssl-dev && rm -rf /var/lib/apt/lists/*
RUN cargo build --release -p cms-service

# Build stage for Next.js Studio
FROM node:18-alpine AS node-builder
WORKDIR /app
COPY web/studio/package*.json ./
RUN npm install
COPY web/studio/ .
RUN npm run build

# Final stage
FROM node:18-slim AS runner
WORKDIR /app
ENV NODE_ENV production

# Install system dependencies for Rust binary
RUN apt-get update && apt-get install -y openssl ca-certificates && rm -rf /var/lib/apt/lists/*

# Install sharp for Next.js image optimization
RUN npm install sharp

# Copy CMS binary
COPY --from=rust-builder /usr/src/app/target/release/cms-service ./

# Copy Studio frontend
COPY --from=node-builder /app/public ./public
COPY --from=node-builder /app/.next/standalone ./
COPY --from=node-builder /app/.next/static ./.next/static

# Copy entrypoint
COPY web/studio/entrypoint.sh ./
RUN chmod +x entrypoint.sh

EXPOSE 3000 3001
CMD ["./entrypoint.sh"]
