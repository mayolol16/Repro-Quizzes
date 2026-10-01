#!/usr/bin/env bash
# IMC534 USMLE Step 1 QBank One-Click Launcher

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"
cd "$DIR"

echo "=========================================================="
echo "🩺 IMC534 Reproductive & Endocrine USMLE Step 1 QBank"
echo "=========================================================="
echo "Directory: $DIR"
echo ""
echo "Starting local server at http://localhost:8080..."
echo "Opening your default browser..."

# Open browser after 1 second
(sleep 1 && open "http://localhost:8080") &

# Start python HTTP server
python3 -m http.server 8080
