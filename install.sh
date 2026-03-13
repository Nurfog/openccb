#!/bin/bash

# OpenCCB Unified Installation Script
# This script automates the setup of OpenCCB:
# 1. Prerequisite checks (Rust, Node.js, Docker, sqlx-cli)
# 2. Hardware detection (NVIDIA GPU vs CPU)
# 3. Environment configuration (.env)
# 4. Database creation and migrations (CMS, LMS, AI Bridge)
# 5. System initialization (Admin account and Organization)
# Version: 1.5 - AI Marketing & High-Res Support

set -e

echo "===================================================="
echo "      🚀 Bienvenido al Instalador de OpenCCB v1.5"
echo "    (Edición Marketing & Imágenes de Alta Resolución)"
echo "===================================================="
echo ""

# Parse arguments
FAST_MODE="false"
for arg in "$@"; do
    if [ "$arg" == "--fast" ]; then
        FAST_MODE="true"
    fi
done

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

if [ "$FAST_MODE" == "false" ]; then
    # 2. Prerequisite Installation
    install_pkg() {
        if ! command -v "$1" &> /dev/null; then
            echo "🔧 Instalando $1..."
            apt-get update && apt-get install -y "$1"
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

# 5. Configuración de Entorno (Dev/Prod)
echo ""
echo "🌍 Selección de Entorno"
read -p "¿Es un entorno de DESARROLLO o PRODUCCIÓN? [dev/prod]: " ENV_CHOICE
ENV_CHOICE=$(echo "$ENV_CHOICE" | tr '[:upper:]' '[:lower:]')
ENV_CHOICE=${ENV_CHOICE:-prod}
update_env "ENVIRONMENT" "$ENV_CHOICE"

# 6. Configuración de IA Remota
echo ""
echo "🔍 Configurando Servicios de IA Remota ($ENV_CHOICE)..."

if [ "$ENV_CHOICE" == "dev" ]; then
    DEFAULT_OLLAMA="http://t-800:11434"
    DEFAULT_WHISPER="http://t-800:9000"
else
    DEFAULT_OLLAMA="http://t-800.norteamericano.cl:11434"
    DEFAULT_WHISPER="http://t-800.norteamericano.cl:9000"
fi

read -p "Ingrese la URL de Ollama Remoto [$DEFAULT_OLLAMA]: " REMOTE_OLLAMA_URL
REMOTE_OLLAMA_URL=${REMOTE_OLLAMA_URL:-$DEFAULT_OLLAMA}
read -p "Ingrese la URL de Whisper Remoto [$DEFAULT_WHISPER]: " REMOTE_WHISPER_URL
REMOTE_WHISPER_URL=${REMOTE_WHISPER_URL:-$DEFAULT_WHISPER}
read -p "Ingrese la URL del Image Bridge Remoto [http://t-800:8080]: " REMOTE_IMAGE_URL
REMOTE_IMAGE_URL=${REMOTE_IMAGE_URL:-"http://t-800:8080"}
read -p "Ingrese el nombre del Modelo (en el servidor remoto) [llama3.2:3b]: " LLM_MODEL
LLM_MODEL=${LLM_MODEL:-llama3.2:3b}

update_env "AI_PROVIDER" "local"
update_env "LOCAL_LLM_MODEL" "$LLM_MODEL"
update_env "LOCAL_VIDEO_BRIDGE_URL" "$REMOTE_IMAGE_URL"

if [ "$ENV_CHOICE" == "dev" ]; then
    update_env "DEV_OLLAMA_URL" "$REMOTE_OLLAMA_URL"
    update_env "DEV_WHISPER_URL" "$REMOTE_WHISPER_URL"
    # Portavilidad: set base URLs too
    update_env "LOCAL_OLLAMA_URL" "$REMOTE_OLLAMA_URL"
    update_env "LOCAL_WHISPER_URL" "$REMOTE_WHISPER_URL"
else
    update_env "PROD_OLLAMA_URL" "$REMOTE_OLLAMA_URL"
    update_env "PROD_WHISPER_URL" "$REMOTE_WHISPER_URL"
    # Portavilidad: set base URLs too
    update_env "LOCAL_OLLAMA_URL" "$REMOTE_OLLAMA_URL"
    update_env "LOCAL_WHISPER_URL" "$REMOTE_WHISPER_URL"
fi

# 6.5 Configuración de Base de Datos Externa (para bridges remotos)
echo ""
echo "🔌 Configuración de Base de Datos para Bridge Remoto"
echo "Si el equipo t-800 necesita reportar progreso, debe conocer la IP de este servidor."
SERVER_IP=$(ip -4 -o addr show | awk '{print $4}' | cut -d/ -f1 | grep -v '127.0.0.1' | head -n 1)
DEFAULT_BRIDGE_DB="postgresql://user:${DB_PASS:-password}@${SERVER_IP}:5432/openccb_cms?sslmode=disable"
read -p "Ingrese la URL de la DB que verá el Bridge Remoto [$DEFAULT_BRIDGE_DB]: " BRIDGE_DB_URL
BRIDGE_DB_URL=${BRIDGE_DB_URL:-$DEFAULT_BRIDGE_DB}
update_env "BRIDGE_DATABASE_URL" "$BRIDGE_DB_URL"

# AI setup is now purely remote. Skipping local container configuration.

# Solicitar credenciales de DB si no están configuradas
if ! grep -q "DATABASE_URL=" .env || [[ $(grep "DATABASE_URL=" .env | cut -d'=' -f2) == "" ]]; then
    read -p "Ingrese la Contraseña de la Base de Datos [password]: " DB_PASS
    DB_PASS=${DB_PASS:-password}
    update_env "DATABASE_URL" "postgresql://user:${DB_PASS}@localhost:5433/openccb?sslmode=disable"
    update_env "CMS_DATABASE_URL" "postgresql://user:${DB_PASS}@localhost:5433/openccb_cms?sslmode=disable"
    update_env "LMS_DATABASE_URL" "postgresql://user:${DB_PASS}@localhost:5433/openccb_lms?sslmode=disable"
    update_env "JWT_SECRET" "supersecretsecret"
    update_env "NEXT_PUBLIC_CMS_API_URL" "http://localhost:3001"
    update_env "NEXT_PUBLIC_LMS_API_URL" "http://localhost:3003"
    update_env "DEFAULT_ORG_NAME" "OpenCCB"
    update_env "DEFAULT_PLATFORM_NAME" "OpenCCB Learning"
    update_env "DEFAULT_LOGO_URL" ""
    update_env "DEFAULT_FAVICON_URL" ""
    update_env "DEFAULT_PRIMARY_COLOR" "#3B82F6"
    update_env "DEFAULT_SECONDARY_COLOR" "#8B5CF6"
fi

# 5. Configuración de Pila de IA (Omitido - usando remoto)
echo "🌐 Usando servicios de IA remotos en $REMOTE_OLLAMA_URL y $REMOTE_WHISPER_URL"

# 6. Inicialización de la Base de Datos
echo ""
read -p "¿Desea una instalación LIMPIA? (Esto ELIMINARÁ todos los datos existentes) [y/N]: " CLEAN_INSTALL
if [[ "$CLEAN_INSTALL" =~ ^[Yy]$ ]]; then
    echo "🐘 Reseteando la base de datos para una instalación limpia..."
    docker compose down -v || true
fi

echo "🐘 Iniciando base de datos con Docker..."
docker compose up -d db

echo "⏳ Esperando a que la base de datos esté lista (contenedor)..."
RETRIES=30
until docker exec openccb-db-1 pg_isready -U user &> /dev/null || [ $RETRIES -eq 0 ]; do
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

echo "🏗️  Creando bases de datos CMS y LMS..."
docker exec openccb-db-1 psql -U user -d openccb -c "CREATE DATABASE openccb_cms;" || true
docker exec openccb-db-1 psql -U user -d openccb -c "CREATE DATABASE openccb_lms;" || true

CMS_URL=$(grep "CMS_DATABASE_URL=" .env | cut -d'=' -f2-)
LMS_URL=$(grep "LMS_DATABASE_URL=" .env | cut -d'=' -f2-)

echo "🏗️  Ejecutando migraciones..."
DATABASE_URL=$CMS_URL sqlx migrate run --source services/cms-service/migrations
DATABASE_URL=$LMS_URL sqlx migrate run --source services/lms-service/migrations

# 7. System Initialization (Integrated init-system.sh)
echo ""
echo "🔍 Buscando administrador existente..."
ADMIN_EXISTS=$(docker exec openccb-db-1 psql -U user -d openccb_cms -t -c "SELECT EXISTS (SELECT 1 FROM users WHERE role = 'admin');" | xargs 2>/dev/null || echo "f")

if [ "$ADMIN_EXISTS" != "t" ]; then
    echo "👤 Configurar Administrador Inicial"
    read -p "Nombre Completo [Administrador del Sistema]: " ADMIN_NAME
    ADMIN_NAME=${ADMIN_NAME:-Administrador del Sistema}
    read -p "Email del Administrador [admin@norteamericano.cl]: " ADMIN_EMAIL
    ADMIN_EMAIL=${ADMIN_EMAIL:-admin@norteamericano.cl}
    read -s -p "Contraseña del Administrador [Admin123!]: " ADMIN_PASS
    ADMIN_PASS=${ADMIN_PASS:-Admin123!}
    echo ""
    read -p "Nombre de la Organización [Norteamericano]: " ORG_NAME
    ORG_NAME=${ORG_NAME:-Norteamericano}
fi

# Selective Build/Rebuild
if [ "$FAST_MODE" == "true" ]; then
    echo "⚡ Modo FAST activado. Saltando comprobaciones y reconstrucción de imágenes."
    docker compose up -d
else
    echo ""
    read -p "¿Desea RECONSTRUIR las imágenes de Docker? (Recomendado si hay cambios de código) [y/N]: " REBUILD_CHOICE
    if [[ "$REBUILD_CHOICE" =~ ^[Yy]$ ]]; then
        echo "🚀 Reconstruyendo e iniciando servicios..."
        docker compose up -d --build
    else
        echo "🚀 Iniciando servicios (sin reconstruir)..."
        docker compose up -d
    fi
fi

if [ "$ADMIN_EXISTS" != "t" ]; then
    echo "⏳ Esperando a que el API CMS esté listo..."
    API_URL="http://localhost:3001"

    # Wait until the API actually responds (not just the port being open)
    MAX_RETRIES=30
    count=0
    echo -n "Esperando API"
    until curl -s -o /dev/null "$API_URL/health" 2>/dev/null; do
        echo -n "."
        sleep 2
        count=$((count+1))
        if [ $count -ge $MAX_RETRIES ]; then
            echo ""
            echo "⚠️  Tiempo de espera agotado. El API no respondió."
            break
        fi
    done
    echo ""

    # Create admin user directly in database using pgcrypto
    echo "🔐 Creando administrador en la base de datos..."
    docker exec openccb-db-1 psql -U user -d openccb_cms -c "
        CREATE EXTENSION IF NOT EXISTS pgcrypto;
        SELECT * FROM fn_register_user(
            '$ADMIN_EMAIL',
            crypt('$ADMIN_PASS', gen_salt('bf', 12)),
            '$ADMIN_NAME',
            'admin',
            '$ORG_NAME'
        );
    " 2>/dev/null

    if [ $? -eq 0 ]; then
        echo "✅ ¡Éxito! Administrador creado."
        API_KEY=$(docker exec openccb-db-1 psql -U user -d openccb_cms -t -c "SELECT api_key FROM organizations LIMIT 1;" | xargs 2>/dev/null)
        echo "🔑 API Key Inicial: $API_KEY"
        echo ""
        echo "📋 Credenciales de acceso:"
        echo "   Email: $ADMIN_EMAIL"
        echo "   Contraseña: $ADMIN_PASS"
    else
        echo "⚠️  Fallo al crear el administrador. Intentando con método alternativo..."

        # Fallback: Try API endpoint
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
            echo "✅ ¡Éxito! Administrador creado vía API."
            API_KEY=$(docker exec openccb-db-1 psql -U user -d openccb_cms -t -c "SELECT api_key FROM organizations LIMIT 1;" | xargs 2>/dev/null)
            echo "🔑 API Key Inicial: $API_KEY"
        else
            echo "⚠️  Fallo al crear el administrador. Respuesta: $RESPONSE"
        fi
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
echo ""
echo "📋 Notas:"
echo "   - Rate limiter: DESHABILITADO (problemas de compatibilidad)"
echo "   - Para producción, configura tower_governor en services/cms-service/src/main.rs"
echo "===================================================="
