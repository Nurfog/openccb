#!/bin/bash

# OpenCCB Unified Deployment Script
# Despliegue automático en AWS EC2 con SSL (Let's Encrypt)
# Servidor: ec2-18-118-158-99.us-east-2.compute.amazonaws.com
# Dominios: studio.norteamericano.com, learning.norteamericano.com

set -e

echo "===================================================="
echo "        🚀 OpenCCB Deployment Tool"
echo "===================================================="
echo ""

# Guardrail: deploy.sh es SOLO para producción
if [ -f ".env" ]; then
    CURRENT_ENV=$(grep '^ENVIRONMENT=' .env | cut -d'=' -f2- | tr '[:upper:]' '[:lower:]' | xargs)
    if [ "$CURRENT_ENV" = "dev" ]; then
        echo "❌ ERROR: deploy.sh está configurado para PRODUCCIÓN y detectó ENVIRONMENT=dev en .env"
        echo "   - Usa ./install.sh para entorno local"
        echo "   - Ajusta .env a ENVIRONMENT=prod antes de desplegar"
        exit 1
    fi
fi

# ============================================================================
# CONFIGURACIÓN
# ============================================================================
PEM_PATH="ubuntu.pem"
REMOTE_USER="ubuntu"
REMOTE_HOST="ec2-18-118-158-99.us-east-2.compute.amazonaws.com"
REMOTE_PATH="/var/www/openccb"
# Cambiar a "false" para usar Let's Encrypt production (solo después de rate limits)
LETSENCRYPT_STAGING="true"
# Repositorio de Git
GIT_REPO="https://github.com/Nurfog/learningccb.git"
# ============================================================================

# Cargar dominios desde .env si existen, con valores por defecto
if [ -f ".env" ]; then
    _STUDIO_DOMAIN=$(grep '^NEXT_PUBLIC_STUDIO_DOMAIN=' .env | cut -d'=' -f2)
    _LEARNING_DOMAIN=$(grep '^NEXT_PUBLIC_LEARNING_DOMAIN=' .env | cut -d'=' -f2)
fi
STUDIO_DOMAIN="${_STUDIO_DOMAIN:-studio.norteamericano.com}"
LEARNING_DOMAIN="${_LEARNING_DOMAIN:-learning.norteamericano.com}"

# Si PEM_PATH es relativo, convertirlo a absoluto
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
if [[ "$PEM_PATH" != /* ]]; then
    PEM_PATH="$SCRIPT_DIR/$PEM_PATH"
fi

# Verificar que existe el archivo PEM
if [ ! -f "$PEM_PATH" ]; then
    echo "❌ ERROR: No se encontró el archivo $PEM_PATH"
    echo ""
    echo "Verifica la ruta de la llave SSH"
    exit 1
fi

echo "✅ Configuración cargada exitosamente"
echo ""
echo "📋 Configuración de despliegue:"
echo "   👤 Usuario: $REMOTE_USER"
echo "   🖥️  Host: $REMOTE_HOST"
echo "   📁 Destino: $REMOTE_PATH"
echo "   🔑 SSH Key: $PEM_PATH"
echo ""

echo ""
echo "----------------------------------------"
echo "Dónde compilar las imágenes Docker"
echo "----------------------------------------"
echo ""
echo "¿Compilar imágenes en esta máquina y enviar al servidor?"
echo "  - local: Compilar aquí y transferir vía SSH (recomendado)"
echo "  - remote: El servidor compila (más lento)"
echo ""
read -p "¿Compilar localmente? [Y/n]: " BUILD_LOCAL_CHOICE
BUILD_LOCAL_CHOICE=${BUILD_LOCAL_CHOICE:-Y}
if [[ "$BUILD_LOCAL_CHOICE" =~ ^[Yy]$ ]]; then
    BUILD_LOCAL="true"
    echo "✅ Compilación local - imágenes se streamearan via SSH"
else
    BUILD_LOCAL="false"
    echo "✅ El servidor compilará las imágenes"
fi

# Preguntar si continuar
read -p "¿Desea continuar con el despliegue? [y/N]: " CONFIRM
if [[ ! "$CONFIRM" =~ ^[Yy]$ ]]; then
    echo "❌ Despliegue cancelado"
    exit 0
fi

echo ""
echo "📦 Preparando archivos para producción..."

# Crear directorio temporal
PROD_DIR="./.deploy-temp-$$"
mkdir -p "$PROD_DIR"

# Asegurar limpieza al finalizar
cleanup() {
    rm -rf "$PROD_DIR"
}
trap cleanup EXIT

# Copiar archivos esenciales
echo "   📋 Copiando archivos esenciales..."
cp -r docker-compose.yml "$PROD_DIR/" 2>/dev/null || echo "   ⚠️  docker-compose.yml no existe"
# Usar .env local como fuente de verdad para producción (si existe)
if [ -f ".env" ]; then
    cp .env "$PROD_DIR/.env"
    echo "   ✅ .env local copiado (fuente de producción)"
else
    echo "   ⚠️  .env local no existe; se usará .env.example como fallback"
fi
# .env.example se mantiene como plantilla/documentación
cp -r .env.example "$PROD_DIR/" 2>/dev/null || true

# NO copiar ubuntu.pem - solo se usa localmente para SSH
echo "   ℹ️  ubuntu.pem NO se copia - solo para SSH local"

# Copiar servicios excluyendo target/ y node_modules/
echo "   - Copiando services/..."
mkdir -p "$PROD_DIR/services"
find services -type f \
    ! -path "*/target/*" \
    ! -path "*/node_modules/*" \
    -exec cp --parents {} "$PROD_DIR/" \; 2>/dev/null || true

# Copiar shared excluyendo target/ y node_modules/
echo "   - Copiando shared/..."
mkdir -p "$PROD_DIR/shared"
find shared -type f \
    ! -path "*/target/*" \
    ! -path "*/node_modules/*" \
    -exec cp --parents {} "$PROD_DIR/" \; 2>/dev/null || true

# Copiar web excluyendo .next/ y node_modules/
echo "   - Copiando web/..."
mkdir -p "$PROD_DIR/web"
find web -type f \
    ! -path "*/.next/*" \
    ! -path "*/node_modules/*" \
    -exec cp --parents {} "$PROD_DIR/" \; 2>/dev/null || true

# Copiar archivos root
cp -r Cargo.toml "$PROD_DIR/" 2>/dev/null || true
cp -r Cargo.lock "$PROD_DIR/" 2>/dev/null || true

# Copiar configuración de nginx
mkdir -p "$PROD_DIR/nginx"
if [ -f "nginx/proxy.conf" ]; then
    cp nginx/proxy.conf "$PROD_DIR/nginx/"
fi
if [ -f "nginx/studio.conf" ]; then
    cp nginx/studio.conf "$PROD_DIR/nginx/"
fi

echo "   ✅ Archivos esenciales copiados"

# Contar archivos
FILE_COUNT=$(find "$PROD_DIR" -type f | wc -l)
TOTAL_SIZE=$(du -sh "$PROD_DIR" | cut -f1)
echo "   ✅ $FILE_COUNT archivos listos ($TOTAL_SIZE)"
echo ""

# Verificar rsync
RSYNC_PATH=$(which rsync 2>/dev/null || echo "")
if [ -z "$RSYNC_PATH" ]; then
    echo "📦 Instalando rsync..."
    if command -v apt-get &> /dev/null; then
        sudo apt-get update -qq && sudo apt-get install -y rsync
    else
        echo "❌ Instala rsync manualmente: sudo apt-get install rsync"
        exit 1
    fi
    RSYNC_PATH=$(which rsync 2>/dev/null || echo "")
fi
echo "✅ rsync encontrado en: $RSYNC_PATH"
echo ""

# Sincronizar con servidor remoto
echo "🌐 Sincronizando con servidor remoto..."

# Verificar conectividad SSH
if ! ssh -i "$PEM_PATH" -o ConnectTimeout=10 -o BatchMode=yes "$REMOTE_USER@$REMOTE_HOST" "echo 'SSH OK'" &> /dev/null; then
    echo "   ❌ ERROR: No se pudo conectar vía SSH"
    echo "   Verifica:"
    echo "   1. Que el archivo $PEM_PATH existe"
    echo "   2. Que los permisos son correctos - chmod 400 $PEM_PATH"
    echo "   3. Que el host $REMOTE_HOST es accesible"
    exit 1
fi
echo "   ✅ SSH conectado exitosamente"
echo ""

# Crear directorio remoto
echo "   📁 Creando directorio remoto..."
ssh -i "$PEM_PATH" "$REMOTE_USER@$REMOTE_HOST" "sudo mkdir -p $REMOTE_PATH && sudo chown $REMOTE_USER:$REMOTE_USER $REMOTE_PATH"

# Sincronizar archivos
echo "   📤 Subiendo archivos con rsync..."
rsync -avz -e "ssh -i $PEM_PATH" \
    --progress \
    --rsync-path="sudo rsync" \
    --exclude 'node_modules' \
    --exclude 'target' \
    --exclude '.next' \
    --exclude '.git' \
    --exclude '.qwen' \
    "$PROD_DIR/" "$REMOTE_USER@$REMOTE_HOST:$REMOTE_PATH"

if [ $? -ne 0 ]; then
    echo "   ❌ ERROR: rsync falló"
    exit 1
fi

rm -rf "$PROD_DIR"
echo ""
echo "✅ Archivos sincronizados exitosamente!"
echo ""

# ============================================================================
# BUILD LOCAL + STREAM AL REMOTO
# ============================================================================
if [ "$BUILD_LOCAL" = "true" ]; then
    echo "========================================"
    echo "   Compilando imágenes localmente"
    echo "========================================"
    echo ""

    # Exportar build args desde .env local
    export NEXT_PUBLIC_CMS_API_URL=$(grep '^NEXT_PUBLIC_CMS_API_URL=' .env | cut -d'=' -f2-)
    export NEXT_PUBLIC_LMS_API_URL=$(grep '^NEXT_PUBLIC_LMS_API_URL=' .env | cut -d'=' -f2-)
    export NEXT_PUBLIC_STUDIO_DOMAIN=$(grep '^NEXT_PUBLIC_STUDIO_DOMAIN=' .env | cut -d'=' -f2-)
    export NEXT_PUBLIC_LEARNING_DOMAIN=$(grep '^NEXT_PUBLIC_LEARNING_DOMAIN=' .env | cut -d'=' -f2-)
    export COMPOSE_PARALLEL_LIMIT=1

    echo "   CMS API URL : $NEXT_PUBLIC_CMS_API_URL"
    echo "   LMS API URL : $NEXT_PUBLIC_LMS_API_URL"
    echo "   Studio      : $NEXT_PUBLIC_STUDIO_DOMAIN"
    echo "   Learning    : $NEXT_PUBLIC_LEARNING_DOMAIN"
    echo ""

    echo "🔨 Compilando imagen studio..."
    docker compose -f docker-compose.yml build --no-cache studio

    echo ""
    echo "🔨 Compilando imagen experience..."
    docker compose -f docker-compose.yml build --no-cache experience

    echo ""
    echo "📤 Transfiriendo studio al servidor (streaming SSH)..."
    docker save openccb-studio | gzip | \
        ssh -i "$PEM_PATH" "$REMOTE_USER@$REMOTE_HOST" "gunzip | sudo docker load"

    echo "📤 Transfiriendo experience al servidor (streaming SSH)..."
    docker save openccb-experience | gzip | \
        ssh -i "$PEM_PATH" "$REMOTE_USER@$REMOTE_HOST" "gunzip | sudo docker load"

    echo ""
    echo "✅ Imágenes transferidas correctamente"
    echo ""
fi

# ============================================================================
# SCRIPT REMOTO PARA GESTIÓN DE CONTENEDORES
# ============================================================================
echo "🔧 Ejecutando gestión de contenedores en remoto..."
echo ""
echo ""

# ============================================================================
# PREGUNTAR DATOS DEL ADMINISTRADOR (LOCAL)
# ============================================================================
echo ""
echo "========================================"
echo "   Configuración del Administrador"
echo "========================================"
echo ""

# Preguntar datos del administrador
read -p "Nombre completo del administrador [Administrador]: " ADMIN_NAME
ADMIN_NAME=${ADMIN_NAME:-Administrador}

read -p "Email del administrador [admin@norteamericano.com]: " ADMIN_EMAIL
ADMIN_EMAIL=${ADMIN_EMAIL:-admin@norteamericano.com}

read -sp "Contraseña del administrador [Admin123!]: " ADMIN_PASS
echo ""
ADMIN_PASS=${ADMIN_PASS:-Admin123!}

read -p "Nombre de la organización [Norteamericano]: " ORG_NAME
ORG_NAME=${ORG_NAME:-Norteamericano}

echo ""
echo "========================================"
echo "   Configuración de Base de Datos"
echo "========================================"
echo ""
echo "¿Qué deseas hacer con la base de datos?"
echo "  1) Mantener datos existentes (recomendado para actualizaciones)"
echo "  2) Reiniciar base de datos (BORRAR todos los datos)"
echo ""
read -p "Opción [1/2]: " DB_OPTION
DB_OPTION=${DB_OPTION:-1}

if [[ "$DB_OPTION" =~ ^[2]$ ]]; then
    RESET_DATABASE="true"
    echo ""
    echo "⚠️  ADVERTENCIA: Se borrarán TODOS los datos de la base de datos"
    read -p "¿Estás seguro de continuar? [y/N]: " CONFIRM_RESET
    if [[ ! "$CONFIRM_RESET" =~ ^[Yy]$ ]]; then
        echo "❌ Operación cancelada - manteniendo base de datos"
        RESET_DATABASE="false"
    else
        echo "✅ Base de datos será reiniciada"
    fi
else
    RESET_DATABASE="false"
    echo "✅ Se mantendrán los datos existentes"
fi

echo ""
echo "----------------------------------------"
echo "Configuración SSL"
echo "----------------------------------------"
echo ""
echo "¿Deseas usar SSL con Let's Encrypt?"
echo "  - SI: Usará HTTPS (recomendado para producción)"
echo "  - NO: Usará HTTP (recomendado para pruebas o si hay rate limits)"
echo ""
read -p "¿Usar SSL? [y/N]: " USE_SSL
USE_SSL=${USE_SSL:-N}

if [[ "$USE_SSL" =~ ^[Yy]$ ]]; then
    echo ""
    echo "----------------------------------------"
    echo "Configuración de Certificados SSL"
    echo "----------------------------------------"
    echo ""
    echo "¿Ya tienes certificados SSL funcionando?"
    echo "  - SI: Preservar certificados existentes (recomendado)"
    echo "  - NO: Generar nuevos certificados"
    echo ""
    read -p "¿Preservar certificados? [y/N]: " PRESERVE_CERTS
    PRESERVE_CERTS=${PRESERVE_CERTS:-Y}
    
    if [[ "$PRESERVE_CERTS" =~ ^[Yy]$ ]]; then
        PRESERVE_SSL_CERTS="true"
        LETSENCRYPT_STAGING="false"
        PROTOCOL="https"
        echo "✅ Se preservarán los certificados SSL existentes"
    else
        PRESERVE_SSL_CERTS="false"
        echo ""
        echo "¿Usar servidor de STAGING (certificados de prueba)?"
        echo "  - SI: Sin rate limits, pero el navegador muestra advertencias"
        echo "  - NO: Certificados reales, pero con rate limits (5 por semana)"
        echo ""
        read -p "¿Usar STAGING? [y/N]: " USE_STAGING
        USE_STAGING=${USE_STAGING:-Y}

        if [[ "$USE_STAGING" =~ ^[Yy]$ ]]; then
            LETSENCRYPT_STAGING="true"
            PROTOCOL="http"
            echo ""
            echo "✅ Configuración: STAGING (HTTP por ahora)"
            echo "   Los certificados de staging no son válidos para producción"
            echo "   Las llamadas API usarán HTTP para evitar errores de SSL"
        else
            LETSENCRYPT_STAGING="false"
            PROTOCOL="https"
            echo ""
            echo "✅ Configuración: PRODUCTION (HTTPS)"
            echo "   Se usarán certificados reales de Let's Encrypt"
        fi
    fi
else
    LETSENCRYPT_STAGING="false"
    PROTOCOL="http"
    PRESERVE_SSL_CERTS="false"
    echo ""
    echo "✅ Configuración: HTTP (sin SSL)"
fi



echo ""
echo "========================================"
echo "   Resumen de Configuración"
echo "========================================"
echo ""
echo "   Nombre: $ADMIN_NAME"
echo "   Email: $ADMIN_EMAIL"
echo "   Organización: $ORG_NAME"
echo "   Protocolo: $PROTOCOL"
echo "   SSL Staging: $LETSENCRYPT_STAGING"
echo "   Preservar SSL: $PRESERVE_SSL_CERTS"
echo "   Reiniciar DB: $RESET_DATABASE"
echo "   Compilar local: $BUILD_LOCAL"

# Detectar variables de integración desde .env local para el resumen
_SAM_URL=$(grep '^SAM_DIAGNOSTICO_DATABASE_URL=' .env | cut -d'=' -f2-)
_MYSQL_URL=$(grep '^MYSQL_DATABASE_URL=' .env | cut -d'=' -f2-)
echo "   SAM Integration: ${_SAM_URL:-(No configurada)}"
echo "   MySQL Legacy: ${_MYSQL_URL:-(No configurada)}"
echo ""

# Crear script remoto en un archivo temporal
cat > /tmp/remote-deploy.sh << REMOTE_SCRIPT_CONTENT
set -e

# Variables pasadas desde el script local
LETSENCRYPT_STAGING=$LETSENCRYPT_STAGING
RESET_DATABASE=$RESET_DATABASE
PRESERVE_SSL_CERTS=$PRESERVE_SSL_CERTS
PROTOCOL=$PROTOCOL
STUDIO_DOMAIN=$STUDIO_DOMAIN
LEARNING_DOMAIN=$LEARNING_DOMAIN
BUILD_LOCAL=$BUILD_LOCAL

cd /var/www/openccb

echo "========================================"
echo "   OpenCCB Remote Deployment"
echo "========================================"
echo ""
echo "Configuración:"
echo "  LETSENCRYPT_STAGING: \$LETSENCRYPT_STAGING"
echo "  RESET_DATABASE: \$RESET_DATABASE"
echo "  PRESERVE_SSL_CERTS: \$PRESERVE_SSL_CERTS"
echo "  PROTOCOL: \$PROTOCOL"
echo ""

# ========================================
# RESOLVER .ENV PARA PRODUCCION
# ========================================
echo "Resolviendo configuracion .env para produccion..."

if [ ! -f ".env" ]; then
    echo "   .env no existe en remoto; creando desde .env.example..."
    if [ -f ".env.example" ]; then
        cp .env.example .env
    else
        touch .env
    fi
else
    echo "   Usando .env existente (valores de produccion)"
fi

# Generar DB_PASSWORD seguro
if ! grep -q "^DB_PASSWORD=" .env || grep -q "^DB_PASSWORD=$" .env || grep -q "CHANGE_ME" .env || grep -q "^DB_PASSWORD=password$" .env; then
    echo "   Generando DB_PASSWORD segura..."
    DB_PASS=\$(openssl rand -base64 32 | tr -dc "a-zA-Z0-9" | head -c 32)
    if grep -q "^DB_PASSWORD=" .env; then
        sed -i "s/^DB_PASSWORD=.*/DB_PASSWORD=\$DB_PASS/" .env
    else
        echo "DB_PASSWORD=\$DB_PASS" >> .env
    fi
fi

# Generar JWT_SECRET seguro
if ! grep -q "^JWT_SECRET=" .env || grep -q "^JWT_SECRET=$" .env || grep -q "CHANGE_ME" .env || grep -q "secret.*2025" .env || grep -q "^JWT_SECRET=supersecret" .env; then
    echo "   Generando JWT_SECRET seguro..."
    JWT_SEC=\$(openssl rand -base64 48 | tr -dc "a-zA-Z0-9" | head -c 64)
    if grep -q "^JWT_SECRET=" .env; then
        sed -i "s/^JWT_SECRET=.*/JWT_SECRET=\$JWT_SEC/" .env
    else
        echo "JWT_SECRET=\$JWT_SEC" >> .env
    fi
fi

# CORREGIR DATABASE_URL para produccion - db:5432
echo "   Configurando DATABASE_URL para Docker..."
DB_PASS=\$(grep "^DB_PASSWORD=" .env | cut -d"=" -f2-)

sed -i "/^CMS_DATABASE_URL=/d" .env 2>/dev/null || true
sed -i "/^LMS_DATABASE_URL=/d" .env 2>/dev/null || true
sed -i "/^DATABASE_URL=/d" .env 2>/dev/null || true

echo "CMS_DATABASE_URL=postgresql://user:\${DB_PASS}@db:5432/openccb_cms" >> .env
echo "LMS_DATABASE_URL=postgresql://user:\${DB_PASS}@db:5432/openccb_lms" >> .env
echo "DATABASE_URL=postgresql://user:\${DB_PASS}@db:5432/openccb_cms" >> .env

# Configurar Let's Encrypt - staging o production
echo "   Configurando Let's Encrypt..."
if [ "$PRESERVE_SSL_CERTS" = "true" ]; then
    echo "   Preservando configuración SSL existente"
    # No modificar LETSENCRYPT_STAGING - mantener el valor existente
    if ! grep -q "^LETSENCRYPT_STAGING=" .env; then
        echo "LETSENCRYPT_STAGING=false" >> .env
    fi
else
    if [ "$LETSENCRYPT_STAGING" = "true" ]; then
        # Remover valor existente si existe
        sed -i "/^LETSENCRYPT_STAGING=/d" .env 2>/dev/null || true
        echo "LETSENCRYPT_STAGING=true" >> .env
        echo "   Usando STAGING - certificados de prueba"
    else
        # Remover valor existente si existe
        sed -i "/^LETSENCRYPT_STAGING=/d" .env 2>/dev/null || true
        echo "LETSENCRYPT_STAGING=false" >> .env
        echo "   Usando PRODUCTION - certificados reales"
    fi
fi

# Configurar URLs de la API para el frontend
echo "   Configurando URLs de la API para el frontend..."
if [ "$PROTOCOL" = "https" ]; then
    CMS_URL="https://$STUDIO_DOMAIN/cms-api"
    LMS_URL="https://$LEARNING_DOMAIN/lms-api"
else
    CMS_URL="http://$STUDIO_DOMAIN/cms-api"
    LMS_URL="http://$LEARNING_DOMAIN/lms-api"
fi

# Remover valores existentes
sed -i "/^NEXT_PUBLIC_CMS_API_URL=/d" .env 2>/dev/null || true
sed -i "/^NEXT_PUBLIC_LMS_API_URL=/d" .env 2>/dev/null || true

# Agregar URLs correctas (sin puertos - nginx proxy maneja el routing)
echo "NEXT_PUBLIC_CMS_API_URL=\$CMS_URL" >> .env
echo "NEXT_PUBLIC_LMS_API_URL=\$LMS_URL" >> .env

# URL interna de CMS para comunicación backend-to-backend (LMS -> CMS)
sed -i "/^CMS_API_URL=/d" .env 2>/dev/null || true
echo "CMS_API_URL=http://studio:3001" >> .env

# Configurar S3 para almacenamiento de audio
if ! grep -q "^ASSETS_STORAGE=" .env || grep -q "^ASSETS_STORAGE=$" .env; then
    sed -i "/^ASSETS_STORAGE=/d" .env 2>/dev/null || true
    echo "ASSETS_STORAGE=s3" >> .env
fi
if ! grep -q "^S3_BUCKET=" .env || grep -q "^S3_BUCKET=$" .env; then
    sed -i "/^S3_BUCKET=/d" .env 2>/dev/null || true
    echo "S3_BUCKET=openccb-802726101181-us-east-2-an" >> .env
fi
if ! grep -q "^AWS_REGION=" .env || grep -q "^AWS_REGION=$" .env; then
    sed -i "/^AWS_REGION=/d" .env 2>/dev/null || true
    echo "AWS_REGION=us-east-2" >> .env
fi
# AWS_ACCESS_KEY_ID y AWS_SECRET_ACCESS_KEY se mantienen si ya existen
if ! grep -q "^AWS_ACCESS_KEY_ID=" .env; then
    echo "AWS_ACCESS_KEY_ID=" >> .env
fi
if ! grep -q "^AWS_SECRET_ACCESS_KEY=" .env; then
    echo "AWS_SECRET_ACCESS_KEY=" >> .env
fi

# Conservar o inicializar variables de integración
echo "   Configurando variables de integración (SAM/MySQL)..."
if ! grep -q "^SAM_DIAGNOSTICO_DATABASE_URL=" .env; then
    echo "SAM_DIAGNOSTICO_DATABASE_URL=" >> .env
fi
if ! grep -q "^MYSQL_DATABASE_URL=" .env; then
    echo "MYSQL_DATABASE_URL=" >> .env
fi

# Asegurar dominios públicos para nginx-proxy y certificados SSL
sed -i "/^NEXT_PUBLIC_STUDIO_DOMAIN=/d" .env 2>/dev/null || true
sed -i "/^NEXT_PUBLIC_LEARNING_DOMAIN=/d" .env 2>/dev/null || true
echo "NEXT_PUBLIC_STUDIO_DOMAIN=\$STUDIO_DOMAIN" >> .env
echo "NEXT_PUBLIC_LEARNING_DOMAIN=\$LEARNING_DOMAIN" >> .env

echo "   URLs configuradas:"
echo "     CMS: \$CMS_URL"
echo "     LMS: \$LMS_URL"
echo "     Studio Domain: \$STUDIO_DOMAIN"
echo "     Learning Domain: \$LEARNING_DOMAIN"
echo ""

# ========================================
# EXPORTAR VARIABLES DE DOMINIO
# ========================================
# CRÍTICO: export explícito para que docker-compose las encuentre
export NEXT_PUBLIC_STUDIO_DOMAIN=\$STUDIO_DOMAIN
export NEXT_PUBLIC_LEARNING_DOMAIN=\$LEARNING_DOMAIN
echo "✅ Variables de dominio exportadas para docker-compose"
echo ""
REMOTE_SCRIPT_CONTENT

# Ahora agregamos la sección de Docker con las variables correctas
cat >> /tmp/remote-deploy.sh << REMOTE_SCRIPT_CONTENT

# ========================================
# ACTUALIZAR DOCKER-COMPOSE.YML SEGUN SSL
# ========================================
echo "Configurando docker-compose.yml para $PROTOCOL..."

# Reemplazar las URLs en docker-compose.yml
if [ "$PROTOCOL" = "https" ]; then
    sed -i 's|NEXT_PUBLIC_CMS_API_URL: http://|NEXT_PUBLIC_CMS_API_URL: https://|g' docker-compose.yml
    sed -i 's|NEXT_PUBLIC_LMS_API_URL: http://|NEXT_PUBLIC_LMS_API_URL: https://|g' docker-compose.yml
    echo "   ✅ URLs actualizadas a HTTPS"
else
    sed -i 's|NEXT_PUBLIC_CMS_API_URL: https://|NEXT_PUBLIC_CMS_API_URL: http://|g' docker-compose.yml
    sed -i 's|NEXT_PUBLIC_LMS_API_URL: https://|NEXT_PUBLIC_LMS_API_URL: http://|g' docker-compose.yml
    echo "   ✅ URLs actualizadas a HTTP"
fi

# Verificar configuración
echo ""
echo "Configuración de URLs en docker-compose.yml:"
grep "NEXT_PUBLIC_" docker-compose.yml | head -10
echo ""

# Verificar que los argumentos de build estén presentes
echo "Verificando argumentos de build..."
if grep -q "NEXT_PUBLIC_CMS_API_URL:" docker-compose.yml && grep -q "NEXT_PUBLIC_LMS_API_URL:" docker-compose.yml; then
    echo "   ✅ Ambos argumentos de build están presentes"
else
    echo "   ⚠️  Faltan argumentos de build, agregando..."
    # Agregar argumentos si faltan
    if ! grep -q "NEXT_PUBLIC_LMS_API_URL:" docker-compose.yml; then
        sed -i "/NEXT_PUBLIC_CMS_API_URL:/a\\        NEXT_PUBLIC_LMS_API_URL: http://$LEARNING_DOMAIN" docker-compose.yml
    fi
fi
echo ""

REMOTE_SCRIPT_CONTENT

# Ahora agregamos la sección de Docker con las variables correctas
cat >> /tmp/remote-deploy.sh << 'REMOTE_SCRIPT_CONTENT'

# ========================================
# VERIFICAR E INSTALAR DOCKER
# ========================================
echo "Verificando requerimientos del sistema..."

command_exists() {
    command -v "$1" &> /dev/null
}

# Docker
echo "Verificando Docker..."
if ! command_exists docker; then
    echo "   Docker no esta instalado, instalando..."
    curl -fsSL https://get.docker.com | sudo sh
    echo "   Docker instalado"
fi

# Verificar permisos de Docker
if docker ps &> /dev/null 2>&1; then
    DOCKER_CMD="docker"
elif sudo docker ps &> /dev/null 2>&1; then
    DOCKER_CMD="sudo docker"
    sudo usermod -aG docker $(whoami) 2>/dev/null || true
else
    echo "   ERROR: No se puede acceder a Docker"
    exit 1
fi

echo "   Usando: $DOCKER_CMD"

# Docker Compose
if ! $DOCKER_CMD compose version &> /dev/null 2>&1; then
    echo "   Instalando Docker Compose..."
    sudo curl -L "https://github.com/docker/compose/releases/download/v2.24.0/docker-compose-$(uname -s)-$(uname -m)" \
        -o /usr/local/bin/docker-compose
    sudo chmod +x /usr/local/bin/docker-compose
    sudo mkdir -p /usr/lib/docker/cli-plugins
    sudo ln -sf /usr/local/bin/docker-compose /usr/lib/docker/cli-plugins/docker-compose 2>/dev/null || true
    echo "   Docker Compose instalado"
fi

# Docker Buildx
echo "Verificando Docker Buildx..."
if ! $DOCKER_CMD buildx version &> /dev/null 2>&1; then
    echo "   Buildx no esta instalado, instalando..."

    # Opcion preferida en Ubuntu/Debian
    if command -v apt-get &> /dev/null; then
        sudo apt-get update -qq || true
        sudo apt-get install -y docker-buildx-plugin &> /dev/null || true
    fi

    # Fallback: descarga binaria oficial
    if ! $DOCKER_CMD buildx version &> /dev/null 2>&1; then
        BUILDX_VERSION="v0.33.0"
        ARCH="$(uname -m)"
        case "$ARCH" in
            x86_64) BUILDX_ARCH="linux-amd64" ;;
            aarch64|arm64) BUILDX_ARCH="linux-arm64" ;;
            *)
                echo "   ERROR: Arquitectura no soportada para instalacion automatica de buildx: $ARCH"
                exit 1
                ;;
        esac

        sudo mkdir -p /usr/lib/docker/cli-plugins
        sudo curl -fsSL "https://github.com/docker/buildx/releases/download/${BUILDX_VERSION}/buildx-${BUILDX_VERSION}.${BUILDX_ARCH}" -o /usr/lib/docker/cli-plugins/docker-buildx
        sudo chmod +x /usr/lib/docker/cli-plugins/docker-buildx
    fi
fi

if ! $DOCKER_CMD buildx version &> /dev/null 2>&1; then
    echo "   ERROR: Buildx no pudo instalarse correctamente"
    exit 1
fi

echo "   Buildx activo: $($DOCKER_CMD buildx version | head -1)"

# Crear/activar builder dedicado para OpenCCB
if ! $DOCKER_CMD buildx inspect openccb-builder &> /dev/null 2>&1; then
    $DOCKER_CMD buildx create --name openccb-builder --driver docker-container --use >/dev/null 2>&1 || true
fi
$DOCKER_CMD buildx use openccb-builder >/dev/null 2>&1 || true
$DOCKER_CMD buildx inspect --bootstrap >/dev/null 2>&1 || true

# Forzar Compose a usar BuildKit/Buildx
export DOCKER_BUILDKIT=1
export COMPOSE_DOCKER_CLI_BUILD=1
export BUILDX_BUILDER=openccb-builder

echo "   BuildKit/Buildx configurado para Docker Compose"

echo ""

# Funcion para ejecutar docker compose
run_docker_compose() {
    $DOCKER_CMD compose -f docker-compose.yml "$@"
}

# Export explícito de dominios para evitar warnings de interpolación en compose
export NEXT_PUBLIC_STUDIO_DOMAIN=$(grep '^NEXT_PUBLIC_STUDIO_DOMAIN=' .env | cut -d'=' -f2-)
export NEXT_PUBLIC_LEARNING_DOMAIN=$(grep '^NEXT_PUBLIC_LEARNING_DOMAIN=' .env | cut -d'=' -f2-)

# ========================================
# INICIAR SERVICIOS
# ========================================
echo "Iniciando servicios OpenCCB..."

# Detener contenedores existentes
echo "Deteniendo contenedores existentes..."
run_docker_compose down || true

# Eliminar contenedores antiguos para forzar reconstrucción
echo "Eliminando contenedores antiguos..."
$DOCKER_CMD rm openccb-studio 2>/dev/null || true
$DOCKER_CMD rm openccb-experience 2>/dev/null || true

if [ "$RESET_DATABASE" = "true" ]; then
    $DOCKER_CMD rm openccb-db 2>/dev/null || true

    # Eliminar volúmenes de base de datos solo cuando se pidió reset explícito
    echo "Eliminando volúmenes de base de datos (RESET activado)..."
    $DOCKER_CMD volume rm openccb_postgres_data 2>/dev/null || true
else
    echo "Manteniendo volumen de base de datos existente (RESET desactivado)..."
fi

# Limpiar caché de builder
echo "Limpiando caché de Docker builder..."
$DOCKER_CMD builder prune -f 2>/dev/null || true

# Evitar builds concurrentes que puedan competir por cachés compartidas
export COMPOSE_PARALLEL_LIMIT=1

if [ "$BUILD_LOCAL" = "true" ]; then
    echo "Imágenes pre-cargadas localmente - saltando build remoto"
else
    # Reconstruir con las URLs correctas (sin cache para asegurar que tome los cambios)
    echo "Reconstruyendo contenedores con las URLs configuradas..."
    run_docker_compose build --no-cache studio experience db
fi

# Iniciar nginx-proxy y acme-companion primero
echo "Iniciando nginx-proxy y acme-companion - SSL..."
run_docker_compose up -d nginx-proxy acme-companion
echo "Esperando a que nginx-proxy este listo..."
sleep 10

# Iniciar base de datos
echo "Iniciando base de datos..."
run_docker_compose up -d db
echo "Esperando a que la base de datos este lista..."
sleep 15

# Crear bases de datos con retry loop para esperar que Postgres esté listo
echo "Asegurando bases de datos openccb_cms/openccb_lms..."

# Retry loop para esperar que Postgres responda
MAX_RETRIES=30
RETRY_COUNT=0
while [ $RETRY_COUNT -lt $MAX_RETRIES ]; do
    if $DOCKER_CMD exec openccb-db psql -U user -d postgres -c "SELECT 1;" >/dev/null 2>&1; then
        echo "✅ Postgres está listo"
        break
    fi
    RETRY_COUNT=$((RETRY_COUNT + 1))
    if [ $RETRY_COUNT -lt $MAX_RETRIES ]; then
        echo "   Postgres no está listo, reintentando ($RETRY_COUNT/$MAX_RETRIES)..."
        sleep 1
    fi
done

if [ $RETRY_COUNT -eq $MAX_RETRIES ]; then
    echo "❌ ERROR: Postgres no respondió después de $MAX_RETRIES intentos"
    exit 1
fi

# SIEMPRE sincronizar la contraseña del rol con el .env actual
# Evita el error 28P01 (password authentication failed) cuando el deploy regenera DB_PASSWORD
CURRENT_DB_PASS=$(grep "^DB_PASSWORD=" .env | cut -d"=" -f2-)
if [ -n "$CURRENT_DB_PASS" ]; then
    echo "   Sincronizando contraseña del rol 'user' con .env..."
    $DOCKER_CMD exec openccb-db psql -U user -d postgres \
        -c "ALTER USER \"user\" WITH PASSWORD '$CURRENT_DB_PASS';" >/dev/null 2>&1 && \
        echo "   ✅ Contraseña sincronizada" || \
        echo "   ⚠️  No se pudo sincronizar contraseña (el rol usará la del volumen)"
fi

# Verificar e crear bases de datos
CMS_EXISTS=$($DOCKER_CMD exec openccb-db psql -U user -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname='openccb_cms';" 2>/dev/null | tr -d '[:space:]')
LMS_EXISTS=$($DOCKER_CMD exec openccb-db psql -U user -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname='openccb_lms';" 2>/dev/null | tr -d '[:space:]')

if [ "$CMS_EXISTS" != "1" ]; then
    echo "   Creando base de datos openccb_cms..."
    $DOCKER_CMD exec openccb-db psql -U user -d postgres -c "CREATE DATABASE openccb_cms;"
else
    echo "   ✅ openccb_cms ya existe"
fi

if [ "$LMS_EXISTS" != "1" ]; then
    echo "   Creando base de datos openccb_lms..."
    $DOCKER_CMD exec openccb-db psql -U user -d postgres -c "CREATE DATABASE openccb_lms;"
else
    echo "   ✅ openccb_lms ya existe"
fi

# Iniciar servicios
echo "Iniciando servicios OpenCCB..."
run_docker_compose up -d studio experience

echo ""
echo "Esperando a que los servicios esten listos..."
sleep 15

# ========================================
# GESTIÓN DE CERTIFICADOS SSL
# ========================================
if [ "$PRESERVE_SSL_CERTS" = "true" ]; then
    echo ""
    echo "✅ Preservando certificados SSL existentes"
    echo "   Iniciando nginx-proxy y acme-companion sin regenerar certificados..."
    
    # Iniciar nginx-proxy y acme-companion (los certificados ya existen)
    run_docker_compose up -d nginx-proxy acme-companion
    echo "Esperando a que nginx-proxy este listo..."
    sleep 10
else
    echo ""
    echo "Iniciando nginx-proxy y acme-companion para SSL..."
    
    # Iniciar nginx-proxy y acme-companion
    run_docker_compose up -d nginx-proxy acme-companion
    echo "Esperando a que nginx-proxy este listo..."
    sleep 10
    
    if [ "$LETSENCRYPT_STAGING" = "false" ]; then
        echo "   Generando certificados SSL de producción..."
    else
        echo "   Generando certificados SSL de staging..."
    fi
fi

# Evitar segunda reconstrucción/reinicio duplicado: ya se hizo arriba.

# ========================================
# VALIDAR / REPARAR SSL
# ========================================
if [ "\$PROTOCOL" = "https" ] || [ "\$PRESERVE_SSL_CERTS" = "true" ]; then
    echo ""
    echo "Verificando certificados SSL..."

    repair_ssl_for_domain() {
        local domain="\$1"
        local crt="/etc/nginx/certs/\${domain}.crt"
        local key="/etc/nginx/certs/\${domain}.key"

        if \$DOCKER_CMD exec nginx-proxy sh -lc "test -f '\$crt' && test -f '\$key' && openssl x509 -in '\$crt' -noout -pubkey 2>/dev/null | openssl sha256 >/tmp/cert.hash && openssl pkey -in '\$key' -pubout 2>/dev/null | openssl sha256 >/tmp/key.hash && cmp -s /tmp/cert.hash /tmp/key.hash" >/dev/null 2>&1; then
            echo "   ✅ Certificado válido: \$domain"
            return 0
        fi

        echo "   ⚠️  Certificado inconsistente o faltante para \$domain"
        echo "   Generando certificado temporal autofirmado para evitar error 500..."

        \$DOCKER_CMD exec acme-companion sh -lc "rm -f '\$crt' '\$key' && openssl req -x509 -nodes -newkey rsa:2048 -keyout '\$key' -out '\$crt' -days 30 -subj '/CN=\$domain' >/dev/null 2>&1" >/dev/null 2>&1 || true

        if \$DOCKER_CMD exec nginx-proxy sh -lc "test -f '\$crt' && test -f '\$key' && openssl x509 -in '\$crt' -noout -pubkey 2>/dev/null | openssl sha256 >/tmp/cert.hash && openssl pkey -in '\$key' -pubout 2>/dev/null | openssl sha256 >/tmp/key.hash && cmp -s /tmp/cert.hash /tmp/key.hash" >/dev/null 2>&1; then
            echo "   ✅ Certificado temporal listo: \$domain"
        else
            echo "   ❌ No se pudo reparar SSL para \$domain"
        fi
    }

    repair_ssl_for_domain "$STUDIO_DOMAIN"
    repair_ssl_for_domain "$LEARNING_DOMAIN"

    if \$DOCKER_CMD exec nginx-proxy nginx -t >/tmp/nginx_ssl_check.log 2>&1; then
        \$DOCKER_CMD exec nginx-proxy nginx -s reload >/dev/null 2>&1 || true
        echo "   ✅ Nginx SSL validado correctamente"
    else
        echo "   ⚠️  Nginx reportó problemas SSL:"
        cat /tmp/nginx_ssl_check.log || true
    fi
fi

# ========================================
# VERIFICAR VARIABLES DE ENTORNO
# ========================================
echo ""
echo "Verificando variables de entorno en los contenedores..."
echo ""

# Verificar .env
echo "Variables en .env:"
grep "NEXT_PUBLIC_" .env 2>/dev/null || echo "   No se encontraron variables NEXT_PUBLIC"
echo ""

# Verificar en los contenedores
echo "Studio:"
$DOCKER_CMD exec openccb-studio env | grep NEXT_PUBLIC || echo "   No se pudo verificar"
echo ""
echo "Experience:"
$DOCKER_CMD exec openccb-experience env | grep NEXT_PUBLIC || echo "   No se pudo verificar"
echo ""

# Verificar que las URLs no tengan puertos
echo "Verificando que las URLs no tengan puertos..."
CMS_ENV=$(grep "NEXT_PUBLIC_CMS_API_URL" .env 2>/dev/null | cut -d"=" -f2)
LMS_ENV=$(grep "NEXT_PUBLIC_LMS_API_URL" .env 2>/dev/null | cut -d"=" -f2)

if echo "$CMS_ENV" | grep -q ":[0-9]"; then
    echo "   ⚠️  ADVERTENCIA: CMS_API_URL tiene puerto ($CMS_ENV)"
    echo "      Esto causará errores CORS. Debe ser solo el dominio."
else
    echo "   ✅ CMS_API_URL correcta: $CMS_ENV"
fi

if echo "$LMS_ENV" | grep -q ":[0-9]"; then
    echo "   ⚠️  ADVERTENCIA: LMS_API_URL tiene puerto ($LMS_ENV)"
    echo "      Esto causará errores CORS. Debe ser solo el dominio."
else
    echo "   ✅ LMS_API_URL correcta: $LMS_ENV"
fi
echo ""

# ========================================
# VERIFICAR ESTADO
# ========================================
echo ""
echo "Estado de contenedores:"
run_docker_compose ps

echo ""
echo "Verificando logs de errores..."
CMS_ERRORS=$(run_docker_compose logs studio 2>&1 | grep -i "error" | tail -5 || true)
LMS_ERRORS=$(run_docker_compose logs experience 2>&1 | grep -i "error" | tail -5 || true)

if [ -n "$CMS_ERRORS" ]; then
    echo "Errores en Studio:"
    echo "$CMS_ERRORS"
fi

if [ -n "$LMS_ERRORS" ]; then
    echo "Errores en Experience:"
    echo "$LMS_ERRORS"
fi

if [ -z "$CMS_ERRORS" ] && [ -z "$LMS_ERRORS" ]; then
    echo "No se detectaron errores criticos"
fi

echo ""

# ========================================
# CREAR USUARIO ADMINISTRADOR
# ========================================
echo "========================================"
echo "   Creando Usuario Administrador"
echo "========================================"
echo ""

echo "Esperando a que el API CMS este listo..."
sleep 10

# Intentar crear el usuario via API
echo "Creando usuario administrador..."

if [ -n "$ADMIN_EMAIL" ] && [ -n "$ADMIN_PASS" ]; then
    ADMIN_RESPONSE=$($DOCKER_CMD exec \
        -e ADMIN_EMAIL="$ADMIN_EMAIL" \
        -e ADMIN_PASS="$ADMIN_PASS" \
        -e ADMIN_NAME="$ADMIN_NAME" \
        -e ORG_NAME="$ORG_NAME" \
        openccb-studio node -e "
const payload = {
    email: process.env.ADMIN_EMAIL,
    password: process.env.ADMIN_PASS,
    full_name: process.env.ADMIN_NAME,
    organization_name: process.env.ORG_NAME,
    role: 'admin'
};

fetch('http://localhost:3001/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
})
    .then(async (res) => {
        const body = await res.text();
        process.stdout.write(String(res.status) + '\n');
        process.stdout.write(body);
    })
    .catch((err) => {
        console.error('FETCH_ERROR:' + err.message);
        process.exit(2);
    });
" 2>/dev/null || true)

ADMIN_STATUS=$(printf '%s' "$ADMIN_RESPONSE" | head -n1)
ADMIN_BODY=$(printf '%s' "$ADMIN_RESPONSE" | tail -n +2)

if [ "$ADMIN_STATUS" = "200" ] || [ "$ADMIN_STATUS" = "201" ]; then
        echo "Usuario creado via API"
elif printf '%s' "$ADMIN_BODY" | grep -qi "already\|exist\|duplic"; then
        echo "Usuario administrador ya existe"
else
        echo "No se pudo crear el usuario administrador via API (HTTP: ${ADMIN_STATUS:-unknown})"
        if [ -n "$ADMIN_BODY" ]; then
                echo "Detalle: $ADMIN_BODY"
        fi
fi
fi

echo ""
echo "========================================"
echo "   CREDENCIALES DE ACCESO"
echo "========================================"
echo ""
echo "URLs de acceso:"
echo "   Studio - CMS:     $PROTOCOL://$STUDIO_DOMAIN"
echo "   Experience - LMS: $PROTOCOL://$LEARNING_DOMAIN"
echo ""
echo "Usuario Administrador:"
echo "   Email: $ADMIN_EMAIL"
echo "   Contraseña: $ADMIN_PASS"
echo ""
echo "Organizacion: $ORG_NAME"
echo ""

if [ "$PRESERVE_SSL_CERTS" = "true" ]; then
    echo "✅ Certificados SSL existentes preservados"
    echo "   Los certificados ya están activos y funcionando"
elif [ "$LETSENCRYPT_STAGING" = "true" ]; then
    echo "⚠️  Usando Let's Encrypt STAGING"
    echo "   Los certificados son de prueba - el navegador mostrara advertencias"
    echo "   Las APIs usan HTTP para evitar errores de SSL"
    echo "   Certificados se generaran en ~1 hora"
elif [ "$USE_SSL" = "y" ] || [ "$USE_SSL" = "Y" ]; then
    echo "✅ Usando Let's Encrypt PRODUCTION"
    echo "   Certificados reales se generaran en 2-5 minutos"
else
    echo "✅ Usando HTTP (sin SSL)"
fi

echo ""
echo "Credenciales de Base de Datos - GUARDAR EN LUGAR SEGURO:"
echo "   DB_PASSWORD: $(grep "^DB_PASSWORD=" .env | cut -d"=" -f2)"
echo "   JWT_SECRET: $(grep "^JWT_SECRET=" .env | cut -d"=" -f2)"
echo ""
echo "Comandos utiles:"
echo "   sudo docker compose ps"
echo "   docker logs acme-companion --tail 50"
echo "   docker logs openccb-studio --tail 20"
echo "   sudo docker compose restart"
echo ""

# Verificación de conectividad con Ollama
echo ""
echo "========================================"
echo "   Verificando Conectividad IA"
echo "========================================"
echo ""
echo "Probando conexión con Ollama (t-800.norteamericano.cl:11434)..."

# Ya estamos ejecutando en el host remoto: evitar SSH anidado que puede fallar con exit 255.
OLLAMA_TEST=$(curl -s --connect-timeout 5 http://t-800.norteamericano.cl:11434/api/tags 2>&1 | head -1 || true)

if [ -n "$OLLAMA_TEST" ] && echo "$OLLAMA_TEST" | grep -q "models"; then
    echo "✅ Ollama accesible desde AWS EC2"
    echo "   Modelos disponibles:"
    curl -s http://t-800.norteamericano.cl:11434/api/tags 2>&1 | grep -o '"name":"[^"]*"' | head -5 || true
else
    echo "⚠️  Ollama NO es accesible desde AWS EC2"
    echo ""
    echo "Posibles causas:"
    echo "   1. Firewall WAN In del UniFi bloquea el puerto 11434"
    echo "   2. Port forwarding no configurado en el router"
    echo "   3. Firewall de Ubuntu en t-800 bloquea conexiones"
    echo "   4. Ollama no está escuchando en 0.0.0.0"
    echo ""
    echo "Para verificar manualmente:"
    echo "   ssh -i \"$PEM_PATH\" $REMOTE_USER@$REMOTE_HOST"
    echo "   curl -v http://t-800.norteamericano.cl:11434/api/tags"
    echo ""
    echo "Configuración requerida en UniFi USG Pro 4:"
    echo "   1. Port Forwarding: 11434 -> 192.168.0.5:11434"
    echo "   2. Firewall WAN In Rule: Accept TCP 11434 from Any"
    echo ""
    echo "Ver documentación: CONFIGURACION_RED.md"
fi
echo ""
REMOTE_SCRIPT_CONTENT

# Copiar script al servidor
scp -i "$PEM_PATH" /tmp/remote-deploy.sh "$REMOTE_USER@$REMOTE_HOST:/tmp/openccb-remote.sh"

# Ejecutar script remoto
ssh -i "$PEM_PATH" "$REMOTE_USER@$REMOTE_HOST" "bash /tmp/openccb-remote.sh"
SCRIPT_EXIT=$?

# Limpiar archivo temporal
rm -f /tmp/remote-deploy.sh
ssh -i "$PEM_PATH" "$REMOTE_USER@$REMOTE_HOST" "rm -f /tmp/openccb-remote.sh"

echo ""

if [ $SCRIPT_EXIT -eq 0 ]; then
    echo "===================================================="
    echo "        Despliegue Completado Exitosamente"
    echo "===================================================="
    echo ""
    
    # Descargar .env del servidor al local
    echo "📥 Descargando .env del servidor..."
    scp -i "$PEM_PATH" "$REMOTE_USER@$REMOTE_HOST:$REMOTE_PATH/.env" "./.env.production"
    echo "   ✅ .env guardado como .env.production"
    echo ""
    
    echo "Accede a tu plataforma:"
    echo "   Studio - CMS:     $PROTOCOL://$STUDIO_DOMAIN"
    echo "   Experience - LMS: $PROTOCOL://$LEARNING_DOMAIN"
    echo ""
    echo "Conectate para administrar:"
    echo "   ssh -i \"$PEM_PATH\" $REMOTE_USER@$REMOTE_HOST"
    echo "   cd $REMOTE_PATH"
    echo ""
    echo "Para actualizar en el futuro:"
    echo "   Ejecuta: ./deploy.sh"
    echo ""
else
    echo "===================================================="
    echo "        Despliegue Completado con Errores"
    echo "===================================================="
    echo ""
    echo "Error al ejecutar script remoto - codigo: $SCRIPT_EXIT"
    echo ""
    echo "Verifica manualmente:"
    echo "   ssh -i \"$PEM_PATH\" $REMOTE_USER@$REMOTE_HOST"
    echo "   cd $REMOTE_PATH"
    echo "   sudo docker compose ps"
    echo "   sudo docker compose logs"
    echo ""
fi

exit $SCRIPT_EXIT
