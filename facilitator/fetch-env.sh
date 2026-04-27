#!/bin/bash
# Pulls facilitator secrets from AWS SSM and writes /opt/skillmint/facilitator/.env
# Run as root (systemd ExecStartPre).
set -euo pipefail

REGION=ap-south-1
ENV_FILE=/opt/skillmint/facilitator/.env

# Facilitator key: dedicated parameter if set, otherwise reuse the oracle key
# (single-wallet demo posture on testnet). On mainnet, populate /skillmint/facilitator/private-key.
if aws ssm get-parameter --region "$REGION" --name /skillmint/facilitator/private-key >/dev/null 2>&1; then
  FACILITATOR_KEY=$(aws ssm get-parameter --region "$REGION" --with-decryption --name /skillmint/facilitator/private-key --query Parameter.Value --output text)
else
  FACILITATOR_KEY=$(aws ssm get-parameter --region "$REGION" --with-decryption --name /skillmint/oracle/private-key --query Parameter.Value --output text)
fi

umask 077
cat > "$ENV_FILE" <<EOF
FACILITATOR_KEY=$FACILITATOR_KEY
NETWORK=0g-mainnet
FACILITATOR_PORT=3002
EOF
chmod 600 "$ENV_FILE"
echo "[fetch-env] facilitator OK"
