#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
NODE="$(command -v node)"
UNIT_DIR="${XDG_CONFIG_HOME:-$HOME/.config}/systemd/user"
SERVICE="qms-streak-daemon.service"
mkdir -p "$UNIT_DIR"
cat >"$UNIT_DIR/$SERVICE" <<EOF
[Unit]
Description=QMS Testnet Streak daemon (daily on-chain checks, 24h interval)
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
WorkingDirectory=$ROOT
ExecStart=$NODE scripts/streak-daemon.mjs
Restart=always
RestartSec=30
Environment=NODE_NO_WARNINGS=1

[Install]
WantedBy=default.target
EOF
if command -v systemctl >/dev/null 2>&1; then
  systemctl --user daemon-reload
  systemctl --user enable --now "$SERVICE"
  echo "已安装并启动用户服务：$SERVICE"
  echo "查看日志：journalctl --user -u $SERVICE -f"
  echo "可选：在 $ROOT/.secrets/daemon.env 写入 QMS_KEYSTORE_PASSWORD=..."
else
  echo "未找到 systemctl；已写入 $UNIT_DIR/$SERVICE，请手动启用。"
fi
