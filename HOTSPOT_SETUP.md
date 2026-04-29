# WiFi Hotspot Setup Guide

## ✅ Current Status

**Hotspot is RUNNING and ready for devices to connect!**

```
SSID: SmartRouter-Demo
Password: SmartDemo2026
IP Range: 10.0.0.50 - 10.0.0.150
Gateway: 10.0.0.1
DNS: 8.8.8.8, 8.8.4.4
```

### Services Status
- ✅ **hostapd** - Broadcasting WiFi hotspot
- ✅ **dnsmasq** - DHCP server and DNS
- ✅ **Backend API** - Running on http://localhost:8000
- ✅ **Frontend** - Running on http://localhost:5173

### Interface Configuration
- **WiFi Interface**: `wlx24ec999b47e8` (AR9271)
- **IP Address**: `10.0.0.1/24` (gateway)
- **State**: UP, LOWER_UP

---

## 📱 How to Connect Your Phone

### Step 1: Find the WiFi Network
1. On your phone, go to WiFi settings
2. Look for **"SmartRouter-Demo"**
3. Select it

### Step 2: Enter Password
- **Password**: `SmartDemo2026`

### Step 3: Connect
- Wait for connection confirmation
- Phone should get IP from range `10.0.0.50 - 10.0.0.150`

### Step 4: Verify Connection
Check if phone appears in the gateway:
```bash
curl -s -X POST http://localhost:8000/api/devices/scan | jq '.'
```

Look for your phone's MAC address in the response.

---

## 🖥️ Testing Real Device

### Test Function 1: Device Discovery
1. **Phone connects to hotspot** (steps above)
2. **Open browser**: `http://localhost:5173`
3. **Go to Devices page**
4. **Click "Scan Network"**
5. **Verify** your phone appears with:
   - ✅ IPv4: `10.0.0.xx`
   - ✅ MAC address
   - ✅ Vendor info

### Edit Device Metadata
1. **Click "Edit"** on your phone device
2. **Fill in fields**:
   - Name: "My Test Phone"
   - Model: "iPhone 15" (or your model)
   - Version: "iOS 17" (or your version)
   - Description: "Testing gateway"
3. **Click "Save"**
4. **Refresh page** (F5)
5. **Verify** changes persist ✅

---

## 🔧 Manual Service Management

### Start Hotspot
```bash
sudo dnsmasq --conf-file=/etc/dnsmasq.conf > /tmp/dnsmasq.log 2>&1 &
sudo hostapd -B /etc/hostapd/hostapd.conf > /tmp/hostapd.log 2>&1
```

### Stop Hotspot
```bash
sudo killall dnsmasq hostapd
```

### Check Logs
```bash
cat /tmp/dnsmasq.log
cat /tmp/hostapd.log
```

### View Connected Clients
```bash
sudo hostapd_cli -i wlx24ec999b47e8 list_sta
```

---

## 📝 Configuration Files

### `/etc/hostapd/hostapd.conf`
```
interface=wlx24ec999b47e8
driver=nl80211
country_code=US
ssid=SmartRouter-Demo
hw_mode=g
channel=6
ieee80211n=1
wmm_enabled=1
auth_algs=1
wpa=2
wpa_key_mgmt=WPA-PSK
wpa_pairwise=CCMP
rsn_pairwise=CCMP
wpa_passphrase=SmartDemo2026
```

### `/etc/dnsmasq.conf`
```
interface=wlx24ec999b47e8
bind-interfaces
dhcp-range=10.0.0.50,10.0.0.150,24h
dhcp-option=option:router,10.0.0.1
dhcp-option=option:dns-server,8.8.8.8,8.8.4.4
server=8.8.8.8
server=8.8.4.4
log-dhcp
log-facility=/var/log/dnsmasq.log
```

---

## ❓ Troubleshooting

### Phone Can't Find Network
- Verify hostapd is running: `sudo hostapd_cli ping`
- Check interface: `ip link show wlx24ec999b47e8`
- Restart: `sudo killall hostapd && sleep 2 && sudo hostapd -B /etc/hostapd/hostapd.conf`

### Phone Gets No IP
- Verify dnsmasq: `sudo lsof -i :53`
- Check DHCP logs: `tail /tmp/dnsmasq.log`
- Restart: `sudo killall dnsmasq && sleep 1 && sudo dnsmasq --conf-file=/etc/dnsmasq.conf`

### Phone Can't Access Internet
- Verify NAT: `sudo iptables -L -n | grep MASQUERADE`
- Enable forwarding: `sudo sysctl -w net.ipv4.ip_forward=1`

### Device Not Appearing in Scan
- Check ARP table: `ip neigh show`
- Check DHCP leases: `cat /var/lib/dnsmasq/dnsmasq.leases`
- Manually trigger device with: `ping 10.0.0.100` (or device IP)

---

## 📊 Next Steps

After phone connects and appears in Devices:

1. **Function 2** - Packet Capture: Generate traffic, start capture
2. **Function 3** - Firewall: Create allow rule, test traffic
3. **Function 4** - IPS: Trigger anomaly detection
4. **Function 5** - Logs: View traffic chart
5. **Function 6** - Delete/Purge: Test cleanup

See `task.md` for full testing plan.
