import path from "node:path";
import sharp from "sharp";

const directory = path.resolve("presentation/google-slides-v5-tech-architecture/logos");

await sharp(path.join(directory, "openai.svg"))
  .resize(128, 128, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
  .png()
  .toFile(path.join(directory, "openai.png"));
