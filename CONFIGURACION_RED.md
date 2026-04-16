# OpenCCB - Configuración de Red y Firewall

## Resumen de Infraestructura

### Servidores

| Servidor | IP Pública | IP Local | Función |
|----------|------------|----------|---------|
| **AWS EC2** | 18.224.137.67 | - | Producción OpenCCB |
| **t-800 (Oficina)** | 200.68.55.78 | 192.168.0.5 | IA (Ollama + Whisper) |
| **Tu PC (Oficina)** | 200.68.55.74 | 192.168.0.x | Desarrollo |

### Dominios

| Dominio | Apunta a | Puerto |
|---------|----------|--------|
| studio.norteamericano.com | AWS EC2 | 443 (HTTPS) |
| learning.norteamericano.com | AWS EC2 | 443 (HTTPS) |

---

## Configuración de Red Requerida

### 1. UniFi USG Pro 4 (Oficina)

#### Port Forwarding (NAT)

| Nombre | Puerto Externo | IP Interna | Puerto Interno | Protocolo |
|--------|----------------|------------|----------------|-----------|
| ia | 11434 | 192.168.0.5 | 11434 | TCP/UDP |
| ia2 | 9000 | 192.168.0.5 | 9000 | TCP/UDP |
| bark | 8000 | 192.168.0.5 | 8000 | TCP |
| video | 8080 | 192.168.0.5 | 8080 | TCP |
| bark-tts | 8443 | 192.168.0.5 | 8443 | TCP |

#### Firewall WAN In Rules

**Importante**: El port forwarding NO es suficiente. Necesitás agregar reglas de firewall WAN In.

**Reglas requeridas:**

```bash
# Conectar por SSH al USG Pro 4
ssh ubnt@200.68.55.78

# Entrar en modo configuración
configure

# Regla para Ollama (IA) - Permitir desde AWS EC2
set firewall name WAN_IN rule 50 action accept
set firewall name WAN_IN rule 50 description "Allow-Ollama-from-AWS"
set firewall name WAN_IN rule 50 destination port 11434
set firewall name WAN_IN rule 50 protocol tcp
set firewall name WAN_IN rule 50 source address 18.224.137.67

# Regla para Whisper (Audio)
set firewall name WAN_IN rule 51 action accept
set firewall name WAN_IN rule 51 description "Allow-Whisper-from-AWS"
set firewall name WAN_IN rule 51 destination port 9000
set firewall name WAN_IN rule 51 protocol tcp
set firewall name WAN_IN rule 51 source address 18.224.137.67

# Commit y guardar
commit
save
exit
```

**Para permitir desde cualquier IP (temporal, para testing):**

```bash
configure
set firewall name WAN_IN rule 50 action accept
set firewall name WAN_IN rule 50 description "Allow-Ollama-Temp"
set firewall name WAN_IN rule 50 destination port 11434
set firewall name WAN_IN rule 50 protocol tcp
# Sin source address = permite desde cualquier IP
commit
save
exit
```

#### UniFi Controller (Interfaz Web)

1. Entrar a UniFi Controller
2. Ir a **Settings > Security > Firewall**
3. **WAN In Rules** → Crear nueva regla:
   - **Action**: Accept
   - **Protocol**: TCP
   - **Source**: `18.224.137.67/32` (AWS EC2) o `Any`
   - **Destination Port**: `11434`
   - **Description**: `Allow-Ollama-from-AWS`

---

### 2. Firewall de Ubuntu (t-800)

En el servidor `t-800` (192.168.0.5):

```bash
# Verificar estado
sudo ufw status verbose

# Si está activo, permitir puertos
sudo ufw allow from any to any port 11434 proto tcp
sudo ufw allow from any to any port 9000 proto tcp
sudo ufw allow from any to any port 8000 proto tcp
sudo ufw allow from any to any port 8080 proto tcp
sudo ufw allow from any to any port 8443 proto tcp

# Recargar
sudo ufw reload
sudo ufw status
```

---

### 3. AWS EC2 Security Group

En AWS Console → EC2 → Security Groups:

**Inbound Rules:**

| Tipo | Puerto | Origen | Descripción |
|------|--------|--------|-------------|
| HTTPS | 443 | 0.0.0.0/0 | Tráfico web seguro |
| HTTP | 80 | 0.0.0.0/0 | Redirección a HTTPS |
| SSH | 22 | Tu IP | Administración |

---

## Verificación de Conectividad

### Desde AWS EC2 hacia t-800

```bash
# Conectarse a AWS EC2
ssh -i "ubuntu.pem" ubuntu@ec2-18-224-137-67.us-east-2.compute.amazonaws.com

# Probar Ollama
curl -v --connect-timeout 5 http://t-800.norteamericano.cl:11434/api/tags

# Probar Whisper
curl -v --connect-timeout 5 http://t-800.norteamericano.cl:9000/health

# Si no funciona, verificar DNS
getent hosts t-800.norteamericano.cl

# Probar con IP directa
curl -v --connect-timeout 5 http://200.68.55.78:11434/api/tags
```

### Desde t-800 (local)

```bash
# En t-800, probar localmente
curl http://localhost:11434/api/tags

# Verificar que escucha en todas las interfaces
sudo ss -tlnp | grep 11434
# Debería mostrar: 0.0.0.0:11434 o *:11434
# NO: 127.0.0.1:11434
```

### Desde tu PC (oficina)

```bash
# Probar acceso a Ollama
curl http://t-800.norteamericano.cl:11434/api/tags
curl http://192.168.0.5:11434/api/tags

# Probar acceso a AWS
curl https://studio.norteamericano.com/health
```

---

## Solución de Problemas

### Error: Timeout desde AWS

```bash
# 1. Verificar firewall WAN In en UniFi
ssh ubnt@200.68.55.78
show configuration commands | grep WAN_IN

# 2. Verificar firewall Ubuntu en t-800
ssh juan@192.168.0.5
sudo ufw status

# 3. Verificar Ollama está escuchando
sudo ss -tlnp | grep 11434

# 4. Verificar logs del firewall
sudo tail -50 /var/log/ufw.log | grep 11434
```

### Error: Connection Refused

- Ollama no está corriendo: `sudo systemctl status ollama`
- Ollama escucha solo en localhost: verificar `sudo ss -tlnp | grep 11434`

### Error: DNS Resolution Failed

- Verificar DNS: `nslookup t-800.norteamericano.cl`
- Debería resolver a `200.68.55.78`

---

## Variables de Entorno (.env)

En AWS EC2 (`/var/www/openccb/.env`):

```env
# IA Configuration
AI_PROVIDER=local
LOCAL_OLLAMA_URL=http://t-800.norteamericano.cl:11434
LOCAL_WHISPER_URL=http://t-800.norteamericano.cl:9000
LOCAL_LLM_MODEL=llama3.2:3b
LOCAL_LLM_MODEL_COMPLEX=qwen3.5:9b
LOCAL_LLM_MODEL_ADVANCED=gpt-oss:latest
EMBEDDING_MODEL=nomic-embed-text
WHISPER_MODEL=whisper-large-v3

# Frontend URLs
NEXT_PUBLIC_CMS_API_URL=https://studio.norteamericano.com
NEXT_PUBLIC_LMS_API_URL=https://learning.norteamericano.com

# Backend-to-backend (LMS -> CMS)
CMS_API_URL=http://studio:3001
```

---

## Comandos Útiles

### Reiniciar servicios en AWS EC2

```bash
ssh -i "ubuntu.pem" ubuntu@ec2-18-224-137-67.us-east-2.compute.amazonaws.com
cd /var/www/openccb
docker-compose restart
```

### Ver logs de IA

```bash
# En AWS EC2
docker logs openccb-studio 2>&1 | grep -iE '(ollama|ai|token)' | tail -30

# Verificar registros de uso de IA
docker exec openccb-db psql -U user -d openccb_cms -c \
  "SELECT COUNT(*) as total, SUM(tokens_used) as tokens FROM ai_usage_logs;"
```

### Testear IA desde AWS

```bash
# Test simple de Ollama
curl http://t-800.norteamericano.cl:11434/api/tags

# Test de generación de texto
curl -X POST http://t-800.norteamericano.cl:11434/api/generate -d '{
  "model": "llama3.2:3b",
  "prompt": "Hello, how are you?",
  "stream": false
}'
```

---

## Checklist de Verificación

- [ ] Port forwarding configurado en UniFi (11434, 9000)
- [ ] Firewall WAN In rules configuradas en UniFi
- [ ] Firewall Ubuntu en t-800 permite puertos
- [ ] Ollama escucha en `0.0.0.0:11434` (no `127.0.0.1`)
- [ ] DNS `t-800.norteamericano.cl` resuelve a `200.68.55.78`
- [ ] Curl desde AWS EC2 a `http://t-800.norteamericano.cl:11434/api/tags` funciona
- [ ] Login en `https://studio.norteamericano.com/auth/login` funciona
- [ ] Uso de IA se registra en `ai_usage_logs`
