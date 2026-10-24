import sharp from "sharp";

const iconPath = "/Users/surendra.s/Documents/App Challenge/public/benefitbeacon-logo-v1-512.png";
const outputPath = "/Users/surendra.s/Documents/App Challenge/public/benefitbeacon-logo-with-mission-v2.png";

const width = 1200;
const height = 470;

const typography = Buffer.from(`
<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
  <text x="600" y="252" text-anchor="middle" fill="#073E35"
        font-family="Avenir Next, Arial, sans-serif" font-size="92" font-weight="700">BenefitBeacon</text>
  <rect x="530" y="280" width="140" height="9" rx="4.5" fill="#FF6B4A"/>
  <text x="600" y="360" text-anchor="middle" fill="#073E35"
        font-family="Avenir Next, Arial, sans-serif" font-size="49" font-weight="600">Helping residents find and access</text>
  <text x="600" y="418" text-anchor="middle" fill="#073E35"
        font-family="Avenir Next, Arial, sans-serif" font-size="49" font-weight="600">government benefits.</text>
</svg>`);

const icon = await sharp(iconPath)
  .resize(150, 150, { fit: "contain" })
  .png()
  .toBuffer();

await sharp({
  create: {
    width,
    height,
    channels: 4,
    background: { r: 0, g: 0, b: 0, alpha: 0 },
  },
})
  .composite([
    { input: icon, left: 525, top: 18 },
    { input: typography, left: 0, top: 0 },
  ])
  .png()
  .toFile(outputPath);

console.log(outputPath);
