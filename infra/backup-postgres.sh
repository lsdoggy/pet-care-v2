#!/usr/bin/env bash
set -euo pipefail
umask 077

if [[ $# -ne 1 || $1 != /* ]]; then
    echo "Usage: $0 /absolute/path/to/backup-directory" >&2
    exit 2
fi

backup_dir=$1
cd -- "$(dirname -- "${BASH_SOURCE[0]}")"
compose=(docker compose --env-file .env -f compose.vps.yml)
mkdir -p -- "$backup_dir"
temp_dump=$(mktemp "$backup_dir/.petcare-XXXXXXXX")
trap 'rm -f -- "$temp_dump"' EXIT

"${compose[@]}" exec -T postgres sh -ec '
    export PGPASSWORD="$POSTGRES_PASSWORD"
    exec pg_dump --host=127.0.0.1 --username="$POSTGRES_USER" --dbname="$POSTGRES_DB" --format=custom
' > "$temp_dump"

dump="$backup_dir/petcare-$(date -u +%Y%m%dT%H%M%SZ)-${temp_dump##*-}.dump"
mv -- "$temp_dump" "$dump"
find "$backup_dir" -maxdepth 1 -type f -name 'petcare-*.dump' -mtime +13 -delete
printf '%s\n' "$dump"
