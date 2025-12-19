#!/bin/bash

# OpenCCB Database Management Script
# This script handles creation, migrations and sqlx preparation for both microservices.

set -e

# Load environment variables if .env exists
if [ -f .env ]; then
    export $(grep -v '^#' .env | xargs)
fi

# Fallback to DATABASE_URL if specific ones aren't set
# Note: For running locally against Docker Postgres, use localhost instead of db
CMS_URL=${CMS_DATABASE_URL:-$(echo $DATABASE_URL | sed 's/@db:/@localhost:/')}
LMS_URL=${LMS_DATABASE_URL:-$(echo $DATABASE_URL | sed 's/@db:/@localhost:/')}

if [ -z "$CMS_URL" ] || [ -z "$LMS_URL" ]; then
    echo "Error: CMS_DATABASE_URL or LMS_DATABASE_URL is not set."
    echo "Please check your .env file."
    exit 1
fi

ACTION=$1

case $ACTION in
    "setup")
        echo "--- Creating Databases ---"
        DATABASE_URL=$CMS_URL sqlx database create
        DATABASE_URL=$LMS_URL sqlx database create
        echo "Databases created (if they didn't exist)."
        $0 migrate
        ;;
        
    "migrate")
        echo "--- Running CMS Migrations ---"
        DATABASE_URL=$CMS_URL sqlx migrate run --source services/cms-service/migrations
        
        echo "--- Running LMS Migrations ---"
        DATABASE_URL=$LMS_URL sqlx migrate run --source services/lms-service/migrations
        
        echo "All migrations completed successfully."
        ;;
        
    "prepare")
        echo "--- Preparing SQLx queries for CMS ---"
        cd services/cms-service && DATABASE_URL=$CMS_URL cargo sqlx prepare -- --all-targets --all-features && cd ../..
        
        echo "--- Preparing SQLx queries for LMS ---"
        cd services/lms-service && DATABASE_URL=$LMS_URL cargo sqlx prepare -- --all-targets --all-features && cd ../..
        
        echo "SQLx preparation completed."
        ;;
        
    "all")
        $0 setup
        $0 prepare
        ;;
        
    *)
        echo "Usage: $0 {setup|migrate|prepare|all}"
        echo "  setup:   Creates databases and runs migrations"
        echo "  migrate: Runs database migrations for all services"
        echo "  prepare: Runs cargo sqlx prepare for offline compilation"
        echo "  all:     Runs setup and prepare"
        exit 1
        ;;
esac
