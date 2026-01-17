#!/bin/bash

# OpenCCB Unified Installation Script
# This script automates the setup of OpenCCB:
# 1. Prerequisite checks (Rust, Node.js, Docker, sqlx-cli)
# 2. Hardware detection (NVIDIA GPU vs CPU)
# 3. Environment configuration (.env)
# 4. Database creation and migrations
# 5. System initialization (Admin account)

set -e

echo "===================================================="
echo "        🚀 Welcome to the OpenCCB Installer"
echo "===================================================="
echo ""

# 1. Detection & Cloning
if [ -f "Cargo.toml" ] && [ -d "services" ] && [ -d "web" ]; then
    echo "✅ Project detected in current directory."
    PROJECT_ROOT=$(pwd)
else
    # Simplification: assume we are in the project root if the script is running
    # but let's keep a basic check
    if [ -d "openccb" ]; then
        cd openccb
        PROJECT_ROOT=$(pwd)
    else
        echo "⚠️  Please run this script from the root of the OpenCCB repository."
        exit 1
    fi
fi

# 2. Prerequisite Installation
install_pkg() {
    if ! command -v "$1" &> /dev/null; then
        echo "🔧 Installing $1..."
        sudo apt-get update && sudo apt-get install -y "$1"
    else
        echo "✅ $1 is already installed."
    fi
}

if [[ "$OSTYPE" == "linux-gnu"* ]]; then
    if [ -f /etc/debian_version ]; then
        install_pkg "curl"
        install_pkg "git"
        install_pkg "jq"
        install_pkg "build-essential"
        install_pkg "docker.io"
        if ! docker compose version &> /dev/null; then
            install_pkg "docker-compose-v2"
        fi
    fi
fi

if ! command -v cargo &> /dev/null; then
    echo "🔧 Installing Rust..."
    curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
    source $HOME/.cargo/env
fi

if ! command -v node &> /dev/null; then
    echo "🔧 Installing Node.js via NVM..."
    curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
    export NVM_DIR="$HOME/.nvm"
    [ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
    nvm install --lts
fi

if ! command -v sqlx &> /dev/null; then
    echo "🔧 Installing sqlx-cli..."
    cargo install sqlx-cli --no-default-features --features postgres
fi

# 3. Hardware Detection
echo ""
echo "🔍 Detecting hardware..."
HAS_NVIDIA=false
if command -v nvidia-smi &> /dev/null && nvidia-smi -L &> /dev/null; then
    echo "🚀 NVIDIA GPU Detected!"
    HAS_NVIDIA=true
elif command -v lspci &> /dev/null && lspci | grep -i nvidia &> /dev/null; then
    echo "🚀 NVIDIA GPU Detected (lspci)!"
    HAS_NVIDIA=true
else
    echo "💻 No NVIDIA GPU found. Using CPU mode."
fi

# 4. Environment Configuration
echo ""
if [ ! -f ".env" ]; then
    if [ -f ".env.example" ]; then
        cp .env.example .env
    else
        touch .env
    fi
fi

update_env() {
    local key=$1
    local val=$2
    if grep -q "^${key}=" .env; then
        sed -i "s|^${key}=.*|${key}=${val}|" .env
    else
        echo "${key}=${val}" >> .env
    fi
}

# Auto-configure AI variables based on hardware
if [ "$HAS_NVIDIA" = true ]; then
    update_env "WHISPER_IMAGE" "fedirz/faster-whisper-server:latest-cuda"
    update_env "WHISPER_DEVICE" "cuda"
    update_env "LOCAL_LLM_MODEL" "llama3.2:1b"
    # Uncomment GPU deploy section in docker-compose.yml while preserving indentation
    sed -i 's/^    #deploy:/    deploy:/' docker-compose.yml
    sed -i 's/^    #  resources:/      resources:/' docker-compose.yml
    sed -i 's/^    #    reservations:/        reservations:/' docker-compose.yml
    sed -i 's/^    #      devices:/          devices:/' docker-compose.yml
    sed -i 's/^    #        - driver: nvidia/            - driver: nvidia/' docker-compose.yml
    sed -i 's/^    #          count: 1/              count: 1/' docker-compose.yml
    sed -i 's/^    #          capabilities: \[ gpu \]/              capabilities: [ gpu ]/' docker-compose.yml
else
    update_env "WHISPER_IMAGE" "fedirz/faster-whisper-server:latest-cpu"
    update_env "WHISPER_DEVICE" "cpu"
    update_env "LOCAL_LLM_MODEL" "phi3:mini"
    # Comment GPU deploy section in docker-compose.yml
    sed -i 's/^    deploy:/    #deploy:/' docker-compose.yml
    sed -i 's/^      resources:/    #  resources:/' docker-compose.yml
    sed -i 's/^        reservations:/    #    reservations:/' docker-compose.yml
    sed -i 's/^          devices:/    #      devices:/' docker-compose.yml
    sed -i 's/^            - driver: nvidia/    #        - driver: nvidia/' docker-compose.yml
    sed -i 's/^              count: 1/    #          count: 1/' docker-compose.yml
    sed -i 's/^              capabilities: \[ gpu \]/    #          capabilities: [ gpu ]/' docker-compose.yml
fi

# Ask for DB credentials if not set
if ! grep -q "DATABASE_URL=" .env || [[ $(grep "DATABASE_URL=" .env | cut -d'=' -f2) == "" ]]; then
    read -p "Enter Database Password [password]: " DB_PASS
    DB_PASS=${DB_PASS:-password}
    update_env "DATABASE_URL" "postgresql://user:${DB_PASS}@localhost:5432/openccb?sslmode=disable"
    update_env "CMS_DATABASE_URL" "postgresql://user:${DB_PASS}@localhost:5432/openccb_cms?sslmode=disable"
    update_env "LMS_DATABASE_URL" "postgresql://user:${DB_PASS}@localhost:5432/openccb_lms?sslmode=disable"
    update_env "JWT_SECRET" "supersecretsecret"
    update_env "AI_PROVIDER" "local"
    update_env "LOCAL_WHISPER_URL" "http://whisper:8000"
    update_env "LOCAL_OLLAMA_URL" "http://ollama:11434"
    update_env "NEXT_PUBLIC_CMS_API_URL" "http://localhost:3001"
    update_env "NEXT_PUBLIC_LMS_API_URL" "http://localhost:3002"
fi

# 5. AI Stack Setup (Containerized)
echo "⏳ Starting Ollama container..."
docker compose up -d ollama

echo "⏳ Waiting for Ollama to be ready..."
until docker exec openccb-ollama-1 ollama list &> /dev/null; do sleep 2; done

echo "📥 Downloading models..."
if [ "$HAS_NVIDIA" = true ]; then
    docker exec openccb-ollama-1 ollama pull llama3.2:1b
else
    docker exec openccb-ollama-1 ollama pull phi3:mini
fi

# 6. Database Initialization (Integrated db-mgmt.sh)
echo ""
read -p "Do you want a CLEAN installation? (This will DELETE all existing data) [y/N]: " CLEAN_INSTALL
if [[ "$CLEAN_INSTALL" =~ ^[Yy]$ ]]; then
    echo "🐘 Resetting database for a clean installation..."
    docker compose down -v || true
fi

echo "🐘 Starting database with Docker..."
docker compose up -d db

echo "⏳ Waiting for database to be ready..."
RETRIES=30
until docker exec openccb-db-1 pg_isready -U user &> /dev/null || [ $RETRIES -eq 0 ]; do
  echo -n "."
  sleep 1
  RETRIES=$((RETRIES-1))
done
echo ""

# Reset retries for the second check and ensure we can actually execute queries
RETRIES=30
until docker exec openccb-db-1 psql -U user -d openccb -c "SELECT 1" &> /dev/null || [ $RETRIES -eq 0 ]; do
  echo -n "+"
  sleep 1
  RETRIES=$((RETRIES-1))
done
echo ""

if [ $RETRIES -eq 0 ]; then
    echo "❌ Database failed to start in time."
    exit 1
fi

CMS_URL=$(grep "CMS_DATABASE_URL=" .env | cut -d'=' -f2-)
LMS_URL=$(grep "LMS_DATABASE_URL=" .env | cut -d'=' -f2-)

echo "🏗️  Creating databases and running migrations..."
DATABASE_URL=$CMS_URL sqlx database create || true
DATABASE_URL=$LMS_URL sqlx database create || true
DATABASE_URL=$CMS_URL sqlx migrate run --source services/cms-service/migrations
DATABASE_URL=$LMS_URL sqlx migrate run --source services/lms-service/migrations

# 7. System Initialization (Integrated init-system.sh)
echo ""
echo "🔍 Checking for existing administrator..."
ADMIN_EXISTS=$(docker exec openccb-db-1 psql -U user -d openccb_cms -t -c "SELECT EXISTS (SELECT 1 FROM users WHERE role = 'admin');" | xargs 2>/dev/null || echo "f")

if [ "$ADMIN_EXISTS" != "t" ]; then
    echo "👤 Configure Initial Administrator"
    read -p "Full Name [System Admin]: " ADMIN_NAME
    ADMIN_NAME=${ADMIN_NAME:-System Admin}
    read -p "Admin Email [admin@example.com]: " ADMIN_EMAIL
    ADMIN_EMAIL=${ADMIN_EMAIL:-admin@example.com}
    read -s -p "Admin Password [password123]: " ADMIN_PASS
    ADMIN_PASS=${ADMIN_PASS:-password123}
    echo ""
    ORG_NAME="Default Organization"
fi

echo ""
echo "🚀 Starting all services..."
docker compose up -d --build

if [ "$ADMIN_EXISTS" != "t" ]; then
    echo "⏳ Waiting for CMS API to be ready..."
    API_URL="http://localhost:3001"
    START_WAIT=$SECONDS
    until curl -s "$API_URL/auth/login" &> /dev/null || [ $((SECONDS - START_WAIT)) -gt 60 ]; do sleep 2; done

    PAYLOAD=$(jq -n \
      --arg email "$ADMIN_EMAIL" \
      --arg password "$ADMIN_PASS" \
      --arg full_name "$ADMIN_NAME" \
      --arg org_name "$ORG_NAME" \
      --arg role "admin" \
      '{email: $email, password: $password, full_name: $full_name, organization_name: $org_name, role: $role}')

    RESPONSE=$(curl -s -X POST "$API_URL/auth/register" -H "Content-Type: application/json" -d "$PAYLOAD")

    if echo "$RESPONSE" | grep -q "token"; then
        echo "✅ Success! Administrator created."
    else
        echo "⚠️  Failed to create administrator."
    fi
else
    echo "✅ Administrator already exists. Skipping registration."
fi

echo ""
echo "===================================================="
echo "        ✨ OpenCCB Installation Complete!"
echo "===================================================="
echo "Studio (Admin/CMS): http://localhost:3000"
echo "Experience (LMS):   http://localhost:3003"
echo "===================================================="
