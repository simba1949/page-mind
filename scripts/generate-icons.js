const fs = require('fs');
const path = require('path');

function createSvg(size, withBg = true) {
  const s = Math.min(size, 128);
  const r = Math.round(s * 0.22); // corner radius
  const pad = Math.round(s * 0.12);
  const innerW = s - pad * 2;

  // Colors
  const bg = '#121722';
  const surface = '#1A2332';
  const accent = '#E5A14A';
  const line = '#4A9EFF';
  const textColor = '#5A6478';

  if (size <= 48) {
    // Simple mark for small sizes
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${s} ${s}">
      <rect width="${s}" height="${s}" rx="${r}" fill="${bg}"/>
      <circle cx="${s/2}" cy="${s/2}" r="${s*0.28}" fill="${accent}"/>
      <path d="M${s/2} ${s/2-s*0.14}L${s/2} ${s/2+s*0.14}M${s/2-s*0.14} ${s/2}L${s/2+s*0.14} ${s/2}" stroke="#fff" stroke-width="${Math.max(1.5, s*0.04)}" stroke-linecap="round"/>
    </svg>`;
  }

  // Full icon for 128px
  const docX = pad;
  const docY = pad + s * 0.05;
  const docW = innerW * 0.7;
  const docH = innerW * 0.85;
  const foldX = docX + docW - s * 0.12;
  const foldY = docY + s * 0.12;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${s} ${s}">
    <rect width="${s}" height="${s}" rx="${r}" fill="${bg}"/>
    <rect x="${docX}" y="${docY}" width="${docW}" height="${docH}" rx="${s*0.04}" fill="${surface}" stroke="${line}" stroke-width="${Math.max(1, s*0.015)}"/>
    <path d="M${foldX} ${docY}v${s*0.12}h${s*0.12}" fill="${bg}" stroke="${line}" stroke-width="${Math.max(1, s*0.015)}"/>
    <rect x="${docX + s*0.06}" y="${docY + s*0.18}" width="${s*0.14}" height="${s*0.025}" rx="${s*0.01}" fill="${textColor}"/>
    <rect x="${docX + s*0.06}" y="${docY + s*0.25}" width="${docW*0.5}" height="${s*0.025}" rx="${s*0.01}" fill="${textColor}"/>
    <rect x="${docX + s*0.06}" y="${docY + s*0.32}" width="${docW*0.35}" height="${s*0.025}" rx="${s*0.01}" fill="${textColor}"/>
    <circle cx="${docX + docW + s*0.1}" cy="${docY + s*0.2}" r="${s*0.18}" fill="${accent}" opacity="0.15"/>
    <circle cx="${docX + docW + s*0.1}" cy="${docY + s*0.2}" r="${s*0.1}" fill="${accent}"/>
    <path d="M${docX + docW + s*0.1} ${docY + s*0.1}v${s*0.2}M${docX + docW} ${docY + s*0.2}h${s*0.2}" stroke="#fff" stroke-width="${Math.max(2, s*0.025)}" stroke-linecap="round"/>
  </svg>`;
}

function svgToPng(svg, width) {
  return new Promise((resolve, reject) => {
    const sharp = require('sharp');
    const buf = Buffer.from(svg);
    sharp(buf)
      .resize(width, width)
      .png()
      .toBuffer()
      .then(resolve)
      .catch(reject);
  });
}

async function main() {
  const outputDir = path.resolve(__dirname, '..', 'assets', 'icons');
  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

  const icons = [
    { file: 'icon16.png', size: 16 },
    { file: 'icon48.png', size: 48 },
    { file: 'icon128.png', size: 128 },
    { file: 'pagemind16.png', size: 16 },
    { file: 'pagemind48.png', size: 48 },
    { file: 'pagemind128.png', size: 128 },
  ];

  try {
    const sharp = require('sharp');
  } catch {
    console.log('sharp not installed, generating SVG files instead...');
    for (const icon of icons) {
      const svg = createSvg(icon.size);
      const filePath = path.join(outputDir, icon.file.replace('.png', '.svg'));
      fs.writeFileSync(filePath, svg);
      console.log(`Generated: ${filePath}`);
    }
    console.log('\nDone! Install sharp for PNG output: npm install sharp');
    return;
  }

  for (const icon of icons) {
    const svg = createSvg(icon.size);
    const png = await svgToPng(svg, icon.size);
    const filePath = path.join(outputDir, icon.file);
    fs.writeFileSync(filePath, png);
    console.log(`Generated: ${filePath} (${icon.size}x${icon.size})`);
  }
  console.log('\nAll icons generated!');
}

main();
