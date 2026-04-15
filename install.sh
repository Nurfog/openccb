#!/bin/bash

# OpenCCB Local Development Setup
# Levanta el stack completo en local usando Docker:
#   - PostgreSQL en localhost:5433
#   - CMS API en localhost:3001
#   - Studio (Next.js) en localhost:3000
#   - LMS API en localhost:3002
#   - Experience (Next.js) en localhost:3003
#
# Uso: ./install.sh [--fast] [--clean]
#   --fast   Salta instalación de dependencias del sistema
#   --clean  Elimina volúmenes de DB antes de iniciar (instalación limpia)

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# ============================================================================
# PARÁMETROS LOCALES (no editar — se derivan del docker-compose.local.yml)
# ============================================================================
LOCAL_DB_PORT="5432"
LOCAL_DB_USER="user"
LOCAL_DB_PASS="password"
LOCAL_CMS_URL="http://localhost:3001"
LOCAL_LMS_URL="http://localhost:3002/lms-api"
LOCAL_STUDIO_DOMAIN="localhost"
LOCAL_LEARNING_DOMAIN="localhost"
DB_CONTAINER="openccb-db"
COMPOSE_LOCAL="docker compose -f docker-compose.yml -f docker-compose.local.yml"
# ============================================================================

echo "===================================================="
echo "      🚀 Bienvenido al Instalador de OpenCCB v3.0"
echo "    (Con Búsqueda Semántica PGVector + Deploy)"
echo "===================================================="
echo ""

# Parse arguments
FAST_MODE="false"
DEPLOY_MODE="false"
for arg in "$@"; do
    if [ "$arg" == "--fast" ]; then
        FAST_MODE="true"
    elif [ "$arg" == "--deploy" ]; then
        DEPLOY_MODE="true"
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
            install_pkg "pandoc"
            install_pkg "texlive-xetex"
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

# 6. Configuración de IA Remota (Automática según entorno)
echo ""
echo "🔍 Configurando Servicios de IA Remota ($ENV_CHOICE)..."

# Configuración automática según entorno
if [ "$ENV_CHOICE" == "dev" ]; then
    DEFAULT_OLLAMA="http://t-800:11434"
    DEFAULT_WHISPER="http://t-800:9000"
    DEFAULT_IMAGE="http://t-800:8080"
    echo "   ✅ Entorno de DESARROLLO detectado"
else
    DEFAULT_OLLAMA="http://t-800.norteamericano.cl:11434"
    DEFAULT_WHISPER="http://t-800.norteamericano.cl:9000"
    DEFAULT_IMAGE="http://t-800.norteamericano.cl:8080"
    echo "   ✅ Entorno de PRODUCCIÓN detectado"
fi

# Configurar con valores por defecto (sin preguntar)
REMOTE_OLLAMA_URL="$DEFAULT_OLLAMA"
REMOTE_WHISPER_URL="$DEFAULT_WHISPER"
REMOTE_IMAGE_URL="$DEFAULT_IMAGE"
LLM_MODEL="llama3.2:3b"
EMBEDDING_MODEL="nomic-embed-text"

echo "   🤖 Ollama: $REMOTE_OLLAMA_URL"
echo "   🎤 Whisper: $REMOTE_WHISPER_URL"
echo "   🖼️  Image Bridge: $REMOTE_IMAGE_URL"
echo "   🧠 Modelo LLM: $LLM_MODEL"
echo "   📊 Embeddings: $EMBEDDING_MODEL"

update_env "AI_PROVIDER" "local"
update_env "LOCAL_LLM_MODEL" "$LLM_MODEL"
update_env "LOCAL_VIDEO_BRIDGE_URL" "$REMOTE_IMAGE_URL"
update_env "EMBEDDING_MODEL" "$EMBEDDING_MODEL"
update_env "DEV_OLLAMA_URL" "$REMOTE_OLLAMA_URL"
update_env "DEV_WHISPER_URL" "$REMOTE_WHISPER_URL"
update_env "PROD_OLLAMA_URL" "$REMOTE_OLLAMA_URL"
update_env "PROD_WHISPER_URL" "$REMOTE_WHISPER_URL"
update_env "LOCAL_OLLAMA_URL" "$REMOTE_OLLAMA_URL"
update_env "LOCAL_WHISPER_URL" "$REMOTE_WHISPER_URL"

# Configuración SAM (opcional)
echo ""
echo "🔌 Configuración de Integración SAM"
read -p "¿Desea configurar la conexión a la base de datos SAM? [y/N]: " CONFIGURE_SAM
if [[ "$CONFIGURE_SAM" =~ ^[Yy]$ ]]; then
    read -p "Ingrese SAM_DATABASE_URL []: " SAM_DB_URL
    SAM_DB_URL=${SAM_DB_URL:-""}
    if [ -n "$SAM_DB_URL" ]; then
        update_env "SAM_DATABASE_URL" "$SAM_DB_URL"
        echo "   ✅ SAM_DATABASE_URL configurada"
    fi
else
    echo "   ℹ️  SAM no configurado. Puede configurarlo luego en .env"
fi

# Solicitar credenciales de DB si no están configuradas
if ! grep -q "DATABASE_URL=" .env || [[ $(grep "DATABASE_URL=" .env | cut -d'=' -f2) == "" ]]; then
    read -p "Ingrese la Contraseña de la Base de Datos [password]: " DB_PASS
    DB_PASS=${DB_PASS:-password}
    # Usar puerto 5434 (5432 y 5433 ya están en uso)
    update_env "DATABASE_URL" "postgresql://user:${DB_PASS}@localhost:5434/openccb?sslmode=disable"
    update_env "CMS_DATABASE_URL" "postgresql://user:${DB_PASS}@localhost:5434/openccb_cms?sslmode=disable"
    update_env "LMS_DATABASE_URL" "postgresql://user:${DB_PASS}@localhost:5434/openccb_lms?sslmode=disable"
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
echo "🔌 Configuración de Base de Datos"
echo "   Puerto: 5433 (PostgreSQL existente)"
echo ""

# Preguntar si PostgreSQL ya está corriendo (producción)
read -p "¿PostgreSQL ya está corriendo en un contenedor? [y/N]: " DB_EXISTS
DB_EXISTS=${DB_EXISTS:-N}

if [[ ! "$DB_EXISTS" =~ ^[Yy]$ ]]; then
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
    until curl -s localhost:5433 &> /dev/null || [ $RETRIES -eq 0 ]; do
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
    docker exec openccb-db-1 psql -U user -d postgres -c "CREATE DATABASE openccb_cms;" || true
    docker exec openccb-db-1 psql -U user -d postgres -c "CREATE DATABASE openccb_lms;" || true
else
    echo "✅ PostgreSQL ya está corriendo. Saltando inicio del contenedor."
    echo "   Verificando conexión al puerto 5433..."
    sleep 2
fi

CMS_URL=$(grep "CMS_DATABASE_URL=" .env | cut -d'=' -f2-)
LMS_URL=$(grep "LMS_DATABASE_URL=" .env | cut -d'=' -f2-)

echo "🏗️  Ejecutando migraciones..."
DATABASE_URL=$CMS_URL sqlx migrate run --source services/cms-service/migrations
DATABASE_URL=$LMS_URL sqlx migrate run --source services/lms-service/migrations

# PGVector: Generate embeddings for existing data
echo ""
echo "🧠 Configurando PGVector y Embeddings..."
echo "   - Extensión vector instalada en ambas bases de datos"
echo "   - Índices IVFFlat creados para búsqueda rápida"
echo "   - Funciones de similitud y diversidad disponibles"
echo ""
echo "⚠️  Nota: Los embeddings se generarán automáticamente cuando:"
echo "   - Importes preguntas desde MySQL"
echo "   - Generes preguntas con IA (RAG)"
echo "   - Ejecutes: curl -X POST http://localhost:3001/question-bank/embeddings/generate"
echo ""

# Pull embedding model if Ollama is available locally
if curl -s http://localhost:11434/api/tags &> /dev/null; then
    echo "📥 Verificando modelo de embeddings en Ollama local..."
    if ! curl -s http://localhost:11434/api/tags | grep -q "nomic-embed-text"; then
        echo "🔽 Descargando modelo nomic-embed-text..."
        docker exec -it ollama ollama pull nomic-embed-text || echo "⚠️  No se pudo descargar el modelo. Se usará el servidor remoto."
    else
        echo "✅ Modelo de embeddings ya disponible"
    fi
else
    echo "ℹ️  Ollama local no detectado. Se usará el servidor remoto: $REMOTE_OLLAMA_URL"
fi

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
echo "   - PGVector: Habilitado para búsqueda semántica"
echo "   - Embeddings: Usando modelo '$EMBEDDING_MODEL'"
echo ""
echo "🔗 Comandos Útiles:"
echo "   # Generar embeddings para preguntas existentes"
echo "   curl -X POST http://localhost:3001/question-bank/embeddings/generate -H \"Authorization: Bearer TOKEN\""
echo ""
echo "   # Búsqueda semántica de preguntas"
echo "   curl -G \"http://localhost:3001/question-bank/semantic-search?query=past+tense\""
echo ""
echo "   # Detectar preguntas duplicadas"
echo "   curl -G \"http://localhost:3001/question-bank/similar/{id}?threshold=0.95\""
echo "===================================================="

# ============================================================================
# MODO DESPLIEGUE (PRODUCCIÓN)
# ============================================================================
if [ "$DEPLOY_MODE" == "true" ]; then
    echo ""
    echo "===================================================="
    echo "        🚀 Modo de Despliegue Activado"
    echo "===================================================="
    echo ""
    echo "ℹ️  El despliegue remoto se maneja mediante deploy.sh"
    echo ""
    echo "📋 Ejecutando: ./deploy.sh"
    echo ""
    
    # Verificar que existe deploy.sh
    if [ ! -f "$SCRIPT_DIR/deploy.sh" ]; then
        echo "❌ ERROR: No se encontró deploy.sh"
        echo ""
        echo "Asegúrate de que deploy.sh esté en el mismo directorio que install.sh"
        exit 1
    fi
    
    # Ejecutar deploy.sh
    exec "$SCRIPT_DIR/deploy.sh"
fi
