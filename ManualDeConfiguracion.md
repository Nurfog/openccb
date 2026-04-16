# Manual de Configuración de OpenCCB

## Tabla de Contenidos

1. [Requisitos del Sistema](#requisitos-del-sistema)
2. [Instalación](#instalación)
3. [Configuración de Entorno](#configuración-de-entorno)
4. [Configuración de IA](#configuración-de-ia)
5. [Base de Datos](#base-de-datos)
6. [Despliegue en Producción](#despliegue-en-producción)
7. [Solución de Problemas](#solución-de-problemas)

---

## Requisitos del Sistema

OpenCCB es altamente escalable. A continuación se detallan los requisitos recomendados según la carga de usuarios concurrentes:

| Componente | **Pequeño (100 u.)** | **Mediano (500 u. concurrentes)** | **Grande (1000+ u.)** |
| :--- | :--- | :--- | :--- |
| **CPU** | 4 vCPUs | 8-12 vCPUs (AVX2/AVX-512) | 16-32+ vCPUs |
| **RAM** | 8 GB | 16-32 GB (Recomendado 24GB+) | 64 GB+ |
| **Almacenamiento** | 50 GB SSD | 250 GB+ NVMe (RAID-1) | 1 TB+ NVMe (S3 Backup) |
| **AI (Opcional)** | N/A (Solo CPU) | NVIDIA RTX 3060+ (12GB VRAM) | Multi-GPU (A100/H100) |
| **OS** | Ubuntu 22.04 LTS | Ubuntu 24.04 LTS / Debian | Cloud Native (K8s / Terraform) |

> [!NOTE]
> Los requisitos de AI son específicos para la función de transcripción local (Whisper). Si se utiliza una API externa, el requisito de GPU desaparece.

---

## Instalación

### Instalación Automática (Recomendado)

El script `install.sh` automatiza todo el proceso:

```bash
# Instalación estándar
./install.sh

# Modo rápido (omite comprobaciones de dependencias)
./install.sh --fast

# Modo despliegue (sincroniza con servidor remoto)
./install.sh --deploy
```

### Pasos del Script

1. **Entorno local forzado**: `ENVIRONMENT=dev`
2. **Instalación de dependencias**: Rust, Node.js, Docker, sqlx-cli
3. **Configuración de .env**: Variables automáticas según entorno
4. **Inicialización de DB**: Crea bases de datos y ejecuta migraciones
5. **Configuración de IA**: URLs de Ollama y Whisper
6. **Creación de admin**: Usuario administrador inicial
7. **Inicio de servicios**: Docker Compose

### Overrides útiles para `install.sh`

`install.sh` permite sobreescribir variables sin editar el script:

```bash
# IA local por IP/host de red
LOCAL_OLLAMA_URL=http://192.168.0.5:11434 \
LOCAL_WHISPER_URL=http://192.168.0.5:9000 \
./install.sh

# Forzar URL interna de CMS para comunicación LMS -> CMS
CMS_API_URL=http://studio:3001 ./install.sh

# Reutilizar SAM remoto compartido
SAM_SHARED_URL=mysql://user:pass@host:3306/sige_sam_v3 \
SAM_DIAG_SHARED_URL=mysql://user:pass@host:3306/SAM_diagnostico \
./install.sh
```

### Instalación Manual

```bash
# 1. Clonar repositorio
git clone <repo-url>
cd openccb

# 2. Copiar .env.example
cp .env.example .env

# 3. Configurar variables de entorno
nano .env

# 4. Si PostgreSQL NO está corriendo, iniciar con Docker
docker-compose up -d db

# 5. Esperar a que DB esté lista
sleep 10

# 6. Crear bases de datos (puerto 5433)
docker exec openccb-db-1 psql -U user -d postgres -c "CREATE DATABASE openccb_cms;" || true
docker exec openccb-db-1 psql -U user -d postgres -c "CREATE DATABASE openccb_lms;" || true

# Si PostgreSQL ya existe (producción), usar psql directo:
# psql -h localhost -p 5433 -U user -d postgres -c "CREATE DATABASE openccb_cms;"
# psql -h localhost -p 5433 -U user -d postgres -c "CREATE DATABASE openccb_lms;"

# 7. Ejecutar migraciones (puerto 5433)
DATABASE_URL=postgresql://user:password@localhost:5433/openccb_cms \
  sqlx migrate run --source services/cms-service/migrations

DATABASE_URL=postgresql://user:password@localhost:5433/openccb_lms \
  sqlx migrate run --source services/lms-service/migrations

# 8. Iniciar servicios (sin DB si ya existe)
docker-compose up -d
```

---

## Configuración de Entorno

### Variables Principales (.env)

```bash
# Entorno (dev o prod)
ENVIRONMENT=dev

# Base de Datos (Puerto 5434 - 5432 y 5433 pueden estar en uso)
DATABASE_URL=postgresql://user:password@localhost:5434/openccb?sslmode=disable
CMS_DATABASE_URL=postgresql://user:password@localhost:5434/openccb_cms?sslmode=disable
LMS_DATABASE_URL=postgresql://user:password@localhost:5434/openccb_lms?sslmode=disable

# JWT Secret (generar con ./generate_jwt_secret.sh)
JWT_SECRET=tu_secreto_seguro_aqui

# URLs de Frontend
NEXT_PUBLIC_CMS_API_URL=http://localhost:3001
NEXT_PUBLIC_LMS_API_URL=http://localhost:3002

# Branding
DEFAULT_ORG_NAME=Norteamericano
DEFAULT_PLATFORM_NAME=OpenCCB Learning
DEFAULT_PRIMARY_COLOR=#3B82F6
DEFAULT_SECONDARY_COLOR=#8B5CF6

# SAM Integration (MySQL compartido)
MYSQL_DATABASE_URL=mysql://user:password@host:3306/sige_sam_v3
SAM_DATABASE_URL=mysql://user:password@host:3306/sige_sam_v3
SAM_DIAGNOSTICO_DATABASE_URL=mysql://user:password@host:3306/SAM_diagnostico
# URL interna para sincronización de perfil LMS -> CMS
CMS_API_URL=http://studio:3001
```

### Configuración por Entorno

**Desarrollo:**
```bash
ENVIRONMENT=dev
LOCAL_OLLAMA_URL=http://localhost:11434
LOCAL_WHISPER_URL=http://localhost:9000
# Alternativa LAN:
# LOCAL_OLLAMA_URL=http://192.168.0.5:11434
# LOCAL_WHISPER_URL=http://192.168.0.5:9000
```

**Producción:**
```bash
ENVIRONMENT=prod
LOCAL_OLLAMA_URL=http://t-800.norteamericano.cl:11434
LOCAL_WHISPER_URL=http://t-800.norteamericano.cl:9000
```

---

## Integración SAM (Sistema de Administración Académica)

### ¿Qué es SAM?

SAM es un sistema externo de gestión académica que contiene:
- **Alumnos**: `sige_sam_v3.alumnos`
- **Cursos**: `sige_sam_v3.detalle_contrato`

OpenCCB se sincroniza con SAM para:
1. Importar alumnos automáticamente
2. Asignar cursos a cada alumno
3. Restringir acceso solo a cursos asignados

### Configuración

1. **Agregar variables de entorno** en `.env`:
   ```bash
  MYSQL_DATABASE_URL=mysql://user:password@host:3306/sige_sam_v3
  SAM_DATABASE_URL=mysql://user:password@host:3306/sige_sam_v3
  SAM_DIAGNOSTICO_DATABASE_URL=mysql://user:password@host:3306/SAM_diagnostico
   ```

2. **Ejecutar migración**:
   ```bash
   DATABASE_URL=postgresql://user:password@localhost:5433/openccb_cms \
     sqlx migrate run --source services/cms-service/migrations
   ```

3. **Sincronizar datos**:
   ```bash
   # Obtener token de admin
   TOKEN=$(curl -s -X POST "http://localhost:3001/auth/login" \
     -H "Content-Type: application/json" \
     -d '{"email":"admin@norteamericano.cl","password":"Admin123!"}' \
     | jq -r '.token')

   # Sincronizar alumnos y cursos
   curl -X POST "http://localhost:3001/sam/sync-all" \
     -H "Authorization: Bearer $TOKEN"
   ```

### Endpoints SAM

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| POST | `/sam/sync-all` | Sincronización completa (alumnos + cursos) |
| POST | `/sam/sync-students` | Solo sincroniza alumnos |
| POST | `/sam/sync-assignments` | Solo sincroniza asignaciones de cursos |
| GET | `/sam/students` | Lista alumnos SAM con filtros |
| GET | `/sam/students/{student_id}/courses` | Cursos asignados a un alumno |

### Comportamiento por Rol

| Rol | Acceso a Cursos |
|-----|-----------------|
| **Super Admin** | Todos los cursos (todas las organizaciones) |
| **Admin** | Todos los cursos de su organización |
| **Instructor** | Todos los cursos de su organización |
| **Alumno SAM** | Solo cursos asignados vía SAM |
| **Alumno NO-SAM** | ❌ Ningún curso (lista vacía) |

### Flujo de Sincronización

```
┌─────────────────────┐     ┌──────────────┐     ┌─────────────────┐
│ sige_sam_v3.alumnos │────▶│  Sync SAM    │────▶│ users           │
│ (id_alumno, email)  │     │  POST /sam   │     │ (sam_student_id)│
└─────────────────────┘     └──────────────┘     └─────────────────┘

┌──────────────────────────┐     ┌──────────────┐     ┌──────────────┐
│ sige_sam_v3.detalle_     │────▶│  Sync SAM    │────▶│ sam_course_  │
│ contrato (id_alumno,     │     │  POST /sam   │     │ assignments  │
│ id_curso_abierto)        │     │              │     │              │
└──────────────────────────┘     └──────────────┘     └──────────────┘
```

### Solución de Problemas

**Error: "SAM_DATABASE_URL not configured"**
```bash
# Agregar en .env
SAM_DATABASE_URL=mysql://user:pass@host:3306/sige_sam_v3

# Reiniciar servicio
docker-compose restart cms
```

**Error: `/auth/me` responde 502 en LMS**
```bash
# Validar URL interna de CMS usada por LMS
grep '^CMS_API_URL=' .env.dev .env 2>/dev/null

# Valor recomendado en Docker
CMS_API_URL=http://studio:3001
```

**Error: "Failed to fetch SAM students"**
- Verificar conexión a la base de datos SAM
- Confirmar que las tablas `sige_sam_v3.alumnos` existen
- Verificar permisos de usuario en SAM

**Alumnos SAM no ven cursos**
1. Verificar que `is_sam_student = TRUE` en tabla `users`
2. Verificar que existen registros en `sam_course_assignments`
3. Ejecutar sincronización nuevamente: `POST /sam/sync-all`

---

## Configuración de IA

### Proveedores Soportados

1. **Local (Ollama + Whisper)**: Recomendado para privacidad y costo cero
2. **Remoto**: API externa (t-800 o similar)

### Configuración Local

```bash
AI_PROVIDER=local
LOCAL_OLLAMA_URL=http://localhost:11434
LOCAL_WHISPER_URL=http://localhost:9000
LOCAL_LLM_MODEL=llama3.2:3b
EMBEDDING_MODEL=nomic-embed-text
```

### Pull de Modelos

```bash
# Ollama
docker exec -it ollama ollama pull llama3.2:3b
docker exec -it ollama ollama pull nomic-embed-text

# Whisper (ya viene pre-configurado en el contenedor)
```

### Generación de Embeddings

```bash
# Generar para preguntas existentes
curl -X POST http://localhost:3001/question-bank/embeddings/generate \
  -H "Authorization: Bearer TOKEN"

# Generar para base de conocimiento
curl -X POST http://localhost:3002/knowledge-base/embeddings/generate \
  -H "Authorization: Bearer TOKEN"
```

---

## Base de Datos

### Estructura

- **openccb_cms**: Gestión de cursos, usuarios, organizaciones
- **openccb_lms**: Progreso estudiantil, calificaciones, foros

### Migraciones

```bash
# CMS
DATABASE_URL=postgresql://user:password@localhost:5433/openccb_cms \
  sqlx migrate run --source services/cms-service/migrations

# LMS
DATABASE_URL=postgresql://user:password@localhost:5433/openccb_lms \
  sqlx migrate run --source services/lms-service/migrations

# Revertir última migración
DATABASE_URL=postgresql://user:password@localhost:5433/openccb_cms \
  sqlx migrate revert --source services/cms-service/migrations
```

### Backup

```bash
# Backup completo
docker exec openccb-db-1 pg_dump -U user openccb_cms > backup_cms.sql
docker exec openccb-db-1 pg_dump -U user openccb_lms > backup_lms.sql

# Restaurar
docker exec -i openccb-db-1 psql -U user openccb_cms < backup_cms.sql
docker exec -i openccb-db-1 psql -U user openccb_lms < backup_lms.sql
```

### PGVector (Búsqueda Semántica)

La extensión pgvector está habilitada para búsqueda semántica:

```sql
-- Verificar extensión
SELECT * FROM pg_extension WHERE extname = 'vector';

-- Búsqueda semántica de preguntas
SELECT * FROM question_bank
ORDER BY embedding <=> '[...]'::vector
LIMIT 10;
```

---

## Despliegue en Producción

### Scripts de Despliegue

El proyecto cuenta con tres scripts separados:

| Script | Propósito |
|--------|-----------|
| **install.sh** | Instalación local y configuración inicial |
| **deploy.sh** | Despliegue remoto automático |
| **setup-nginx-ssl.sh** | Configuración de nginx + SSL (servidor con nginx instalado) |

### SSL con nginx Existente (Tu Caso)

Si nginx ya está instalado en el servidor remoto:

**1. Copiar archivos al servidor:**
```bash
# Desde tu máquina local
./deploy.sh
```

**2. Conectarse al servidor:**
```bash
ssh -i "ubuntu.pem" ubuntu@ec2-18-222-198-24.us-east-2.compute.amazonaws.com
cd /var/www/openccb
```

**3. Ejecutar configuración de nginx:**
```bash
sudo ./setup-nginx-ssl.sh
```

**4. Instalar certificados SSL:**
```bash
sudo /usr/local/bin/install-ssl-certs.sh
```

**5. Iniciar OpenCCB:**
```bash
docker-compose up -d
```

**Configuración creada:**
- ✅ `/etc/nginx/sites-available/studio.norteamericano.com`
- ✅ `/etc/nginx/sites-available/learning.norteamericano.com`
- ✅ `/usr/local/bin/install-ssl-certs.sh` (instalación de certificados)
- ✅ `/etc/cron.daily/certbot-renewal` (renovación automática)

**Dominios configurados:**
- `https://studio.norteamericano.com` → Puerto 3000 (Studio)
- `https://learning.norteamericano.com` → Puerto 3003 (Experience)

### Despliegue con Docker Compose SSL

Si prefieres usar docker-compose con nginx-proxy:

```bash
# Ejecutar despliegue con SSL
docker compose -f docker-compose.ssl.yml up -d
```

**¿Qué hace?**
1. **Inicia nginx-proxy** → Proxy inverso
2. **Inicia acme-companion** → SSL automático con Let's Encrypt
3. **Inicia servicios** → Studio, Experience, DB
4. **Obtiene certificados** → Automáticamente

### Comandos de Despliegue

```bash
# Despliegue remoto (copia archivos)
./deploy.sh

# Configuración de nginx + SSL (en el servidor)
sudo ./setup-nginx-ssl.sh

# Instalación de certificados (en el servidor)
sudo /usr/local/bin/install-ssl-certs.sh

# Instalación local (desarrollo)
./install.sh
```

### Flujo de Despliegue

```
┌─────────────────┐
│  deploy.sh      │  (local)
│                 │
│  1. Lee config  │───┐
│  2. Prepara     │   │
│  3. Sube        │   ▼
└─────────────────┐ ┌──────────────────┐
                  │ │ Servidor Remoto  │
                  │ │                  │
                  │ │ 4. Verifica      │
                  │ │ 5. Gestiona      │
                  │ │ 6. Verifica      │
                  │ └──────────────────┘
```

### Archivos Subidos al Servidor

El deploy.sh copia los siguientes archivos al servidor remoto:

```
/var/www/openccb/
├── docker-compose.yml
├── .env (o .env.example)
├── install.sh          ← Para instalaciones futuras
├── deploy.sh           ← Para actualizaciones futuras
├── Cargo.toml
├── Cargo.lock
├── services/
├── shared/
└── web/
```

### Actualizaciones Futuras

Una vez desplegado, puedes actualizar el servidor remoto de dos formas:

**Opción A: Desde tu máquina local**
```bash
./deploy.sh
```

**Opción B: Desde el servidor remoto**
```bash
ssh -i ubuntu.pem ubuntu@REMOTE_HOST
cd /var/www/openccb
./deploy.sh
```

### Pasos Manuales (Alternativo)

Si prefieres control manual del despliegue:

1. **Sincronizar archivos:**
   ```bash
   rsync -avz -e "ssh -i ubuntu.pem" \
     --exclude 'node_modules' \
     --exclude 'target' \
     --exclude '.next' \
     --exclude '.git' \
     --exclude '*.md' \
     ./ ubuntu@remote-host:/var/www/openccb/
   ```

2. **Conectarse al servidor:**
   ```bash
   ssh -i ubuntu.pem ubuntu@remote-host
   cd /var/www/openccb
   ```

3. **Gestionar contenedores:**
   ```bash
   # Ver estado
   docker-compose ps
   
   # Ver logs
   docker-compose logs -f
   
   # Reiniciar servicios
   docker-compose restart
   
   # Reconstruir desde cero
   docker-compose down
   docker-compose up -d --build
   
   # Actualizar desde git
   git pull
   docker-compose up -d --build
   ```

### Configuración de Producción

```bash
# .env en producción
ENVIRONMENT=prod
JWT_SECRET=<generar_con_script>
DATABASE_URL=postgresql://user:secure_password@db-host:5432/openccb?sslmode=require
LOCAL_OLLAMA_URL=http://t-800.norteamericano.cl:11434
LOCAL_WHISPER_URL=http://t-800.norteamericano.cl:9000
```

### Seguridad en Producción

1. **HTTPS obligatorio**: Usar reverse proxy (Nginx/Traefik) con Let's Encrypt
2. **Firewall**: Solo puertos 80, 443, 22 abiertos
3. **DB password**: Usar contraseña segura (20+ caracteres)
4. **JWT_SECRET**: Generar con `./generate_jwt_secret.sh`
5. **Backups automáticos**: Configurar cron job diario

---

## Solución de Problemas

### Error: "extension 'vector' does not exist"

```bash
# Verificar imagen de Docker
docker-compose pull db
docker-compose down
docker-compose up -d db

# Verificar extensión
docker exec openccb-db-1 psql -U user -d openccb_cms \
  -c "SELECT * FROM pg_extension WHERE extname = 'vector';"
```

### Error: "Ollama no responde"

```bash
# Verificar contenedor
docker ps | grep ollama

# Probar conexión
curl http://localhost:11434/api/tags

# Reiniciar
docker-compose restart ollama
```

### Error: "Puerto 5432 en uso"

El script usa automáticamente el puerto 5433 si el 5432 está ocupado.

```bash
# Verificar qué usa el puerto
lsof -i :5432

# Cambiar a puerto 5433 en .env
DATABASE_URL=postgresql://user:password@localhost:5433/openccb
```

### Error: "CORS en login/registro"

Verificar que el rate limiter NO esté aplicado a rutas de autenticación:

```rust
// services/cms-service/src/main.rs
// CORRECTO:
.protected_routes
    .route_layer(middleware::from_fn(org_extractor_middleware))
// NO agregar GovernorLayer aquí
```

### Error: "Audio recording no funciona"

1. **Verificar HTTPS**: El audio requiere contexto seguro
   ```bash
   # Localhost está OK
   # Producción requiere HTTPS
   ```

2. **Verificar permisos del navegador**:
   - Chrome: `chrome://settings/content/microphone`
   - Firefox: `about:preferences#privacy` → Permisos

3. **Verificar logs**:
   ```
   [AudioResponse] Requesting microphone access...
   [AudioResponse] Microphone access granted
   ```

### Limpieza Completa

```bash
# Detener servicios
docker-compose down -v

# Eliminar volúmenes
docker volume rm openccb_db_data

# Reinstalar
./install.sh
```

### Seguridad de certificados

No subas a git claves privadas ni artefactos ACME.

```bash
nginx/certs-data/
*.key
*.csr
*.crt
```

Si necesitas respaldar certificados, hazlo fuera del repositorio.

### Logs y Debugging

```bash
# Ver logs de servicios
docker compose logs -f studio
docker compose logs -f experience
docker compose logs -f db

# Logs con filtro
docker compose logs -f experience | grep -i error

# Acceder a DB
docker exec -it openccb-db psql -U user -d openccb_cms

# Verificar health LMS interno (desde red Docker)
docker exec openccb-studio node -e "fetch('http://experience:3002/health').then(async r=>{console.log(r.status);console.log(await r.text())})"

# Verificar variables activas en experience
docker exec openccb-experience sh -lc 'echo DATABASE_URL=$DATABASE_URL; echo LMS_DATABASE_URL=$LMS_DATABASE_URL'
```

Si `openccb-experience` queda con `localhost:5433` en `DATABASE_URL`/`LMS_DATABASE_URL`, recrear con DB interna Docker:

```bash
LMS_DATABASE_URL='postgresql://user:password@db:5432/openccb_lms' docker compose up -d --force-recreate experience
```

### Comandos Útiles

```bash
# Health checks
curl http://localhost:3001/health
curl http://localhost:3002/health

# Generar JWT_SECRET
./generate_jwt_secret.sh

# Reset de sesión
./clear_session.sh

# Diagnóstico de auth
./diagnose_auth.sh

# Ver usuarios
docker exec openccb-db psql -U user -d openccb_cms \
  -c "SELECT email, role FROM users;"

# Ver organizaciones
docker exec openccb-db psql -U user -d openccb_cms \
  -c "SELECT name, api_key FROM organizations;"

# Smoke test de permisos de audio LMS
./scripts/smoke_audio_roles.sh
```

---

## Recursos Adicionales

- **README.md**: Características y arquitectura
- **roadmap.md**: Hoja de ruta de desarrollo
- **OPTIMIZATIONS.md**: Guía de optimizaciones implementadas
- **PGVECTOR_EMBEDDINGS.md**: Guía de búsqueda semántica

---

**Última actualización**: Marzo 2026
**Versión**: OpenCCB 0.2.3
