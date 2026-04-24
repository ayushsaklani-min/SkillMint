#!/bin/bash
# SkillMint Oracle EC2 bootstrap. Secrets live in AWS SSM (Parameter Store) —
# never in source. Instance must have an IAM role allowing:
#   ssm:GetParameter on /skillmint/oracle/*
#   kms:Decrypt on the default SSM key (via kms:ViaService condition)
set -e
exec > >(tee /var/log/oracle-bootstrap.log) 2>&1

# Install git + Node 22 + aws cli (aws is preinstalled on Amazon Linux 2023 but be explicit)
dnf install -y git awscli
curl -fsSL https://rpm.nodesource.com/setup_22.x | bash -
dnf install -y nodejs

# Clone repo
cd /opt
git clone https://github.com/ayushsaklani-min/SkillMint.git skillmint
cd skillmint/oracle

npm install --omit=dev --legacy-peer-deps
npm install --omit=dev --legacy-peer-deps --prefix ../shared

# Install the fetch-env hook
install -o root -g root -m 755 fetch-env.sh /opt/skillmint/oracle/fetch-env.sh

# Open the HTTP port for the frontend proxy
firewall-cmd --permanent --add-port=3001/tcp 2>/dev/null || true
firewall-cmd --reload 2>/dev/null || true

# systemd unit — ExecStartPre pulls fresh secrets from SSM on every start
cat > /etc/systemd/system/skillmint-oracle.service <<'EOF'
[Unit]
Description=SkillMint Oracle
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=root
WorkingDirectory=/opt/skillmint/oracle
ExecStartPre=/opt/skillmint/oracle/fetch-env.sh
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
