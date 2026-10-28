/**
 * Phone preview on the home Wi-Fi: prints the address of the dev server on the local network and saves a QR code to
 * scan with the iPhone camera (docs/qr-iphone.png). The server itself is the `cadence-lan` launch configuration
 * (vite --host, port 5330). Run: npx tsx scripts/lan.ts
 */
import { networkInterfaces } from 'node:os';
import QRCode from 'qrcode';

const PORT = 5330;
const ips = Object.values(networkInterfaces())
  .flat()
  .filter((n): n is NonNullable<typeof n> => !!n && n.family === 'IPv4' && !n.internal)
  .map((n) => n.address)
  .filter((a) => /^(192\.168|10\.|172\.(1[6-9]|2\d|3[01]))/.test(a));
const ip = ips[0];
if (!ip) throw new Error('Aucune adresse sur un réseau local (Wi-Fi ou câble) trouvée.');
const url = `http://${ip}:${PORT}`;
await QRCode.toFile('docs/qr-iphone.png', url, { width: 560, margin: 2, color: { dark: '#14171c', light: '#ffffff' } });
console.log(`Adresse sur le Wi-Fi : ${url}`);
console.log('QR code : docs/qr-iphone.png');
