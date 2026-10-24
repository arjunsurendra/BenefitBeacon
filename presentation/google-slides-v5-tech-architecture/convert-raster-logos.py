from pathlib import Path
from PIL import Image

directory = Path("presentation/google-slides-v5-tech-architecture/logos").resolve()

for name in ["react", "nextjs", "typescript", "cloudflare", "chrome"]:
    with Image.open(directory / f"{name}.src") as image:
        image.seek(0)
        source = image.convert("RGBA")
        visible_alpha = source.getchannel("A").point(lambda value: 255 if value > 32 else 0)
        alpha_bounds = visible_alpha.getbbox()
        if alpha_bounds:
            source = source.crop(alpha_bounds)
        scale = min(128 / source.width, 128 / source.height)
        source = source.resize(
            (max(1, round(source.width * scale)), max(1, round(source.height * scale))),
            Image.Resampling.LANCZOS,
        )
        canvas = Image.new("RGBA", (128, 128), (0, 0, 0, 0))
        canvas.alpha_composite(source, ((128 - source.width) // 2, (128 - source.height) // 2))
        canvas.save(directory / f"{name}.png")

with Image.open(directory / "sqlite.src") as image:
    source = image.convert("RGBA")
    source.thumbnail((240, 110), Image.Resampling.LANCZOS)
    canvas = Image.new("RGBA", (240, 110), (0, 0, 0, 0))
    canvas.alpha_composite(source, ((240 - source.width) // 2, (110 - source.height) // 2))
    canvas.save(directory / "sqlite.png")
