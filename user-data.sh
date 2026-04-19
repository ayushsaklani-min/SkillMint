#!/bin/bash
set -e
exec > >(tee /var/log/oracle-bootstrap.log) 2>&1

# Install git + Node 22
dnf install -y git
curl -fsSL https://rpm.nodesource.com/setup_22.x | bash -
dnf install -y nodejs

# Clone repo
cd /opt
git clone https://github.com/ayushsaklani-min/SkillMint.git skillmint
cd skillmint/oracle

# Install deps
npm install --omit=dev --legacy-peer-deps

# Generate a fresh AES-256 key for prompt encryption if we don't have one
if [ -z "$ORACLE_KEY" ]; then
  ORACLE_KEY=$(openssl rand -hex 32)
fi

# Write env — keep PRIVATE_KEY and ORACLE_KEY out of git
cat > /opt/skillmint/oracle/.env <<EOF
PRIVATE_KEY=REDACTED_FROM_SSM
NETWORK=testnet
ORACLE_KEY=${ORACLE_KEY}
ORACLE_KEY_ID=oracle-v1
ORACLE_API_PORT=3001
EOF
chmod 600 /opt/skillmint/oracle/.env

# Open the HTTP port for the frontend proxy to reach us
firewall-cmd --permanent --add-port=3001/tcp 2>/dev/null || true
firewall-cmd --reload 2>/dev/null || true

# systemd unit
cat > /etc/systemd/system/skillmint-oracle.service <<'EOF'
[Unit]
Description=SkillMint Oracle
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/opt/skillmint/oracle
EnvironmentFile=/opt/skillmint/oracle/.env
ExecStart=/usr/bin/node src/index.js
Restart=always
RestartSec=5
StandardOutput=append:/var/log/skillmint-oracle.log
StandardError=append:/var/log/skillmint-oracle.log

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable skillmint-oracle
systemctl start skillmint-oracle
