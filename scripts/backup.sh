#!/bin/sh
set -eu
cd "$(dirname "$0")/.."
mkdir -p backups
backup_path="backups/travelmemo-$(date +%Y%m%d-%H%M%S).tar.gz"
docker compose stop travelmemo
trap 'docker compose start travelmemo >/dev/null' EXIT
docker compose run --rm --no-deps -T --user root --entrypoint sh travelmemo -c 'tar -C /app/data -czf - .' > "$backup_path"
tar -tzf "$backup_path" >/dev/null
printf '%s\n' "$backup_path"
