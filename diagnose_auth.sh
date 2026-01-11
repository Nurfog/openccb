#!/bin/bash
echo "=== DIAGNÓSTICO DE AUTENTICACIÓN ==="
echo ""

# 1. Verificar que el backend acepta login
echo "1. Probando LOGIN directo al backend..."
RESPONSE=$(curl -s -X POST http://localhost:3001/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"juan.allende@gmail.com","password":"password123"}')

TOKEN=$(echo $RESPONSE | grep -o '"token":"[^"]*"' | cut -d'"' -f4)

if [ -z "$TOKEN" ]; then
    echo "❌ ERROR: No se pudo obtener token del backend"
    echo "Respuesta: $RESPONSE"
    exit 1
else
    echo "✅ Token obtenido exitosamente"
    echo "Token: ${TOKEN:0:50}..."
fi

echo ""
echo "2. Probando acceso a /courses CON el token..."
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" \
  -H "Authorization: Bearer $TOKEN" \
  http://localhost:3001/courses)

if [ "$HTTP_CODE" -eq 200 ]; then
    echo "✅ Acceso a /courses exitoso (200)"
else
    echo "❌ Acceso a /courses falló con código: $HTTP_CODE"
    # Mostrar respuesta completa
    curl -s -H "Authorization: Bearer $TOKEN" http://localhost:3001/courses
fi

echo ""
echo "3. Verificando JWT_SECRET en el contenedor..."
JWT_SECRET=$(docker exec openccb-studio-1 env | grep JWT_SECRET | cut -d'=' -f2)
echo "JWT_SECRET actual: $JWT_SECRET"

echo ""
echo "=== INSTRUCCIONES ==="
echo "Si el test 2 fue exitoso, el problema está en el navegador."
echo "Ejecuta en la consola del navegador (F12):"
echo ""
echo "  localStorage.clear();"
echo "  location.reload();"
echo ""
echo "Luego vuelve a hacer login."
