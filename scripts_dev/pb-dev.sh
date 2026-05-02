#!/bin/bash
# Start PocketBase in development mode
# Admin UI: http://localhost:8090/_/
# API: http://localhost:8090/api/

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PB_DIR="$SCRIPT_DIR/../pocketbase"

if [ ! -f "$PB_DIR/pocketbase" ]; then
    echo "PocketBase binary not found. Downloading..."
    mkdir -p "$PB_DIR"
    PB_VERSION="0.37.5"
    curl -L "https://github.com/pocketbase/pocketbase/releases/download/v${PB_VERSION}/pocketbase_${PB_VERSION}_linux_amd64.zip" -o /tmp/pocketbase.zip
    unzip -o /tmp/pocketbase.zip pocketbase -d "$PB_DIR"
    rm /tmp/pocketbase.zip
    chmod +x "$PB_DIR/pocketbase"
    echo "PocketBase v${PB_VERSION} downloaded."
fi

echo "Starting PocketBase dev server..."
echo "  Admin UI: http://localhost:8090/_/"
echo "  API:      http://localhost:8090/api/"
echo ""
"$PB_DIR/pocketbase" serve --dir="$PB_DIR/pb_data" --publicDir="$PB_DIR/pb_public" --migrationsDir="$PB_DIR/pb_migrations"
