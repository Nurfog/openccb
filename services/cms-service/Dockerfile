# Build stage
FROM rustlang/rust:nightly as builder

WORKDIR /usr/src/app
COPY . .

# Install necessary build dependencies
RUN apt-get update && apt-get install -y pkg-config libssl-dev && rm -rf /var/lib/apt/lists/*

# Build the specific service
RUN cargo build --release -p cms-service

# Final stage
FROM debian:bookworm-slim
RUN apt-get update && apt-get install -y libssl3 ca-certificates && rm -rf /var/lib/apt/lists/*

WORKDIR /usr/local/bin
COPY --from=builder /usr/src/app/target/release/cms-service .

ENV RUST_LOG=info
EXPOSE 3001

CMD ["./cms-service"]
