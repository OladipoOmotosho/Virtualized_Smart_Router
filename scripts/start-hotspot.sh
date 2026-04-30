#!/bin/bash
# start-hotspot.sh
# One-command bring-up of the AR9271 Wi-Fi access point inside the CentOS VM.
# Idempotent: safe to run multiple times. Run with --stop to tear down.
#
# Usage:
#   sudo bash scripts/start-hotspot.sh           # start
#   sudo bash scripts/start-hotspot.sh --stop    # stop
#   sudo bash scripts/start-hotspot.sh --status  # show what's running
#
# Lessons learned the hard way (don't change without reading):
# - firewalld DROPs unsolicited DHCP requests; must be stopped.
# - `systemctl restart hostapd` hangs on CentOS; we run hostapd as a child
#   process with output redirected to a log file.
# - NetworkManager will fight for control of wlp0s11u1; set managed=no first.
# - The AR9271 re-enumerates during mode switch; the VM USB filter handles it.

set -uo pipefail

# ── Configuration ─────────────────────────────────────────────────
AP_IFACE="${AP_IFACE:-wlp0s11u1}"
UPSTREAM_IFACE="${UPSTREAM_IFACE:-enp0s3}"
SSID="${SSID:-SmartRouter-Demo}"
WPA_PASS="${WPA_PASS:-SmartDemo2026}"
AP_IP="${AP_IP:-192.168.50.1}"
AP_SUBNET="${AP_SUBNET:-192.168.50.0/24}"
DHCP_RANGE="${DHCP_RANGE:-192.168.50.10,192.168.50.50,12h}"
CHANNEL="${CHANNEL:-1}"

LOG_DIR=/var/log/smart-router
HOSTAPD_CONF=/tmp/hostapd-ap.conf
DNSMASQ_CONF=/tmp/dnsmasq-ap.conf
HOSTAPD_LOG="${LOG_DIR}/hostapd.log"
DNSMASQ_LOG="${LOG_DIR}/dnsmasq.log"
HOSTAPD_PIDFILE=/tmp/hostapd-ap.pid
DNSMASQ_PIDFILE=/tmp/dnsmasq-ap.pid

log()  { echo "[hotspot] $*"; }
warn() { echo "[hotspot] WARN: $*" >&2; }
err()  { echo "[hotspot] ERROR: $*" >&2; }

# ── Stop / status ─────────────────────────────────────────────────
stop_hotspot() {
    log "stopping..."
    [[ -f "${HOSTAPD_PIDFILE}" ]] && sudo kill "$(cat "${HOSTAPD_PIDFILE}")" 2>/dev/null
    [[ -f "${DNSMASQ_PIDFILE}" ]] && sudo kill "$(cat "${DNSMASQ_PIDFILE}")" 2>/dev/null
    pkill -f "hostapd ${HOSTAPD_CONF}" 2>/dev/null || true
    pkill -f "dnsmasq.*${DNSMASQ_CONF}" 2>/dev/null || true
    iptables -t nat -D POSTROUTING -s "${AP_SUBNET}" -o "${UPSTREAM_IFACE}" -j MASQUERADE 2>/dev/null || true
    iptables -D FORWARD -i "${AP_IFACE}" -o "${UPSTREAM_IFACE}" -j ACCEPT 2>/dev/null || true
    iptables -D FORWARD -i "${UPSTREAM_IFACE}" -o "${AP_IFACE}" -m state --state RELATED,ESTABLISHED -j ACCEPT 2>/dev/null || true
    ip addr flush dev "${AP_IFACE}" 2>/dev/null || true
    ip link set "${AP_IFACE}" down 2>/dev/null || true
    nmcli device set "${AP_IFACE}" managed yes 2>/dev/null || true
    log "stopped"
    exit 0
}

show_status() {
    echo "── Smart Router hotspot status ──"
    if pgrep -f "hostapd ${HOSTAPD_CONF}" >/dev/null; then
        echo "  hostapd : RUNNING (pid $(pgrep -f "hostapd ${HOSTAPD_CONF}"))"
    else
        echo "  hostapd : not running"
    fi
    if pgrep -f "dnsmasq.*${DNSMASQ_CONF}" >/dev/null; then
        echo "  dnsmasq : RUNNING (pid $(pgrep -f "dnsmasq.*${DNSMASQ_CONF}"))"
    else
        echo "  dnsmasq : not running"
    fi
    echo ""
    echo "  AP iface: ${AP_IFACE} ($(ip -o -4 addr show "${AP_IFACE}" 2>/dev/null | awk '{print $4}' || echo "down"))"
    echo "  Connected stations:"
    sudo iw dev "${AP_IFACE}" station dump 2>/dev/null | grep "Station" | awk '{print "    " $2}' || echo "    (none)"
    echo ""
    echo "  Active leases:"
    if [[ -f /var/lib/misc/dnsmasq.leases ]]; then
        sudo awk '{printf "    %-18s %-18s %s\n", $3, $2, $4}' /var/lib/misc/dnsmasq.leases
    fi
    exit 0
}

case "${1:-}" in
    --stop)   stop_hotspot   ;;
    --status) show_status    ;;
esac

# ── Pre-flight ────────────────────────────────────────────────────
if [[ $EUID -ne 0 ]]; then
    err "Run as root: sudo bash $0"
    exit 1
fi

if ! ip link show "${AP_IFACE}" &>/dev/null; then
    err "Interface ${AP_IFACE} not found. Available wireless:"
    iw dev 2>/dev/null | awk '/Interface/{print "  " $2}' >&2
    err "Pass the dongle through (Devices → USB → AR9271) and re-run."
    exit 1
fi

mkdir -p "${LOG_DIR}"

# ── Stop firewalld and NetworkManager interference ────────────────
if systemctl is-active firewalld &>/dev/null; then
    log "stopping firewalld (it blocks DHCP)..."
    systemctl stop firewalld
fi
nmcli device set "${AP_IFACE}" managed no 2>/dev/null || true
rfkill unblock wlan 2>/dev/null || true

# ── Kill any leftover hostapd / dnsmasq instances ────────────────
pkill -f "hostapd ${HOSTAPD_CONF}" 2>/dev/null || true
pkill -f "dnsmasq.*${DNSMASQ_CONF}" 2>/dev/null || true
sleep 1

# ── Configure the AP interface ────────────────────────────────────
ip link set "${AP_IFACE}" down
ip addr flush dev "${AP_IFACE}"
ip addr add "${AP_IP}/24" dev "${AP_IFACE}"
ip link set "${AP_IFACE}" up
log "interface ${AP_IFACE} up at ${AP_IP}/24"

# ── Enable IP forwarding ──────────────────────────────────────────
sysctl -wq net.ipv4.ip_forward=1

# ── NAT phones to upstream ────────────────────────────────────────
add_rule() {
    local table_arg=""
    [[ "$1" == "-t" ]] && { table_arg="$1 $2"; shift 2; }
    iptables $table_arg -C "$@" 2>/dev/null || iptables $table_arg -A "$@"
}
add_rule -t nat POSTROUTING -s "${AP_SUBNET}" -o "${UPSTREAM_IFACE}" -j MASQUERADE
add_rule FORWARD -i "${UPSTREAM_IFACE}" -o "${AP_IFACE}" -m state --state RELATED,ESTABLISHED -j ACCEPT
add_rule FORWARD -i "${AP_IFACE}" -o "${UPSTREAM_IFACE}" -j ACCEPT
log "iptables NAT and FORWARD rules applied"

# ── Write hostapd config ──────────────────────────────────────────
cat > "${HOSTAPD_CONF}" <<EOF
interface=${AP_IFACE}
driver=nl80211
ssid=${SSID}
hw_mode=g
channel=${CHANNEL}
auth_algs=1
wpa=2
wpa_key_mgmt=WPA-PSK
wpa_pairwise=CCMP
rsn_pairwise=CCMP
wpa_passphrase=${WPA_PASS}
EOF

# ── Write dnsmasq config ──────────────────────────────────────────
cat > "${DNSMASQ_CONF}" <<EOF
interface=${AP_IFACE}
bind-interfaces
dhcp-range=${DHCP_RANGE}
dhcp-option=option:router,${AP_IP}
dhcp-option=option:dns-server,1.1.1.1,8.8.8.8
log-dhcp
EOF

# ── Start hostapd in background (don't use systemctl, it hangs) ──
nohup hostapd "${HOSTAPD_CONF}" > "${HOSTAPD_LOG}" 2>&1 &
echo $! > "${HOSTAPD_PIDFILE}"
sleep 2
if ! kill -0 "$(cat "${HOSTAPD_PIDFILE}")" 2>/dev/null; then
    err "hostapd failed to start. Last 20 lines of ${HOSTAPD_LOG}:"
    tail -20 "${HOSTAPD_LOG}" >&2
    exit 1
fi
log "hostapd started (pid $(cat "${HOSTAPD_PIDFILE}"), log: ${HOSTAPD_LOG})"

# ── Start dnsmasq in background ───────────────────────────────────
dnsmasq --conf-file="${DNSMASQ_CONF}" --pid-file="${DNSMASQ_PIDFILE}" \
        --log-facility="${DNSMASQ_LOG}"
sleep 1
if ! pgrep -f "dnsmasq.*${DNSMASQ_CONF}" >/dev/null; then
    err "dnsmasq failed to start. Check ${DNSMASQ_LOG}"
    exit 1
fi
log "dnsmasq started (pid $(cat "${DNSMASQ_PIDFILE}"), log: ${DNSMASQ_LOG})"

# ── Done ──────────────────────────────────────────────────────────
cat <<EOF

[hotspot] AP is live.
  SSID            : ${SSID}
  Password        : ${WPA_PASS}
  AP gateway IP   : ${AP_IP}
  DHCP range      : ${DHCP_RANGE}

  hostapd log     : tail -f ${HOSTAPD_LOG}
  dnsmasq log     : tail -f ${DNSMASQ_LOG}

  Status check    : sudo bash $0 --status
  Stop hotspot    : sudo bash $0 --stop

Connect a phone to "${SSID}" with password "${WPA_PASS}".
EOF
