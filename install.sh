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
echo "        🚀 Bienvenido al Instalador de OpenCCB"
echo "===================================================="
echo ""

# 1. Detección y Clonación
if [ -f "Cargo.toml" ] && [ -d "services" ] && [ -d "web" ]; then
    echo "✅ Proyecto detectado en el directorio actual."
    PROJECT_ROOT=$(pwd)
else
    # Simplificación: assume we are in the project root if the script is running
    # but let's keep a basic check
    if [ -d "openccb" ]; then
        cd openccb
        PROJECT_ROOT=$(pwd)
    else
        echo "⚠️  Por favor, ejecuta este script desde la raíz del repositorio de OpenCCB."
        exit 1
    fi
fi

# 2. Prerequisite Installation
install_pkg() {
    if ! command -v "$1" &> /dev/null; then
        echo "🔧 Instalando $1..."
        sudo apt-get update && sudo apt-get install -y "$1"
    else
        echo "✅ $1 ya está instalado."
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
    echo "🔧 Instalando Rust..."
    curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
    source $HOME/.cargo/env
fi

if ! command -v node &> /dev/null; then
    echo "🔧 Instalando Node.js vía NVM..."
    curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
    export NVM_DIR="$HOME/.nvm"
    [ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
    nvm install --lts
fi

if ! command -v sqlx &> /dev/null; then
    echo "🔧 Instalando sqlx-cli..."
    cargo install sqlx-cli --no-default-features --features postgres
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

# 5. Configuración de IA Remota
echo ""
echo "🔍 Configurando Servicios de IA Remota..."
read -p "Ingrese la URL de Ollama Remoto [http://t-800:11434]: " REMOTE_OLLAMA_URL
REMOTE_OLLAMA_URL=${REMOTE_OLLAMA_URL:-http://t-800:11434}
read -p "Ingrese la URL de Whisper Remoto [http://t-800:9000]: " REMOTE_WHISPER_URL
REMOTE_WHISPER_URL=${REMOTE_WHISPER_URL:-http://t-800:9000}
read -p "Ingrese el nombre del Modelo (en el servidor remoto) [llama3.2:3b]: " LLM_MODEL
LLM_MODEL=${LLM_MODEL:-llama3.2:3b}

update_env "AI_PROVIDER" "local"
update_env "LOCAL_OLLAMA_URL" "$REMOTE_OLLAMA_URL"
update_env "LOCAL_WHISPER_URL" "$REMOTE_WHISPER_URL"
update_env "LOCAL_LLM_MODEL" "$LLM_MODEL"

# AI setup is now purely remote. Skipping local container configuration.

# Solicitar credenciales de DB si no están configuradas
if ! grep -q "DATABASE_URL=" .env || [[ $(grep "DATABASE_URL=" .env | cut -d'=' -f2) == "" ]]; then
    read -p "Ingrese la Contraseña de la Base de Datos [password]: " DB_PASS
    DB_PASS=${DB_PASS:-password}
    update_env "DATABASE_URL" "postgresql://user:${DB_PASS}@localhost:5432/openccb?sslmode=disable"
    update_env "CMS_DATABASE_URL" "postgresql://user:${DB_PASS}@localhost:5432/openccb_cms?sslmode=disable"
    update_env "LMS_DATABASE_URL" "postgresql://user:${DB_PASS}@localhost:5432/openccb_lms?sslmode=disable"
    update_env "JWT_SECRET" "supersecretsecret"
    update_env "NEXT_PUBLIC_CMS_API_URL" "http://localhost:3001"
    update_env "NEXT_PUBLIC_LMS_API_URL" "http://localhost:3002"
fi

# 5. Configuración de Pila de IA (Omitido - usando remoto)
echo "🌐 Usando servicios de IA remotos en $REMOTE_OLLAMA_URL y $REMOTE_WHISPER_URL"

# 6. Inicialización de la Base de Datos
echo ""
read -p "¿Desea una instalación LIMPIA? (Esto ELIMINARÁ todos los datos existentes) [y/N]: " CLEAN_INSTALL
if [[ "$CLEAN_INSTALL" =~ ^[Yy]$ ]]; then
    echo "🐘 Reseteando la base de datos para una instalación limpia..."
    sudo docker compose down -v || true
fi

echo "🐘 Iniciando base de datos con Docker..."
sudo docker compose up -d db

echo "⏳ Esperando a que la base de datos esté lista (contenedor)..."
RETRIES=30
until sudo docker exec openccb-db-1 pg_isready -U user &> /dev/null || [ $RETRIES -eq 0 ]; do
  echo -n "."
  sleep 1
  RETRIES=$((RETRIES-1))
done
echo ""

echo "⏳ Esperando al puerto de la base de datos (host)..."
RETRIES=10
until curl -s localhost:5432 &> /dev/null || [ $RETRIES -eq 0 ]; do
  echo -n "+"
  sleep 1
  RETRIES=$((RETRIES-1))
done
echo ""

if [ $RETRIES -eq 0 ]; then
    echo "⚠️  Tiempo de espera agotado para el puerto del host, pero continuando..."
fi

# Extra buffer for PostgreSQL initialization
sleep 2

CMS_URL=$(grep "CMS_DATABASE_URL=" .env | cut -d'=' -f2-)
LMS_URL=$(grep "LMS_DATABASE_URL=" .env | cut -d'=' -f2-)

echo "🏗️  Creando bases de datos y ejecutando migraciones..."
DATABASE_URL=$CMS_URL sqlx database create || true
DATABASE_URL=$LMS_URL sqlx database create || true
DATABASE_URL=$CMS_URL sqlx migrate run --source services/cms-service/migrations
DATABASE_URL=$LMS_URL sqlx migrate run --source services/lms-service/migrations

# 7. System Initialization (Integrated init-system.sh)
echo ""
echo "🔍 Buscando administrador existente..."
ADMIN_EXISTS=$(sudo docker exec openccb-db-1 psql -U user -d openccb_cms -t -c "SELECT EXISTS (SELECT 1 FROM users WHERE role = 'admin');" | xargs 2>/dev/null || echo "f")

if [ "$ADMIN_EXISTS" != "t" ]; then
    echo "👤 Configurar Administrador Inicial"
    read -p "Nombre Completo [Administrador del Sistema]: " ADMIN_NAME
    ADMIN_NAME=${ADMIN_NAME:-Administrador del Sistema}
    read -p "Email del Administrador [admin@example.com]: " ADMIN_EMAIL
    ADMIN_EMAIL=${ADMIN_EMAIL:-admin@example.com}
    read -s -p "Contraseña del Administrador [password123]: " ADMIN_PASS
    ADMIN_PASS=${ADMIN_PASS:-password123}
    echo ""
    ORG_NAME="Organización por Defecto"
fi

echo ""
echo "🚀 Iniciando todos los servicios..."
sudo docker compose up -d --build

if [ "$ADMIN_EXISTS" != "t" ]; then
    echo "⏳ Esperando a que el API CMS esté listo..."
    API_URL="http://localhost:3001"
    START_WAIT=$SECONDS
    PAYLOAD=$(cat <<EOF
{
  "email": "$ADMIN_EMAIL",
  "password": "$ADMIN_PASS",
  "full_name": "$ADMIN_NAME",
  "organization_name": "$ORG_NAME",
  "role": "admin"
}
EOF
)

    RESPONSE=$(curl -s -X POST "$API_URL/auth/register" -H "Content-Type: application/json" -d "$PAYLOAD")

    if echo "$RESPONSE" | grep -q "token"; then
        echo "✅ ¡Éxito! Administrador creado."
        # Generate and show initial API Key
        API_KEY=$(sudo docker exec openccb-db-1 psql -U user -d openccb_cms -t -c "SELECT api_key FROM organizations WHERE name = 'Organización por Defecto' LIMIT 1;" | xargs)
        echo "🔑 API Key Inicial: $API_KEY"
    else
        echo "⚠️  Fallo al crear el administrador."
    fi
else
    echo "✅ El administrador ya existe. Saltando registro."
fi

echo ""
echo "===================================================="
echo "        ✨ ¡Instalación de OpenCCB Completa!"
echo "===================================================="
echo "Studio (Admin/CMS): http://localhost:3000"
echo "Experience (LMS):   http://localhost:3003"
echo "===================================================="
