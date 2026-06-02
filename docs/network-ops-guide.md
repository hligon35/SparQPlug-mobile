# SparQPlug Network Ops Guide

This guide matches your current live setup:

- VPN endpoint: `vpn.alphazonelabs.com:51820`
- Pi-hole admin domain (LAN/VPN): `adblock.alphazonelabs.com`
- Pi-hole server IP: `10.0.0.106`
- WireGuard subnet: `10.44.0.0/24`

## What was set up

1. `vpn.alphazonelabs.com` is active as your WireGuard endpoint (public DNS).
2. `adblock.alphazonelabs.com` resolves to `10.0.0.106` through Pi-hole DNS.
3. Pi-hole DNS listening mode was updated to `ALL` so VPN clients can resolve DNS on `10.44.0.1`.
4. A new mobile app tab was added: **Network**.

## Access Basics

### Home network

1. Set your device DNS to `10.0.0.106`.
2. Open Pi-hole: `http://adblock.alphazonelabs.com/admin`.
3. Keep iCloud Private Relay / Private DNS bypass features off on devices where you want strict filtering.

### Outside home (VPN)

1. Connect WireGuard tunnel in the app.
2. Confirm endpoint is `vpn.alphazonelabs.com:51820`.
3. Confirm DNS in client profile is `10.44.0.1`.
4. Open Pi-hole admin with the same URL: `http://adblock.alphazonelabs.com/admin`.

## Using the new Network tab in SparQPlug mobile

1. Open **Network** tab.
2. Use the **test-tube icon** to run remote diagnostics.
3. Use the **book icon** to open the in-app guide screen.
4. In **Connection Settings**, confirm:
    - VPN Domain: `vpn.alphazonelabs.com`
    - Pi-hole Domain: `adblock.alphazonelabs.com`
5. Optional: add Pi-hole API token/password if your instance requires authenticated API control.
6. Tap **Save Settings**.
7. Pull down to refresh to verify status cards and health pills.

### Quick controls

- **Pause 5m / Pause 30m**: temporarily disables Pi-hole blocking.
- **Resume Now**: immediately re-enables blocking.
- **Open Pi-hole**: opens Pi-hole web admin.
- **Open WireGuard**: jumps to WireGuard app.

## Using Network Ops in web and desktop

1. Open **Network Ops** from the left sidebar.
2. Use the **test-tube icon** in the page header to run remote tests.
3. Use the **book icon** to open the guide route (`/network-ops/guide`).
4. Desktop app gets this automatically because it renders the same web routes.

## Remote tests now wired

The test run includes:

1. Client-side VPN domain DNS A-record lookup.
2. Client-side Pi-hole admin reachability and summary API check.
3. Client-side public egress IP check.
4. Backend-side health endpoint check.
5. Backend-side VPN domain DNS lookup.
6. Backend-side Pi-hole public exposure check.

This gives both perspectives:

1. **From your current device/network path**.
2. **From backend/cloud path**.

## Max Performance Checklist

1. Keep client DNS pointed only to Pi-hole (avoid fallback DNS to `8.8.8.8` or `1.1.1.1` on clients).
2. Disable DNS bypass options (Private Relay, strict Private DNS, browser DoH overrides) where filtering matters.
3. Keep WireGuard in split-tunnel mode exactly as configured unless you need full-tunnel.
4. Run gravity updates regularly (already covered by your maintenance timer).
5. Keep app + OS + Pi updated (already covered by unattended upgrades and maintenance automation).

## Easy verification tests

### Pi-hole impact test (speed + latency)

1. Run a baseline speed test with public DNS.
2. Run the same test with Pi-hole DNS.
3. Compare throughput and page load. Throughput should stay similar; browsing usually feels faster due to blocked ad/tracker requests.

### VPN test

1. Turn off Wi-Fi and use cellular.
2. Connect WireGuard.
3. Visit `http://adblock.alphazonelabs.com/admin`.
4. In the Network tab, verify status cards load and controls work.

## Security notes

1. Keep Pi-hole admin accessible through LAN/VPN only.
2. Do not expose Pi-hole admin to the public internet.
3. Keep WireGuard endpoint DNS record as DNS-only (not proxied).
4. Rotate API credentials if shared to additional devices.
