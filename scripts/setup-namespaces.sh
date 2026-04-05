#!/bin/bash
# setup-namespaces.sh
# Creates Linux network namespaces and veth pairs to simulate IoT devices.
# Run as root on the CentOS 9 VM.
#
# Usage: sudo bash scripts/setup-namespaces.sh
# Each simulated device gets:
#   - A network namespace named ns<N>
#   - A veth pair: veth<N> (host side) <-> veth<N>-peer (namespace side)
#   - An IP address in the 10.0.0.0/24 subnet

set -euo pipefail

GATEWAY_IP="10.0.0.1"
GATEWAY_IFACE="eth0"   # Change to your actual outbound interface
NUM_DEVICES=3          # Number of simulated IoT devices to create

# Enable IP forwarding
echo 1 > /proc/sys/net/ipv4/ip_forward

# Create a bridge to connect all veth interfaces
ip link add name br-iot type bridge 2>/dev/null || true
ip addr add "${GATEWAY_IP}/24" dev br-iot 2>/dev/null || true
ip link set br-iot up

for i in $(seq 1 "${NUM_DEVICES}"); do
    NS="ns${i}"
    VETH_HOST="veth${i}"
    VETH_PEER="veth${i}-peer"
    DEVICE_IP="10.0.0.$((i + 1))"

    echo "Creating namespace ${NS} with IP ${DEVICE_IP}..."

    # Create namespace
    ip netns add "${NS}" 2>/dev/null || echo "  Namespace ${NS} already exists"

    # Create veth pair
    ip link add "${VETH_HOST}" type veth peer name "${VETH_PEER}" 2>/dev/null || true

    # Move peer into namespace
    ip link set "${VETH_PEER}" netns "${NS}"

    # Configure host side
    ip link set "${VETH_HOST}" master br-iot
    ip link set "${VETH_HOST}" up

    # Configure namespace side
    ip netns exec "${NS}" ip addr add "${DEVICE_IP}/24" dev "${VETH_PEER}"
    ip netns exec "${NS}" ip link set "${VETH_PEER}" up
    ip netns exec "${NS}" ip link set lo up
    ip netns exec "${NS}" ip route add default via "${GATEWAY_IP}"

    echo "  Done: ${NS} → ${DEVICE_IP} via ${VETH_HOST}"
done

# NAT for outbound traffic
iptables -t nat -A POSTROUTING -s 10.0.0.0/24 -o "${GATEWAY_IFACE}" -j MASQUERADE 2>/dev/null || true

echo ""
echo "Namespace setup complete. Devices:"
for i in $(seq 1 "${NUM_DEVICES}"); do
    echo "  ns${i}: 10.0.0.$((i + 1))"
done
