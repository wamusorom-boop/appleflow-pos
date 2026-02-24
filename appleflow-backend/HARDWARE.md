# AppleFlow POS - Hardware Setup Guide

Guide for configuring receipt printers, barcode scanners, and cash drawers.

## Table of Contents

1. [Receipt Printers](#receipt-printers)
2. [Barcode Scanners](#barcode-scanners)
3. [Cash Drawers](#cash-drawers)
4. [Troubleshooting](#troubleshooting)

## Receipt Printers

### Supported Printers

- Epson TM-series (TM-T20, TM-T88, etc.)
- Star TSP-series
- Generic ESC/POS compatible printers
- Network (Ethernet) printers
- USB printers (via driver)

### Network Printer Setup

1. Connect printer to your network
2. Note the IP address (usually printed on test page)
3. Add printer via API:

```bash
curl -X POST https://api.yourdomain.com/api/hardware/printers \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "id": "main-printer",
    "type": "network",
    "address": "192.168.1.100:9100",
    "width": 48,
    "isDefault": true
  }'
```

### USB Printer Setup

For USB printers, you need to:

1. Install printer drivers on the server
2. Share the printer via CUPS or similar
3. Use the shared printer address

```bash
# Install CUPS
sudo apt install cups

# Add printer via CUPS web interface
# http://localhost:631

# Then use the shared address
curl -X POST https://api.yourdomain.com/api/hardware/printers \
  -d '{
    "id": "usb-printer",
    "type": "usb",
    "address": "http://localhost:631/printers/ReceiptPrinter"
  }'
```

### Test Print

```bash
curl -X POST https://api.yourdomain.com/api/hardware/print/test \
  -H "Authorization: Bearer YOUR_TOKEN"
```

## Barcode Scanners

### Keyboard Wedge Scanners

Most USB barcode scanners work as keyboard input:

1. Plug in the scanner
2. Scan a barcode
3. The barcode text appears as if typed

No additional configuration needed. The POS frontend handles barcode input automatically.

### Serial/USB-HID Scanners

For advanced scanners:

1. Install scanner drivers
2. Configure scanner to send proper termination character (usually Enter/CR)
3. Test scanning

### Scanner Configuration

Common settings to configure:
- **Suffix**: Add Enter/CR after barcode (usually enabled by default)
- **Prefix**: Optional prefix character
- **Symbologies**: Enable Code 128, EAN-13, UPC-A

## Cash Drawers

### Printer-Connected Drawer

Most cash drawers connect to the receipt printer:

1. Connect drawer to printer's drawer port (RJ11/RJ12)
2. The drawer opens automatically when printing receipts
3. Or open manually via API:

```bash
curl -X POST https://api.yourdomain.com/api/hardware/drawer/open \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### USB/Serial Drawer

For standalone drawers:

1. Connect to USB or serial port
2. Note the device path (e.g., `/dev/ttyUSB0`)
3. Configure in system settings

## ESC/POS Commands

The system uses standard ESC/POS commands:

| Command | Description |
|---------|-------------|
| `ESC @` | Initialize printer |
| `ESC !` | Select print mode |
| `GS V` | Cut paper |
| `ESC p` | Pulse drawer kick |
| `ESC a` | Select justification |

## Troubleshooting

### Printer Not Responding

1. Check network connection: `ping 192.168.1.100`
2. Verify port is open: `telnet 192.168.1.100 9100`
3. Check printer status page
4. Review logs: `docker-compose logs api | grep -i printer`

### Garbled Output

1. Check character encoding (should be UTF-8)
2. Verify printer supports ESC/POS
3. Try different width settings (48 or 42 chars)

### Drawer Not Opening

1. Check drawer cable connection
2. Verify drawer is compatible with printer
3. Test with printer's test button
4. Check ESC/POS command compatibility

### Barcode Not Scanning

1. Check scanner is in keyboard wedge mode
2. Verify barcode symbology is enabled
3. Test with different barcodes
4. Check for suffix/CR configuration

## Receipt Template

Receipts are formatted with:

- 48 character width (configurable)
- UTF-8 encoding
- Bold headers
- Two-column layout for items
- Automatic paper cutting
- QR code support (if printer supports it)

## Simulation Mode

When no printer is configured, the system runs in simulation mode:

- Receipts are logged instead of printed
- Cash drawer commands are logged
- Useful for testing without hardware

To view simulated prints:
```bash
docker-compose logs api | grep -i "simulated print"
```
