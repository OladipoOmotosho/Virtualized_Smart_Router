#!/bin/bash
# setup-hotspot.sh
# Turn an AR9271 USB dongle into a real Wi-Fi access point so phones can
# connect directly to the smart router. Connected phones get DHCP leases on
# 192.168.50.0/24 and reach the internet by NAT through the laptop's upstream
# interface (the onboard AX211 Wi-Fi, or Ethernet).
#
# This puts the laptop into the data path of the phone's traffic — every
# packet now traverses iptables FORWARD, which means the existing whitelist
# firewall, IPS monitor, and packet capture all enforce on real devices.
#
# Usage:
#   sudo bash scripts/setup-hotspot.sh                # start
#   sudo bash scripts/setup-hotspot.sh --stop         # tear down
#   sudo AP_IFACE=wlan1 SSID=MyAP bash scripts/setup-hotspot.sh
#
# Required: hostapd, dnsmasq, iw, iptables.
#   Ubuntu/Debian: sudo apt install -y hostapd dnsmasq iw iptables
#   Fedora/CentOS: sudo dnf install -y hostapd dnsmasq iw iptables

set -euo pipefail

# ── Configuration (override via env vars) ─────────────────────────
AP_IFACE="${AP_IFACE:-wlan1}"                 # AR9271 dongle interface
UPSTREAM_IFACE="${UPSTREAM_IFACE:-}"           # auto-detect if empty
SSID="${SSID:-SmartRouter-Demo}"
WPA_PASS="${WPA_PASS:-SmartDemo2026}"
AP_IP="${AP_IP:-192.168.50.1}"
AP_SUBNET="${AP_SUBNET:-192.168.50.0/24}"
DHCP_RANGE="${DHCP_RANGE:-192.168.50.10,192.168.50.50,12h}"
CHANNEL="${CHANNEL:-6}"
COUNTRY_CODE="${COUNTRY_CODE:-CA}"

HOSTAPD_CONF=/etc/hostapd/hostapd.conf
DNSMASQ_CONF=/etc/dnsmasq.d/smartrouter-hotspot.conf

# ── Helpers ───────────────────────────────────────────────────────
log() { echo "[hotspot] $*"; }

detect_upstream() {
    ip -o -4 route show default | awk '{print $5}' | head -n1
}

stop_hotspot() {
    log "stopping..."
    systemctl stop hostapd 2>/dev/null || true
    pkill -f "dnsmasq.*${DNSMASQ_CONF}" 2>/dev/null || true
    rm -f "${DNSMASQ_CONF}"

    if [[ -n "${UPSTREAM_IFACE}" ]]; then
        iptables -t nat -D POSTROUTING -s "${AP_SUBNET}" -o "${UPSTREAM_IFACE}" -j MASQUERADE 2>/dev/null || true
        iptables -D FORWARD -i "${AP_IFACE}" -o "${UPSTREAM_IFACE}" -j ACCEPT 2>/dev/null || true
        iptables -D FORWARD -i "${UPSTREAM_IFACE}" -o "${AP_IFACE}" -m state --state RELATED,ESTABLISHED -j ACCEPT 2>/dev/null || true
    fi

    ip addr flush dev "${AP_IFACE}" 2>/dev/null || true
    ip link set "${AP_IFACE}" down 2>/dev/null || true
    nmcli device set "${AP_IFACE}" managed yes 2>/dev/null || true
    log "stopped"
    exit 0
}

# ── Argument parsing ──────────────────────────────────────────────
if [[ "${1:-}" == "--stop" ]]; then
    UPSTREAM_IFACE="${UPSTREAM_IFACE:-$(detect_upstream)}"
    stop_hotspot
fi

# ── Pre-flight ────────────────────────────────────────────────────
if [[ $EUID -ne 0 ]]; then
    echo "Run as root: sudo bash $0" >&2
    exit 1
fi

for cmd in hostapd dnsmasq iw iptables; do
    command -v "$cmd" >/dev/null 2>&1 || { echo "Missing: $cmd" >&2; exit 1; }
done

if ! ip link show "${AP_IFACE}" &>/dev/null; then
    echo "Interface ${AP_IFACE} not found." >&2
    echo "Available wireless interfaces:" >&2
    iw dev 2>/dev/null | awk '/Interface/{print "  "$2}' >&2
    echo "Re-run with: sudo AP_IFACE=<name> bash $0" >&2
    exit 1
fi

if ! iw list 2>/dev/null | grep -A 8 "Supported interface modes" | grep -q "\* AP"; then
    log "WARNING: this interface may not advertise AP mode — continuing anyway"
fi

if [[ -z "${UPSTREAM_IFACE}" ]]; then
    UPSTREAM_IFACE="$(detect_upstream)"
fi
if [[ -z "${UPSTREAM_IFACE}" ]]; then
    echo "Could not detect upstream interface (no default route). Set UPSTREAM_IFACE manually." >&2
    exit 1
fi
if [[ "${UPSTREAM_IFACE}" == "${AP_IFACE}" ]]; then
    echo "AP_IFACE and UPSTREAM_IFACE are both ${AP_IFACE}. Connect the laptop to upstream Wi-Fi/Ethernet first." >&2
    exit 1
fi

log "AP interface  : ${AP_IFACE}"
log "Upstream      : ${UPSTREAM_IFACE}"
log "SSID          : ${SSID}"
log "AP IP         : ${AP_IP}"
log "DHCP range    : ${DHCP_RANGE}"
log "Channel       : ${CHANNEL}  (country=${COUNTRY_CODE})"

# ── Take the AP interface away from NetworkManager ────────────────
nmcli device set "${AP_IFACE}" managed no 2>/dev/null || true
rfkill unblock wlan 2>/dev/null || true

# ── Configure the AP interface with a static IP ───────────────────
ip link set "${AP_IFACE}" down
ip addr flush dev "${AP_IFACE}"
ip addr add "${AP_IP}/24" dev "${AP_IFACE}"
ip link set "${AP_IFACE}" up

# ── Enable IP forwarding ──────────────────────────────────────────
sysctl -w net.ipv4.ip_forward=1 >/dev/null

# ── NAT phones to the internet via the upstream interface ─────────
add_rule_if_missing() {
    local table_arg=""
    [[ "$1" == "-t" ]] && { table_arg="$1 $2"; shift 2; }
    iptables $table_arg -C "$@" 2>/dev/null || iptables $table_arg -A "$@"
}

add_rule_if_missing -t nat POSTROUTING -s "${AP_SUBNET}" -o "${UPSTREAM_IFACE}" -j MASQUERADE
add_rule_if_missing FORWARD -i "${UPSTREAM_IFACE}" -o "${AP_IFACE}" -m state --state RELATED,ESTABLISHED -j ACCEPT
add_rule_if_missing FORWARD -i "${AP_IFACE}" -o "${UPSTREAM_IFACE}" -j ACCEPT

# ── Write hostapd config ──────────────────────────────────────────
mkdir -p "$(dirname "${HOSTAPD_CONF}")"
cat > "${HOSTAPD_CONF}" <<EOF
interface=${AP_IFACE}
driver=nl80211
country_code=${COUNTRY_CODE}
ssid=${SSID}
hw_mode=g
channel=${CHANNEL}
ieee80211n=1
wmm_enabled=1
auth_algs=1
wpa=2
wpa_key_mgmt=WPA-PSK
wpa_pairwise=CCMP
rsn_pairwise=CCMP
wpa_passphrase=${WPA_PASS}
EOF
chmod 600 "${HOSTAPD_CONF}"

# Some distros wire hostapd through this file
if [[ -f /etc/default/hostapd ]]; then
    sed -i "s|^#*DAEMON_CONF=.*|DAEMON_CONF=\"${HOSTAPD_CONF}\"|" /etc/default/hostapd
fi

# ── Write dnsmasq config (DHCP for connected phones) ──────────────
mkdir -p "$(dirname "${DNSMASQ_CONF}")"
cat > "${DNSMASQ_CONF}" <<EOF
interface=${AP_IFACE}
bind-interfaces
dhcp-range=${DHCP_RANGE}
dhcp-option=option:router,${AP_IP}
dhcp-option=option:dns-server,1.1.1.1,8.8.8.8
log-dhcp
EOF

# ── Start services ────────────────────────────────────────────────
systemctl unmask hostapd 2>/dev/null || true
systemctl restart hostapd
log "hostapd started"

# Run dnsmasq directly so it doesn't fight a system-wide instance
pkill -f "dnsmasq.*${DNSMASQ_CONF}" 2>/dev/null || true
dnsmasq --conf-file="${DNSMASQ_CONF}" --pid-file=/run/smartrouter-dnsmasq.pid
log "dnsmasq started"

sleep 2
if ! systemctl is-active --quiet hostapd; then
    log "hostapd failed. Check: journalctl -u hostapd -n 50"
    exit 1
fi

cat <<EOF

[hotspot] AP is live.
  SSID            : ${SSID}
  Password        : ${WPA_PASS}
  Gateway IP      : ${AP_IP}
  DHCP range      : ${DHCP_RANGE}

Connect a phone to "${SSID}" then verify:
  ip neigh show dev ${AP_IFACE}
  cat /proc/net/arp | grep ${AP_IFACE}

Backend should now scan and find the phone via /proc/net/arp.
Tear down with: sudo bash scripts/setup-hotspot.sh --stop
EOF
