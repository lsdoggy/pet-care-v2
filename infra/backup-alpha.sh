#!/usr/bin/env bash
set -euo pipefail
umask 077

if [[ $# -ne 1 || $1 != /* ]]; then
    echo "Usage: bash $0 /absolute/path/to/backup-directory" >&2
    exit 2
fi

backup_dir=$1
cd -- "$(dirname -- "${BASH_SOURCE[0]}")"
compose=(docker compose --env-file .env -f compose.vps.yml)

if [[ -n $("${compose[@]}" ps -q --status running backend) ]]; then
    echo "Stop the backend before backing up the database and uploads." >&2
    exit 1
fi

mkdir -p -- "$backup_dir"
staging=$(mktemp -d "$backup_dir/.alpha-XXXXXXXX")
trap 'rm -rf -- "$staging"' EXIT
snapshot="$backup_dir/alpha-$(date -u +%Y%m%dT%H%M%SZ)-${staging##*-}"

"${compose[@]}" exec -T postgres sh -ec '
    export PGPASSWORD="$POSTGRES_PASSWORD"
    exec pg_dump --host=127.0.0.1 --username="$POSTGRES_USER" --dbname="$POSTGRES_DB" --format=custom
' > "$staging/database.dump"

"${compose[@]}" run --rm --no-deps -T --entrypoint tar backend \
    -C /app/uploads -czf - . > "$staging/uploads.tar.gz"

(
    cd -- "$staging"
    sha256sum database.dump uploads.tar.gz > SHA256SUMS
)
mv -T -- "$staging" "$snapshot"
printf '%s\n' "$snapshot"
