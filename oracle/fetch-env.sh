#!/bin/bash
# Pulls oracle secrets from AWS SSM and writes /opt/skillmint/oracle/.env
# Run as root (systemd ExecStartPre).
set -euo pipefail

REGION=ap-south-1
ENV_FILE=/opt/skillmint/oracle/.env

PRIVATE_KEY=$(aws ssm get-parameter --region "$REGION" --with-decryption --name /skillmint/oracle/private-key --query Parameter.Value --output text)
ORACLE_KEY=$(aws ssm get-parameter --region "$REGION" --with-decryption --name /skillmint/oracle/aes-key --query Parameter.Value --output text)
ORACLE_KEY_ID=$(aws ssm get-parameter --region "$REGION" --name /skillmint/oracle/aes-key-id --query Parameter.Value --output text)

umask 077
cat > "$ENV_FILE" <<EOF
PRIVATE_KEY=$PRIVATE_KEY
NETWORK=mainnet
ORACLE_KEY=$ORACLE_KEY
ORACLE_KEY_ID=$ORACLE_KEY_ID
ORACLE_API_PORT=3001
EOF
chmod 600 "$ENV_FILE"
echo "[fetch-env] OK"
