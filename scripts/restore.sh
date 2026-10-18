#!/bin/sh
set -eu
cd "$(dirname "$0")/.."
restore_path="${1:?用法: sh scripts/restore.sh backups/备份文件.tar.gz}"
tar -tzf "$restore_path" >/dev/null
docker compose stop travelmemo
docker compose run --rm --no-deps -T --user root --entrypoint sh travelmemo -c 'test -z "$(ls -A /app/data)" || { echo "恢复目标必须为空；请先备份并使用新数据卷" >&2; exit 1; }; tar -C /app/data -xzf -; chown -R node:node /app/data' < "$restore_path"
docker compose up -d --force-recreate travelmemo
