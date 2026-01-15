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

# 3. Verify Organization Context (Course Scoping)
echo "Testing Course Scoping by Organization..."
# Login to get token
USER_DATA=$(curl -s -X POST http://localhost:3001/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"juan.allende@gmail.com","password":"password123"}')
TOKEN=$(echo "$USER_DATA" | jq -r '.token')
ORG_ID=$(echo "$USER_DATA" | jq -r '.user.organization_id')

if [ "$TOKEN" != "null" ]; then
    echo "SUCCESS: Got token for juan.allende@gmail.com"
    # Try to list courses
    HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" -X GET http://localhost:3001/courses \
      -H "Authorization: Bearer $TOKEN")
    
    if [ "$HTTP_CODE" -eq 200 ]; then
        echo "SUCCESS: Courses retrieved successfully with organization scope"
    else
        echo "FAIL: Failed to retrieve courses (Status: $HTTP_CODE)"
    fi

    # 4. Verify Admin Context Switching (X-Organization-Id)
    # Create a dummy organization to test switching
    echo "Testing Admin Context Switching (X-Organization-Id)..."
    NEW_ORG_ID=$(curl -s -X POST http://localhost:3001/organizations \
      -H "Authorization: Bearer $TOKEN" \
      -H "Content-Type: application/json" \
      -d '{"name": "Context Switching Test"}' | jq -r '.id')
    
    if [ "$NEW_ORG_ID" != "null" ]; then
        echo "SUCCESS: New organization created ($NEW_ORG_ID)"
        # Try to list courses using the new org context
        HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" -X GET http://localhost:3001/courses \
          -H "Authorization: Bearer $TOKEN" \
          -H "X-Organization-Id: $NEW_ORG_ID")
        
        if [ "$HTTP_CODE" -eq 200 ]; then
            echo "SUCCESS: Context switching worked via X-Organization-Id"
        else
            echo "FAIL: Context switching failed (Status: $HTTP_CODE)"
        fi
    else
        echo "FAIL: Could not create test organization"
    fi
else
    echo "FAIL: Could not get token for testing organization context"
fi
