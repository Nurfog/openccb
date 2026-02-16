#!/bin/bash

# Script para borrar y resetear las bases de datos de OpenCCB
# Uso: ./scripts/reset_db.sh

set -e

echo "🛑 Deteniendo servicios..."
docker compose stop studio experience

echo "🧹 Borrando bases de datos..."
docker exec openccb-db-1 psql -U user -d openccb -c "DROP DATABASE IF EXISTS openccb_cms;"
docker exec openccb-db-1 psql -U user -d openccb -c "DROP DATABASE IF EXISTS openccb_lms;"

echo "🏗️ Recreando bases de datos..."
docker exec openccb-db-1 psql -U user -d openccb -c "CREATE DATABASE openccb_cms;"
docker exec openccb-db-1 psql -U user -d openccb -c "CREATE DATABASE openccb_lms;"

echo "🚀 Reiniciando servicios y aplicando migraciones..."
docker compose start studio experience

echo "✅ Base de datos reseteada exitosamente."
echo "Nota: Las migraciones se ejecutarán automáticamente al iniciar los servicios."
