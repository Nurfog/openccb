#!/bin/bash
# Script para limpiar tokens antiguos y forzar re-login

echo "=== Limpiando tokens antiguos de localStorage ==="
echo ""
echo "Por favor, ejecuta esto en la consola del navegador (F12 → Console):"
echo ""
echo "localStorage.removeItem('studio_token');"
echo "localStorage.removeItem('studio_user');"
echo "location.reload();"
echo ""
echo "Luego vuelve a hacer login con:"
echo "  Email: juan.allende@gmail.com"
echo "  Password: password123"
