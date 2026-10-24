import sharp from "sharp";

const background = "/Users/surendra.s/.codex/generated_images/01a11818-3b5d-7ea1-9c41-3583fa1f5b4f/exec-385bcb07-c195-41d2-894b-731198f6faf1.png";
const logoLockup = "/Users/surendra.s/Documents/App Challenge/public/benefitbeacon-logo-with-mission-v2.png";
const output = "/Users/surendra.s/Documents/App Challenge/public/benefitbeacon-capitol-cover-600x800-v4.jpg";

const overlay = Buffer.from(`
<svg width="600" height="800" viewBox="0 0 600 800" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="fade" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#F7F1E7" stop-opacity="0.98"/>
      <stop offset="78%" stop-color="#F7F1E7" stop-opacity="0.92"/>
      <stop offset="100%" stop-color="#F7F1E7" stop-opacity="0"/>
    </linearGradient>
  </defs>
  <rect x="0" y="0" width="600" height="340" fill="url(#fade)"/>
</svg>`);

const logoBuffer = await sharp(logoLockup)
  .resize(540, 212, { fit: "contain" })
  .png()
  .toBuffer();

await sharp(background)
  .resize(600, 800, { fit: "cover", position: "centre" })
  .composite([
    { input: overlay, left: 0, top: 0 },
    { input: logoBuffer, left: 30, top: 34 },
  ])
  .jpeg({ quality: 94, chromaSubsampling: "4:4:4", mozjpeg: true })
  .toFile(output);

console.log(output);
