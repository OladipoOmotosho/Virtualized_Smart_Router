#!/bin/bash
# reset-iptables.sh
# Flushes all iptables rules and resets chains to ACCEPT.
# Use this to return to a clean state during development/testing.
#
# WARNING: This removes all firewall enforcement. Only run on the dev VM.
# Usage: sudo bash scripts/reset-iptables.sh

set -euo pipefail

echo "Resetting iptables to default ACCEPT..."

# Flush all rules in filter table
iptables -F
iptables -X

# Flush NAT and mangle tables
iptables -t nat -F
iptables -t nat -X
iptables -t mangle -F
iptables -t mangle -X

# Set default policies to ACCEPT
iptables -P INPUT ACCEPT
iptables -P FORWARD ACCEPT
iptables -P OUTPUT ACCEPT

echo "Done. All iptables rules cleared."
echo "Run 'sudo python -m uvicorn main:app ...' and POST /api/firewall/apply to reapply rules."
