# host-scan.ps1
# Scan the Windows host's ARP cache for devices on the mobile hotspot and POST
# them to the backend's /api/devices/external-scan endpoint.
#
# Why this exists: when the backend runs inside a VirtualBox VM in NAT mode, it
# cannot see the hotspot's ARP table — that lives on the Windows host. This
# script is the bridge: it reads `arp -a`, filters to the hotspot subnet, and
# pushes the results into the backend so the UI shows real connected devices.
#
# Usage (from PowerShell on the Windows host):
#   .\scripts\host-scan.ps1
#   .\scripts\host-scan.ps1 -Subnet "192.168.137."
#   .\scripts\host-scan.ps1 -BackendUrl "http://localhost:8000" -Loop
#
# If you get "running scripts is disabled" errors, run PowerShell once as admin:
#   Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned

param(
    [string]$BackendUrl = "http://localhost:8000",
    [string]$Subnet = "192.168.137.",   # Windows Mobile Hotspot default
    [switch]$Loop,                       # keep scanning every 5 seconds
    [int]$LoopIntervalSeconds = 5
)

function Invoke-Scan {
    param([string]$BackendUrl, [string]$Subnet)

    $arpOutput = arp -a 2>$null
    $devices = @()

    foreach ($line in $arpOutput) {
        # Typical line: "  192.168.137.12        aa-bb-cc-dd-ee-ff     dynamic"
        if ($line -match "^\s+(?<ip>$([regex]::Escape($Subnet))\d+)\s+(?<mac>[0-9a-fA-F]{2}(?:-[0-9a-fA-F]{2}){5})\s+") {
            $ip = $matches['ip']
            $mac = ($matches['mac'] -replace '-', ':').ToLower()
            # Skip broadcast + the hotspot gateway itself (.1)
            if ($mac -eq "ff:ff:ff:ff:ff:ff") { continue }
            if ($ip -match "\.1$") { continue }
            $devices += @{ ip = $ip; mac = $mac }
        }
    }

    if ($devices.Count -eq 0) {
        Write-Host "[host-scan] no devices found on $Subnet — is anything connected to the hotspot?" -ForegroundColor Yellow
        return
    }

    $payload = @{ devices = $devices } | ConvertTo-Json -Depth 3
    $endpoint = "$BackendUrl/api/devices/external-scan"

    try {
        $response = Invoke-RestMethod -Uri $endpoint -Method POST -Body $payload -ContentType "application/json" -TimeoutSec 5
        Write-Host "[host-scan] pushed $($devices.Count) device(s) to $endpoint" -ForegroundColor Green
        foreach ($d in $devices) {
            Write-Host ("  - {0}  {1}" -f $d.ip, $d.mac) -ForegroundColor Gray
        }
    } catch {
        Write-Host "[host-scan] POST failed: $($_.Exception.Message)" -ForegroundColor Red
        Write-Host "  (is the backend running at $BackendUrl?)" -ForegroundColor Red
    }
}

if ($Loop) {
    Write-Host "[host-scan] looping every $LoopIntervalSeconds s — Ctrl+C to stop"
    while ($true) {
        Invoke-Scan -BackendUrl $BackendUrl -Subnet $Subnet
        Start-Sleep -Seconds $LoopIntervalSeconds
    }
} else {
    Invoke-Scan -BackendUrl $BackendUrl -Subnet $Subnet
}
