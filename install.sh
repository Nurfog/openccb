#!/bin/bash

# OpenCCB Unified Installation Script
# This script automates the setup of OpenCCB, including prerequisites,
# repository cloning, dependencies, and initial configuration.

set -e

REPO_URL="https://github.com/Nurfog/openccb.git" # Example URL, should be updated if needed
PROJECT_DIR="openccb"

echo "===================================================="
echo "        🚀 Welcome to the OpenCCB Installer"
echo "===================================================="
echo ""

# 1. Detection & Cloning
if [ -f "Cargo.toml" ] && [ -d "services" ] && [ -d "web" ]; then
    echo "✅ Project detected in current directory."
    PROJECT_ROOT=$(pwd)
else
    echo "📂 Project not detected in current directory."
    if [ -d "$PROJECT_DIR" ]; then
        echo "✅ Detected project folder '$PROJECT_DIR'."
        cd "$PROJECT_DIR"
        PROJECT_ROOT=$(pwd)
    else
        echo "📥 Project folder not found. Cloning from $REPO_URL..."
        git clone "$REPO_URL" "$PROJECT_DIR"
        cd "$PROJECT_DIR"
        PROJECT_ROOT=$(pwd)
    fi
fi

# 2. Prerequisite Installation
echo ""
echo "🔍 Checking for prerequisites..."

# Function to check and install system packages (Ubuntu/Debian)
install_pkg() {
    if ! command -v "$1" &> /dev/null; then
        echo "🔧 Installing $1..."
        sudo apt-get update && sudo apt-get install -y "$1"
    else
        echo "✅ $1 is already installed."
    fi
}

# Check for essential tools
if [[ "$OSTYPE" == "linux-gnu"* ]]; then
    if [ -f /etc/debian_version ]; then
        install_pkg "curl"
        install_pkg "git"
        install_pkg "jq"
        install_pkg "build-essential"
        install_pkg "docker.io"
        # On modern Ubuntu, docker compose is a plugin included with docker.io or available as docker-compose-v2
        if ! docker compose version &> /dev/null; then
            install_pkg "docker-compose-v2"
        fi
    else
        echo "⚠️  Unsupported Linux distribution. Please ensure curl, git, jq, docker, and docker-compose are installed."
    fi
fi

# Check for Rust
if ! command -v cargo &> /dev/null; then
    echo "🔧 Installing Rust..."
    curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
    source $HOME/.cargo/env
else
    echo "✅ Rust (Cargo) is already installed."
fi

# Check for Node.js
if ! command -v node &> /dev/null; then
    echo "🔧 Node.js not found. Installing via NVM..."
    curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
    export NVM_DIR="$HOME/.nvm"
    [ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
    nvm install --lts
else
    echo "✅ Node.js $(node -v) is already installed."
fi

# Check for sqlx-cli
if ! command -v sqlx &> /dev/null; then
    echo "🔧 Installing sqlx-cli..."
    cargo install sqlx-cli --no-default-features --features postgres
else
    echo "✅ sqlx-cli is already installed."
fi

# AI Stack Detection & Installation
echo ""
echo "🤖 Setting up Local AI Stack..."

HAS_NVIDIA=false
if command -v nvidia-smi &> /dev/null; then
    if nvidia-smi -L &> /dev/null; then
        echo "🚀 NVIDIA GPU Detected!"
        HAS_NVIDIA=true
    fi
fi

if [ "$HAS_NVIDIA" = false ] && command -v lspci &> /dev/null; then
    if lspci | grep -i nvidia &> /dev/null; then
        echo "🚀 NVIDIA GPU Detected (lspci)!"
        HAS_NVIDIA=true
    fi
fi

# Ollama Installation
if ! command -v ollama &> /dev/null; then
    echo "🔧 Installing Ollama..."
    curl -fsSL https://ollama.com/install.sh | sh
else
    echo "✅ Ollama is already installed."
fi

# Wait for Ollama to be ready
echo "⏳ Waiting for Ollama server to be ready..."
until curl -s http://localhost:11434/api/tags &> /dev/null; do
    sleep 2
done

# Pre-download models based on hardware
if [ "$HAS_NVIDIA" = true ]; then
    echo "📥 Downloading Llama 3 (optimized for GPU)..."
    ollama pull llama3:8b
else
    echo "📥 Downloading Phi-3 (lighter for CPU)..."
    ollama pull phi3:mini
fi

# 3. Frontend Dependency Installation
echo ""
echo "📦 Installing frontend dependencies..."
for dir in "web/studio" "web/experience"; do
    if [ -d "$dir" ]; then
        echo "🔹 Installing in $dir..."
        (cd "$dir" && npm install)
    fi
done

# 4. Environment Configuration
echo ""
echo "⚙️  Configuring environment..."

if [ ! -f ".env" ]; then
    if [ -f ".env.example" ]; then
        echo "📄 Creating .env from .env.example..."
        cp .env.example .env
    else
        echo "📄 Creating a new .env file..."
        touch .env
    fi
fi

# Function to update or add a variable in .env
update_env() {
    local key=$1
    local default_value=$2
    local prompt_text=$3
    
    # Read current value if it exists
    local current_value=$(grep "^${key}=" .env | cut -d'=' -f2- || echo "")
    local val=${current_value:-$default_value}
    
    read -p "$prompt_text [$val]: " user_val
    user_val=${user_val:-$val}
    
    if grep -q "^${key}=" .env; then
        # Use a temporary file for sed to be safe
        sed -i "s|^${key}=.*|${key}=${user_val}|" .env
    else
        echo "${key}=${user_val}" >> .env
    fi
}

echo "Please provide the following configuration values (Press Enter for default):"
update_env "DATABASE_URL" "postgresql://user:password@localhost:5432/openccb" "Master Database URL"
update_env "CMS_DATABASE_URL" "postgresql://user:password@localhost:5432/openccb_cms" "CMS Database URL"
update_env "LMS_DATABASE_URL" "postgresql://user:password@localhost:5432/openccb_lms" "LMS Database URL"
update_env "NEXT_PUBLIC_CMS_API_URL" "http://localhost:3001" "Studio CMS API URL"
update_env "NEXT_PUBLIC_LMS_API_URL" "http://localhost:3002" "Experience LMS API URL"

echo ""
echo "🛠️  AI Configuration..."
update_env "AI_PROVIDER" "local" "AI Provider (openai | local)"
if [ "$(grep "^AI_PROVIDER=" .env | cut -d'=' -f2)" == "local" ]; then
    update_env "LOCAL_OLLAMA_URL" "http://localhost:11434" "Local Ollama API URL"
    update_env "LOCAL_WHISPER_URL" "http://localhost:8000" "Local Whisper API URL"
    
    default_model="phi3:mini"
    if [ "$HAS_NVIDIA" = true ]; then
        default_model="llama3:8b"
    fi
    update_env "LOCAL_LLM_MODEL" "$default_model" "Local LLM Model"
else
    update_env "OPENAI_API_KEY" "" "OpenAI API Key"
fi

echo "✅ .env configuration updated."

# 5. Database Initialization
echo ""
echo "🐘 Starting database with Docker..."
docker compose up -d db

echo "⏳ Waiting for database to be ready..."
# Better wait using pg_isready if available
if command -v pg_isready &> /dev/null; then
    until pg_isready -h localhost -p 5432 -U user; do
      echo "Still waiting for Postgres..."
      sleep 2
    done
else
    sleep 10
fi

echo "🏗️  Running database setup..."
chmod +x db-mgmt.sh
./db-mgmt.sh setup

# 6. System Initialization
echo ""
echo "👤 Initializing system (Admin account)..."
chmod +x init-system.sh
./init-system.sh

echo ""
echo "===================================================="
echo "        ✨ OpenCCB Installation Complete!"
echo "===================================================="
echo "You can now start the services using 'docker compose up' or by"
echo "running 'npm run dev' inside the frontend directories and"
echo "'cargo run' inside the service directories."
echo ""
echo "Studio:     http://localhost:3000"
echo "Experience: http://localhost:3003"
echo "CMS API:    http://localhost:3001"
echo "LMS API:    http://localhost:3002"
echo "===================================================="
