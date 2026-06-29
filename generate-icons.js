#!/usr/bin/env node
// generate-icons.js
// Run once with: node generate-icons.js
// Requires: npm install canvas
// Creates: icons/icon-180.png, icons/icon-192.png, icons/icon-512.png

const { createCanvas } = require('canvas');
const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, 'icons');
if (!fs.existsSync(dir)) fs.mkdirSync(dir);

function drawIcon(size) {
  const c = createCanvas(size, size);
  const ctx = c.getContext('2d');
  const r = size * 0.18; // corner radius

  // Background — forest green rounded square
  ctx.beginPath();
  ctx.moveTo(r, 0);
  ctx.lineTo(size - r, 0);
  ctx.quadraticCurveTo(size, 0, size, r);
  ctx.lineTo(size, size - r);
  ctx.quadraticCurveTo(size, size, size - r, size);
  ctx.lineTo(r, size);
  ctx.quadraticCurveTo(0, size, 0, size - r);
  ctx.lineTo(0, r);
  ctx.quadraticCurveTo(0, 0, r, 0);
  ctx.closePath();

  const grad = ctx.createLinearGradient(0, 0, size, size);
  grad.addColorStop(0, '#1a4731');
  grad.addColorStop(1, '#2d7a55');
  ctx.fillStyle = grad;
  ctx.fill();

  // White cross (pill / plus symbol)
  const cx = size / 2;
  const cy = size / 2;
  const armW = size * 0.14;
  const armH = size * 0.42;

  ctx.fillStyle = 'rgba(255,255,255,0.95)';
  ctx.beginPath();
  ctx.roundRect(cx - armW / 2, cy - armH / 2, armW, armH, armW / 2);
  ctx.fill();
  ctx.beginPath();
  ctx.roundRect(cx - armH / 2, cy - armW / 2, armH, armW, armW / 2);
  ctx.fill();

  // Small green dot accent (hydration drop)
  ctx.fillStyle = '#4caf7d';
  const dotR = size * 0.07;
  ctx.beginPath();
  ctx.arc(cx + size * 0.22, cy + size * 0.22, dotR, 0, Math.PI * 2);
  ctx.fill();

  return c.toBuffer('image/png');
}

[180, 192, 512].forEach(size => {
  const buf = drawIcon(size);
  const out = path.join(dir, `icon-${size}.png`);
  fs.writeFileSync(out, buf);
  console.log(`✓ Created ${out}`);
});

console.log('\nAll icons generated in ./icons/');
console.log('Place sw.js, manifest.json, and the icons/ folder alongside index.html');
