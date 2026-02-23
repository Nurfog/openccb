#!/bin/bash
# 1. Verificar Login de Juan
echo "Probando Login para juan.allende@gmail.com..."
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST http://localhost:3001/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"juan.allende@gmail.com","password":"password123"}')

if [ "$HTTP_CODE" -eq 200 ]; then
    echo "ÉXITO: El login funcionó para juan.allende@gmail.com con password123"
else
    echo "FALLO: El login falló con estado $HTTP_CODE"
    # Imprimir cuerpo para depuración
    curl -s -X POST http://localhost:3001/auth/login \
      -H "Content-Type: application/json" \
      -d '{"email":"juan.allende@gmail.com","password":"password123"}'
    echo ""
fi

# 3. Verificar Contexto de Organización (Scoping de Cursos)
echo "Probando Scoping de Cursos por Organización..."
# Login para obtener token
USER_DATA=$(curl -s -X POST http://localhost:3001/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"juan.allende@gmail.com","password":"password123"}')
TOKEN=$(echo "$USER_DATA" | jq -r '.token')
ORG_ID=$(echo "$USER_DATA" | jq -r '.user.organization_id')

if [ "$TOKEN" != "null" ]; then
    echo "ÉXITO: Se obtuvo el token para juan.allende@gmail.com"
    # Intentar listar cursos
    HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" -X GET http://localhost:3001/courses \
      -H "Authorization: Bearer $TOKEN")
    
    if [ "$HTTP_CODE" -eq 200 ]; then
        echo "ÉXITO: Cursos recuperados correctamente con scope de organización"
    else
        echo "FALLO: Error al recuperar cursos (Estado: $HTTP_CODE)"
    fi

    # 4. Verificar Cambio de Contexto de Admin (X-Organization-Id)
    # Crear una organización ficticia para probar el cambio
    echo "Probando Cambio de Contexto de Admin (X-Organization-Id)..."
    NEW_ORG_ID=$(curl -s -X POST http://localhost:3001/organizations \
      -H "Authorization: Bearer $TOKEN" \
      -H "Content-Type: application/json" \
      -d '{"name": "Prueba de Cambio de Contexto"}' | jq -r '.id')
    
    if [ "$NEW_ORG_ID" != "null" ]; then
        echo "ÉXITO: Nueva organización creada ($NEW_ORG_ID)"
        # Intentar listar cursos usando el nuevo contexto de org
        HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" -X GET http://localhost:3001/courses \
          -H "Authorization: Bearer $TOKEN" \
          -H "X-Organization-Id: $NEW_ORG_ID")
        
        if [ "$HTTP_CODE" -eq 200 ]; then
            echo "ÉXITO: El cambio de contexto funcionó vía X-Organization-Id"
        else
            echo "FALLO: El cambio de contexto falló (Estado: $HTTP_CODE)"
        fi
    else
        echo "FALLO: No se pudo crear la organización de prueba"
    fi
else
    echo "FALLO: No se pudo obtener el token para probar el contexto de organización"
fi
