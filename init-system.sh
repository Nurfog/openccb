#!/bin/bash
set -e

# Default values
API_URL="http://localhost:3001"
DEFAULT_EMAIL="admin@example.com"
DEFAULT_PASSWORD="password123"
DEFAULT_ORG="Default Organization"
DEFAULT_NAME="System Admin"

echo "==============================================="
echo "   OpenCCB System Initialization Script"
echo "==============================================="
echo ""

# Check for curl and jq
if ! command -v curl &> /dev/null || ! command -v jq &> /dev/null; then
    echo "Error: 'curl' and 'jq' are required but not installed."
    echo "Please install them (e.g., sudo apt install curl jq) and try again."
    exit 1
fi

echo "This script will create the initial Administrator account and Organization."
echo "Press Enter to use the default value."
echo ""

read -p "Enter Organization Name [$DEFAULT_ORG]: " ORG_NAME
ORG_NAME=${ORG_NAME:-$DEFAULT_ORG}

read -p "Enter Admin Full Name [$DEFAULT_NAME]: " FULL_NAME
FULL_NAME=${FULL_NAME:-$DEFAULT_NAME}

read -p "Enter Admin Email [$DEFAULT_EMAIL]: " EMAIL
EMAIL=${EMAIL:-$DEFAULT_EMAIL}

read -s -p "Enter Admin Password [$DEFAULT_PASSWORD]: " PASSWORD
echo ""
PASSWORD=${PASSWORD:-$DEFAULT_PASSWORD}

echo ""
echo "Creating Administrator..."
echo "  Organization: $ORG_NAME"
echo "  User: $FULL_NAME <$EMAIL>"
echo "  Target API: $API_URL"
echo ""

# Prepare JSON payload
PAYLOAD=$(jq -n \
                  --arg email "$EMAIL" \
                  --arg password "$PASSWORD" \
                  --arg full_name "$FULL_NAME" \
                  --arg org_name "$ORG_NAME" \
                  --arg role "admin" \
                  '{email: $email, password: $password, full_name: $full_name, organization_name: $org_name, role: $role}')

# Execute Request
RESPONSE=$(curl -s -X POST "$API_URL/auth/register" \
     -H "Content-Type: application/json" \
     -d "$PAYLOAD")

# Check status based on JSON response structure (assuming successful response has a "token")
# We use grep here as a simple check, but could parse with jq for more robustness
if echo "$RESPONSE" | grep -q "token"; then
    echo "✅ Success! Administrator created."
    echo ""
    echo "Login Credentials:"
    echo "------------------"
    echo "Email:    $EMAIL"
    echo "Password: (hidden)"
    echo "Role:     admin"
    echo ""
    echo "You can now log in at: http://localhost:3000/auth/login"
else
    echo "❌ Failed to create administrator."
    echo "Server Response:"
    echo "$RESPONSE" | jq . 2>/dev/null || echo "$RESPONSE"
    exit 1
fi
