#!/bin/bash
# ==============================================================================
# IRIV Vision Studio - Platform Updater Script
# Handles safe automated OTA & Offline updates with auto-backup,
# dependency synchronization, DB migration, and service restart.
# ==============================================================================

set -euo pipefail
export GIT_TERMINAL_PROMPT=0

# ── Paths & Constants ─────────────────────────────────────────────────────────
PROJECT_ROOT="/home/pi/iriv-vision-studio"
BACKUP_BASE_DIR="/home/pi/iriv-backups"
STATUS_FILE="/tmp/iriv_update_status.json"
LOG_FILE="/tmp/iriv_update.log"
LOCK_FILE="/tmp/iriv_update.lock"

MODE="online"           # "online" or "offline"
TARGET_VERSION="main"   # Tag, commit, or branch
PACKAGE_PATH=""         # Path to uploaded .tar.gz for offline mode

# ── Parse Arguments ───────────────────────────────────────────────────────────
for arg in "$@"; do
    case $arg in
        --mode=*)
            MODE="${arg#*=}"
            ;;
        --target-version=*)
            TARGET_VERSION="${arg#*=}"
            ;;
        --package-path=*)
            PACKAGE_PATH="${arg#*=}"
            ;;
        *)
            ;;
    esac
done

# ── Helper: JSON Log & Status Writer ──────────────────────────────────────────
update_status() {
    local status="$1"
    local step="$2"
    local progress="$3"
    local message="$4"
    local timestamp
    timestamp=$(date +%s)

    echo "[$(date '+%Y-%m-%d %H:%M:%S')] [$step] $message" >> "$LOG_FILE"

    # Escape quotes for JSON
    local safe_msg
    safe_msg=$(echo "$message" | sed 's/"/\\"/g')

    # Read last 15 lines of logs for UI display
    local recent_logs="[]"
    if [ -f "$LOG_FILE" ]; then
        recent_logs=$(tail -n 15 "$LOG_FILE" | python3 -c '
import sys, json
lines = [line.strip() for line in sys.stdin if line.strip()]
print(json.dumps(lines))
' 2>/dev/null || echo "[]")
    fi

    cat <<EOF > "$STATUS_FILE.tmp"
{
  "status": "$status",
  "step": "$step",
  "progress": $progress,
  "message": "$safe_msg",
  "timestamp": $timestamp,
  "logs": $recent_logs
}
EOF
    mv "$STATUS_FILE.tmp" "$STATUS_FILE"
}

# ── Error Handler ─────────────────────────────────────────────────────────────
CURRENT_BACKUP_DIR=""

handle_error() {
    local line_no="$1"
    local exit_code="${2:-1}"
    local err_msg="Update failed at line $line_no (Exit code: $exit_code)"
    echo "ERROR: $err_msg" >> "$LOG_FILE"

    if [ -n "$CURRENT_BACKUP_DIR" ] && [ -d "$CURRENT_BACKUP_DIR" ]; then
        echo "Attempting to restore database from backup $CURRENT_BACKUP_DIR..." >> "$LOG_FILE"
        cp -r "$CURRENT_BACKUP_DIR/db/"* "$PROJECT_ROOT/backend/db/" 2>/dev/null || true
    fi

    update_status "failed" "error" 0 "$err_msg"
    rm -f "$LOCK_FILE"
    exit "$exit_code"
}

trap 'handle_error $LINENO $?' ERR

# ── Prevent Concurrent Updates ────────────────────────────────────────────────
if [ -f "$LOCK_FILE" ]; then
    PID=$(cat "$LOCK_FILE" 2>/dev/null || echo "")
    if [ -n "$PID" ] && kill -0 "$PID" 2>/dev/null; then
        echo "Another update process (PID $PID) is already running." >> "$LOG_FILE"
        exit 1
    fi
fi
echo "$$" > "$LOCK_FILE"
echo "" > "$LOG_FILE"

update_status "running" "init" 5 "Starting IRIV Vision Studio update process (Mode: $MODE)..."

# ── Step 1: Create Pre-update Backup ──────────────────────────────────────────
update_status "running" "backup" 15 "Backing up database and configuration..."
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
CURRENT_BACKUP_DIR="$BACKUP_BASE_DIR/backup_$TIMESTAMP"
mkdir -p "$CURRENT_BACKUP_DIR/db"

if [ -d "$PROJECT_ROOT/backend/db" ]; then
    cp -r "$PROJECT_ROOT/backend/db/"* "$CURRENT_BACKUP_DIR/db/" 2>/dev/null || true
fi
if [ -f "$PROJECT_ROOT/backend/.env" ]; then
    cp "$PROJECT_ROOT/backend/.env" "$CURRENT_BACKUP_DIR/" 2>/dev/null || true
fi

# Rotate backups: keep last 5 backups
mkdir -p "$BACKUP_BASE_DIR"
cd "$BACKUP_BASE_DIR"
ls -dt backup_* 2>/dev/null | tail -n +6 | xargs -r rm -rf

echo "Backup created at $CURRENT_BACKUP_DIR" >> "$LOG_FILE"
update_status "running" "backup" 30 "Backup completed successfully."

# ── Step 2: Apply Updates (Git or Offline Package) ────────────────────────────
cd "$PROJECT_ROOT"

if [ "$MODE" = "online" ]; then
    update_status "running" "pull" 40 "Fetching latest updates from remote repository..."
    
    # Prevent SQLite git conflicts
    git update-index --assume-unchanged backend/db/vision_studio.sqlite backend/db/vision_studio.sqlite-shm backend/db/vision_studio.sqlite-wal 2>/dev/null || true

    git fetch origin --tags >> "$LOG_FILE" 2>&1

    if [ "$TARGET_VERSION" != "main" ] && [ "$TARGET_VERSION" != "origin/main" ]; then
        update_status "running" "pull" 55 "Checking out release tag/commit: $TARGET_VERSION..."
        git checkout -f "$TARGET_VERSION" >> "$LOG_FILE" 2>&1
    else
        update_status "running" "pull" 55 "Updating branch main to latest origin/main..."
        git checkout -f main >> "$LOG_FILE" 2>&1
        git pull origin main >> "$LOG_FILE" 2>&1
    fi

elif [ "$MODE" = "offline" ]; then
    if [ -z "$PACKAGE_PATH" ] || [ ! -f "$PACKAGE_PATH" ]; then
        echo "Offline package not found at: $PACKAGE_PATH" >> "$LOG_FILE"
        exit 2
    fi

    update_status "running" "pull" 45 "Extracting offline update package..."
    TMP_EXTRACT="/tmp/iriv_update_extracted"
    rm -rf "$TMP_EXTRACT"
    mkdir -p "$TMP_EXTRACT"
    tar -xzf "$PACKAGE_PATH" -C "$TMP_EXTRACT" >> "$LOG_FILE" 2>&1

    update_status "running" "pull" 55 "Applying updated files..."
    # Sync files excluding database, models, and local logs
    rsync -av --exclude='backend/db/*.sqlite*' \
              --exclude='backend/.env' \
              --exclude='backend/models/*.hef' \
              --exclude='snapshots/' \
              --exclude='*.log' \
              "$TMP_EXTRACT/" "$PROJECT_ROOT/" >> "$LOG_FILE" 2>&1
    rm -rf "$TMP_EXTRACT"
fi

# Re-ensure assume-unchanged on DB files
git update-index --assume-unchanged backend/db/vision_studio.sqlite backend/db/vision_studio.sqlite-shm backend/db/vision_studio.sqlite-wal 2>/dev/null || true

# ── Step 3: Install & Sync Dependencies ───────────────────────────────────────
update_status "running" "install" 70 "Checking and installing dependencies..."

# Python dependencies
if [ -f "$PROJECT_ROOT/backend/requirements.txt" ]; then
    echo "Syncing Python requirements..." >> "$LOG_FILE"
    if [ -d "$PROJECT_ROOT/backend/venv" ]; then
        # shellcheck disable=SC1091
        source "$PROJECT_ROOT/backend/venv/bin/activate"
        pip install --no-cache-dir -r "$PROJECT_ROOT/backend/requirements.txt" >> "$LOG_FILE" 2>&1 || true
    fi
fi

# Frontend dependencies
if [ -f "$PROJECT_ROOT/frontend/package.json" ]; then
    echo "Syncing Frontend packages..." >> "$LOG_FILE"
    cd "$PROJECT_ROOT/frontend"
    npm install --prefer-offline >> "$LOG_FILE" 2>&1 || true
fi

# ── Step 4: Run Database Migrations ───────────────────────────────────────────
update_status "running" "migrate" 85 "Applying database schema migrations..."
if [ -f "$PROJECT_ROOT/backend/db/migrate.py" ]; then
    cd "$PROJECT_ROOT"
    if [ -d "$PROJECT_ROOT/backend/venv" ]; then
        # shellcheck disable=SC1091
        source "$PROJECT_ROOT/backend/venv/bin/activate"
        python3 -m backend.db.migrate >> "$LOG_FILE" 2>&1 || true
    fi
fi

# ── Step 5: Restart Platform Service ──────────────────────────────────────────
update_status "running" "restart" 95 "Restarting IRIV Vision Studio services..."
echo "Restarting service iriv-vision.service..." >> "$LOG_FILE"

# Sleep briefly to ensure web API sends response to frontend
sleep 1

# Mark status completed before restart so polling or file check sees it
update_status "completed" "done" 100 "Update completed successfully! Platform is restarting..."
rm -f "$LOCK_FILE"

# Trigger systemctl restart
if command -v systemctl >/dev/null 2>&1; then
    sudo systemctl restart iriv-vision.service || true
else
    # Fallback if not running as systemd
    pkill -f "uvicorn web_server.main" 2>/dev/null || true
fi

echo "Platform updater finished." >> "$LOG_FILE"
exit 0
