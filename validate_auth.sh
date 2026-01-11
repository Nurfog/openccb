#!/bin/bash
# 1. Verify Juan Login
echo "Testing Login for juan.allende@gmail.com..."
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST http://localhost:3001/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"juan.allende@gmail.com","password":"password123"}')

if [ "$HTTP_CODE" -eq 200 ]; then
    echo "SUCCESS: Login worked for juan.allende@gmail.com with password123"
else
    echo "FAIL: Login failed with status $HTTP_CODE"
    # Print body for debugging
    curl -s -X POST http://localhost:3001/auth/login \
      -H "Content-Type: application/json" \
      -d '{"email":"juan.allende@gmail.com","password":"password123"}'
    echo ""
fi

# 2. Verify New Registration
echo "Testing Registration for newuser@test.com..."
# Clear if exists
docker exec openccb-db-1 psql -U user -d openccb_cms -c "DELETE FROM users WHERE email='newuser@test.com';" > /dev/null 2>&1

HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST http://localhost:3001/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"newuser@test.com","password":"password123","full_name":"New User","role":"instructor"}')

if [ "$HTTP_CODE" -eq 200 ]; then
    echo "SUCCESS: Registration worked for newuser@test.com"
    # Cleanup
    docker exec openccb-db-1 psql -U user -d openccb_cms -c "DELETE FROM users WHERE email='newuser@test.com';" > /dev/null 2>&1
else
    echo "FAIL: Registration failed with status $HTTP_CODE"
    curl -s -X POST http://localhost:3001/auth/register \
      -H "Content-Type: application/json" \
      -d '{"email":"newuser@test.com","password":"password123","full_name":"New User","role":"instructor"}'
    echo ""
fi
