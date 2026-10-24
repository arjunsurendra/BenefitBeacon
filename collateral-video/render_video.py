#!/usr/bin/env python3
"""Render BenefitBeacon's narrated infographic introduction as a 1080p MP4."""

from __future__ import annotations

import math
import os
import re
import subprocess
import sys
import wave
from pathlib import Path

import imageio_ffmpeg
import numpy as np
from PIL import Image, ImageDraw, ImageEnhance, ImageFilter, ImageFont


ROOT = Path(__file__).resolve().parent
PROJECT = ROOT.parent
OUTPUT = ROOT / "BenefitBeacon-introduction.mp4"
AUDIO_DIR = ROOT / "audio"
PREVIEW_DIR = ROOT / "preview-frames"
LOGO_PATH = PROJECT / "public" / "benefitbeacon-logo-v1-512.png"

W, H = 1920, 1080
FPS = 24
SAMPLE_RATE = 44_100

INK = "#073c35"
GREEN = "#0b5146"
GREEN_2 = "#136c5d"
CREAM = "#f6f1e7"
PAPER = "#fffdf8"
CORAL = "#ff6d4b"
PEACH = "#ffb38e"
MINT = "#bcd9ca"
MUTED = "#5f716c"
WHITE = "#ffffff"
GOLD = "#f4c46b"

FONT_SANS = "/System/Library/Fonts/SFNS.ttf"
FONT_ROUNDED = "/System/Library/Fonts/SFNSRounded.ttf"
FONT_SERIF_ITALIC = "/System/Library/Fonts/Supplemental/Georgia Italic.ttf"

NARRATION = [
    "Public help is scattered across agencies, complex rules, and forms. Sunnyvale has no published citywide estimate of unclaimed benefits—that visibility gap is part of the problem. California lawmakers say billions in eligible tax credits go unclaimed each year. Nationally, I R S research estimated four point seven billion dollars in E I T C went unclaimed in twenty nineteen, while about one in five eligible taxpayers misses the credit. Different scopes; one access problem.",
    "Residents should not need to know the right agency or program name. They need one clear place to describe their situation, compare options, and take the next step.",
    "Meet BenefitBeacon: a personal A I guide for Sunnyvale residents. Ask in your own words, or answer a few optional questions. No account and no program name are needed.",
    "Beacon checks fifty source-linked city, county, state, federal, utility, and community programs. Eligibility rules remove clear mismatches. Local semantic matching and A I bring the strongest possibilities forward.",
    "Every result shows the benefit, published rules, official source, and last-checked date. A I explains; the program decides. Residents can ask questions grounded in current program pages.",
    "BenefitBeacon uses a responsive React progressive web app, a local SQLite program index with precomputed embeddings, Open A I for understanding and explanation, official web search for current answers, and a Chrome extension beside the application. If A I is unavailable, deterministic matching still works.",
    "BenefitBeacon turns a fragmented system into a guided path—from discovery, to understanding, to action. Find the help. Follow the path.",
]

CAPTIONS = [
    "The missing citywide number is itself part of the access problem.",
    "People should not need to know the right agency or program name.",
    "Describe your situation naturally, or answer a few optional questions.",
    "50 source-linked programs. The strongest possibilities come forward first.",
    "AI explains. Published rules—and program administrators—decide.",
    "A resilient stack connects discovery, current answers, and application guidance.",
    "Find the help. Follow the path.",
]


def font(size: int, rounded: bool = False, italic: bool = False) -> ImageFont.FreeTypeFont:
    path = FONT_SERIF_ITALIC if italic else (FONT_ROUNDED if rounded else FONT_SANS)
    return ImageFont.truetype(path, size=size)


def clamp(value: float, low: float = 0.0, high: float = 1.0) -> float:
    return max(low, min(high, value))


def ease(value: float) -> float:
    value = clamp(value)
    return value * value * (3 - 2 * value)


def fade_window(progress: float) -> float:
    return ease(min(progress / 0.09, (1 - progress) / 0.08, 1.0))


def rgba(hex_color: str, alpha: int = 255) -> tuple[int, int, int, int]:
    color = hex_color.lstrip("#")
    return tuple(int(color[i : i + 2], 16) for i in (0, 2, 4)) + (alpha,)


def fit_text(draw: ImageDraw.ImageDraw, text: str, max_width: int, start: int, minimum: int = 28, **font_kwargs) -> ImageFont.FreeTypeFont:
    for size in range(start, minimum - 1, -2):
        candidate = font(size, **font_kwargs)
        if draw.textlength(text, font=candidate) <= max_width:
            return candidate
    return font(minimum, **font_kwargs)


def wrap_lines(draw: ImageDraw.ImageDraw, text: str, face: ImageFont.FreeTypeFont, max_width: int) -> list[str]:
    words = text.split()
    lines: list[str] = []
    current = ""
    for word in words:
        trial = f"{current} {word}".strip()
        if not current or draw.textlength(trial, font=face) <= max_width:
            current = trial
        else:
            lines.append(current)
            current = word
    if current:
        lines.append(current)
    return lines


def paragraph(draw: ImageDraw.ImageDraw, xy: tuple[int, int], text: str, face: ImageFont.FreeTypeFont, fill: str, max_width: int, line_gap: int = 10) -> int:
    x, y = xy
    line_height = face.size + line_gap
    for line in wrap_lines(draw, text, face, max_width):
        draw.text((x, y), line, font=face, fill=fill)
        y += line_height
    return y


def centered(draw: ImageDraw.ImageDraw, y: int, text: str, face: ImageFont.FreeTypeFont, fill: str) -> None:
    width = draw.textlength(text, font=face)
    draw.text(((W - width) / 2, y), text, font=face, fill=fill)


def rounded_card(draw: ImageDraw.ImageDraw, box: tuple[int, int, int, int], fill: str = PAPER, radius: int = 34, outline: str | None = None, width: int = 2) -> None:
    draw.rounded_rectangle(box, radius=radius, fill=fill, outline=outline, width=width)


def brand_logo(size: int) -> Image.Image:
    logo = Image.open(LOGO_PATH).convert("RGBA")
    return logo.resize((size, size), Image.Resampling.LANCZOS)


LOGO_310 = brand_logo(310)
LOGO_170 = brand_logo(170)
LOGO_112 = brand_logo(112)


def base_background(scene: int, t: float) -> Image.Image:
    if scene in (0, 3, 5):
        top = np.array([6, 56, 49], dtype=float)
        bottom = np.array([10, 77, 66], dtype=float)
    else:
        top = np.array([249, 245, 237], dtype=float)
        bottom = np.array([241, 235, 222], dtype=float)
    grad = np.linspace(0, 1, H)[:, None, None]
    arr = np.tile((top * (1 - grad) + bottom * grad), (1, W, 1)).astype(np.uint8)
    image = Image.fromarray(arr, "RGB").convert("RGBA")
    draw = ImageDraw.Draw(image, "RGBA")
    drift = int(math.sin(t * 0.35) * 35)
    if scene in (0, 3, 5):
        draw.ellipse((1320 + drift, -260, 2200 + drift, 620), fill=rgba(CORAL, 25))
        draw.ellipse((-380 - drift, 720, 660 - drift, 1660), fill=rgba(MINT, 16))
    else:
        draw.ellipse((1290 + drift, -300, 2240 + drift, 650), fill=rgba(PEACH, 42))
        draw.ellipse((-420 - drift, 650, 620 - drift, 1620), fill=rgba(MINT, 54))
    for x, y in ((90, 96), (1680, 870), (1510, 130), (310, 910)):
        radius = 3 + int(2 * (1 + math.sin(t * 0.7 + x)))
        draw.ellipse((x - radius, y - radius, x + radius, y + radius), fill=rgba(CORAL, 70))
    return image


def add_header(draw: ImageDraw.ImageDraw, scene: int, light: bool) -> None:
    color = CREAM if light else INK
    draw.text((78, 54), "BENEFITBEACON", font=font(24, rounded=True), fill=color)
    draw.text((78, 88), "SUNNYVALE BENEFIT GUIDE", font=font(15, rounded=True), fill=rgba(color, 165))
    for index in range(len(NARRATION)):
        x = 1570 + index * 38
        fill = CORAL if index == scene else rgba(color, 55)
        draw.rounded_rectangle((x, 66, x + 24, 72), radius=3, fill=fill)


def add_caption(image: Image.Image, scene: int, light: bool) -> None:
    overlay = Image.new("RGBA", image.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(overlay, "RGBA")
    box_fill = rgba("#062f2a", 226) if not light else rgba("#ffffff", 234)
    text_fill = CREAM if not light else INK
    draw.rounded_rectangle((300, 924, 1620, 1023), radius=28, fill=box_fill)
    face = fit_text(draw, CAPTIONS[scene], 1200, 31, 24, rounded=True)
    lines = wrap_lines(draw, CAPTIONS[scene], face, 1200)
    y = 950 if len(lines) == 1 else 934
    for line in lines[:2]:
        width = draw.textlength(line, font=face)
        draw.text(((W - width) / 2, y), line, font=face, fill=text_fill)
        y += face.size + 8
    image.alpha_composite(overlay)


def person(draw: ImageDraw.ImageDraw, center: tuple[int, int], scale: float, color: str = CORAL) -> None:
    cx, cy = center
    r = int(44 * scale)
    draw.ellipse((cx - r, cy - 145 * scale - r, cx + r, cy - 145 * scale + r), fill=color)
    draw.rounded_rectangle((cx - 92 * scale, cy - 112 * scale, cx + 92 * scale, cy + 120 * scale), radius=int(76 * scale), fill=color)


def paper_icon(draw: ImageDraw.ImageDraw, x: int, y: int, label: str, delay: float, progress: float) -> None:
    p = ease((progress - delay) / 0.32)
    offset = int((1 - p) * 150)
    box = (x, y + offset, x + 330, y + 190 + offset)
    rounded_card(draw, box, PAPER, 28)
    draw.rounded_rectangle((x + 28, y + 30 + offset, x + 100, y + 102 + offset), radius=18, fill=rgba(CORAL, 42))
    draw.line((x + 48, y + 66 + offset, x + 82, y + 66 + offset), fill=CORAL, width=7)
    draw.text((x + 122, y + 34 + offset), label.upper(), font=font(20, rounded=True), fill=INK)
    for row, width in enumerate((150, 126, 168)):
        yy = y + 84 + row * 25 + offset
        draw.rounded_rectangle((x + 122, yy, x + 122 + width, yy + 8), radius=4, fill=rgba(MUTED, 82))


def scene_problem(image: Image.Image, progress: float) -> None:
    draw = ImageDraw.Draw(image, "RGBA")
    add_header(draw, 0, True)
    centered(draw, 135, "The access problem has a real cost", font(68), CREAM)
    centered(draw, 223, "Money and assistance remain out of reach at every level", font(27, rounded=True), MINT)

    cards = [
        (105, "SUNNYVALE", "No published total", "No official citywide estimate of missed public benefits", "VISIBILITY GAP"),
        (720, "CALIFORNIA", "Billions / year", "Eligible state and federal tax credits go unclaimed", "LEGISLATIVE FINDING"),
        (1335, "UNITED STATES", "$4.7B", "EITC unclaimed in tax year 2019", "IRS ESTIMATE"),
    ]
    for index, (x, place, amount, detail, tag) in enumerate(cards):
        p = ease((progress - 0.03 - index * 0.08) / 0.28)
        y = int(350 + (1 - p) * 130)
        draw.rounded_rectangle((x + 12, y + 16, x + 492, y + 380), radius=42, fill=rgba("#001f1b", 75))
        rounded_card(draw, (x, y, x + 480, y + 364), PAPER, 42)
        draw.text((x + 36, y + 33), tag, font=font(17, rounded=True), fill=CORAL)
        draw.text((x + 36, y + 76), place, font=font(25, rounded=True), fill=MUTED)
        amount_face = fit_text(draw, amount, 408, 64, 40)
        draw.text((x + 34, y + 126), amount, font=amount_face, fill=INK)
        paragraph(draw, (x + 38, y + 226), detail, font(22, rounded=True), MUTED, 398, 10)
        draw.rounded_rectangle((x + 36, y + 323, x + 444, y + 329), radius=3, fill=rgba(MINT, 150))

    centered(draw, 785, "Different scopes and time periods · figures are not additive", font(21, rounded=True), CREAM)
    centered(draw, 828, "Sources: City of Sunnyvale search · California Senate ACR 132 · IRS research", font(17, rounded=True), rgba(CREAM, 170))


def stat_card(draw: ImageDraw.ImageDraw, x: int, amount: str, label: str, tag: str, progress: float, delay: float) -> None:
    p = ease((progress - delay) / 0.28)
    y = int(375 + (1 - p) * 170)
    shadow = (x + 12, y + 16, x + 492, y + 350)
    draw.rounded_rectangle(shadow, radius=40, fill=rgba(INK, 18))
    rounded_card(draw, (x, y, x + 480, y + 334), PAPER, 40)
    draw.text((x + 36, y + 35), tag, font=font(18, rounded=True), fill=CORAL)
    display = amount
    if p < 0.98 and amount.startswith("$"):
        numeric = int(re.sub(r"\D", "", amount))
        suffix = "K" if "K" in amount else ""
        display = f"${max(1, int(numeric * p))}{suffix}"
    draw.text((x + 34, y + 85), display, font=font(78), fill=INK)
    paragraph(draw, (x + 38, y + 186), label, font(26, rounded=True), MUTED, 396, 10)
    draw.rounded_rectangle((x + 36, y + 282, x + 444, y + 288), radius=3, fill=rgba(MINT, 145))


def scene_value(image: Image.Image, progress: float) -> None:
    draw = ImageDraw.Draw(image, "RGBA")
    add_header(draw, 1, False)
    centered(draw, 142, "Why does help get missed?", font(68), INK)
    centered(draw, 232, "The resident is expected to navigate the system alone", font(27, rounded=True), MUTED)
    frictions = [
        (150, "01", "Scattered", "City, county, state, federal, utility, and nonprofit websites."),
        (720, "02", "Complicated", "Different eligibility language, evidence, deadlines, and forms."),
        (1290, "03", "Disconnected", "Residents repeat their story and still do not know the next step."),
    ]
    for index, (x, number, title, detail) in enumerate(frictions):
        p = ease((progress - 0.04 - index * 0.10) / 0.28)
        y = int(365 + (1 - p) * 150)
        draw.rounded_rectangle((x + 12, y + 16, x + 492, y + 338), radius=40, fill=rgba(INK, 24))
        rounded_card(draw, (x, y, x + 480, y + 322), PAPER, 40)
        draw.text((x + 36, y + 32), number, font=font(20, rounded=True), fill=CORAL)
        draw.text((x + 36, y + 88), title, font=font(44), fill=INK)
        paragraph(draw, (x + 38, y + 164), detail, font(24, rounded=True), MUTED, 398, 11)
    centered(draw, 780, "One clear starting point can change the journey.", font(35, italic=True), CORAL)


def draw_chat_bubble(draw: ImageDraw.ImageDraw, box: tuple[int, int, int, int], text: str, user: bool = True) -> None:
    fill = CORAL if user else PAPER
    text_fill = WHITE if user else INK
    draw.rounded_rectangle(box, radius=32, fill=fill)
    paragraph(draw, (box[0] + 34, box[1] + 27), text, font(28, rounded=True), text_fill, box[2] - box[0] - 68, 10)


def scene_intro(image: Image.Image, progress: float) -> None:
    draw = ImageDraw.Draw(image, "RGBA")
    add_header(draw, 2, False)
    bob = int(math.sin(progress * math.pi * 2) * 8)
    image.alpha_composite(LOGO_310, (180, 255 + bob))
    draw.text((550, 238), "Meet", font=font(42, rounded=True), fill=CORAL)
    draw.text((550, 292), "BenefitBeacon", font=font(72), fill=INK)
    paragraph(draw, (555, 392), "Your personal AI guide for government benefits", font(29, rounded=True), MUTED, 430, 10)
    panel = (1040, 190, 1780, 805)
    draw.rounded_rectangle((panel[0] + 14, panel[1] + 18, panel[2] + 14, panel[3] + 18), radius=48, fill=rgba(INK, 20))
    rounded_card(draw, panel, PAPER, 48)
    draw.text((1100, 238), "Tell me what would make life easier…", font=font(21, rounded=True), fill=MUTED)
    typed = "My utility bills keep rising and\nI need help with home repairs."
    reveal = int(len(typed) * ease((progress - 0.10) / 0.48))
    paragraph(draw, (1100, 315), typed[:reveal], font(33, rounded=True), INK, 590, 13)
    draw.rounded_rectangle((1100, 590, 1717, 678), radius=26, fill=GREEN)
    draw.text((1140, 616), "Find what may help", font=font(27, rounded=True), fill=CREAM)
    draw.text((1663, 608), "→", font=font(38), fill=CORAL)
    draw.text((1100, 720), "No account · Optional questions · Your choice", font=font(20, rounded=True), fill=MUTED)
    draw.text((190, 658), "Speak naturally.", font=font(34), fill=INK)
    draw.text((190, 708), "No program name needed.", font=font(34, italic=True), fill=CORAL)


def connector(draw: ImageDraw.ImageDraw, start: tuple[int, int], end: tuple[int, int], progress: float) -> None:
    p = ease(progress)
    ex = int(start[0] + (end[0] - start[0]) * p)
    ey = int(start[1] + (end[1] - start[1]) * p)
    draw.line((start[0], start[1], ex, ey), fill=CORAL, width=9)
    if p > 0.95:
        draw.ellipse((end[0] - 11, end[1] - 11, end[0] + 11, end[1] + 11), fill=CREAM, outline=CORAL, width=6)


def pipeline_card(draw: ImageDraw.ImageDraw, box: tuple[int, int, int, int], number: str, title: str, body: str, progress: float, delay: float) -> None:
    p = ease((progress - delay) / 0.30)
    dx = int((1 - p) * 120)
    shifted = (box[0] + dx, box[1], box[2] + dx, box[3])
    rounded_card(draw, shifted, PAPER, 42)
    draw.text((shifted[0] + 32, shifted[1] + 25), number, font=font(20, rounded=True), fill=CORAL)
    draw.text((shifted[0] + 32, shifted[1] + 83), title, font=font(37), fill=INK)
    paragraph(draw, (shifted[0] + 32, shifted[1] + 148), body, font(24, rounded=True), MUTED, shifted[2] - shifted[0] - 64, 10)


def scene_matching(image: Image.Image, progress: float) -> None:
    draw = ImageDraw.Draw(image, "RGBA")
    add_header(draw, 3, True)
    centered(draw, 150, "From one story to a clear starting point", font(66), CREAM)
    pipeline_card(draw, (100, 338, 580, 720), "01", "You share", "Describe what is happening, or answer optional questions.", progress, 0.02)
    pipeline_card(draw, (720, 338, 1200, 720), "02", "Beacon checks", "50 source-linked programs across every level of government.", progress, 0.17)
    pipeline_card(draw, (1340, 338, 1820, 720), "03", "You choose", "The strongest possibilities appear first, with official sources.", progress, 0.32)
    connector(draw, (582, 530), (716, 530), (progress - 0.22) / 0.20)
    connector(draw, (1202, 530), (1336, 530), (progress - 0.38) / 0.20)
    tags = ["Housing", "Food", "Health", "Child tax credits", "Utilities", "Water rebates", "Home repairs", "Recreation"]
    widths = [160, 130, 135, 250, 145, 195, 190, 180]
    x = 230
    for index, (tag, width) in enumerate(zip(tags, widths)):
        if x + width > 1720:
            break
        p = ease((progress - 0.48 - index * 0.025) / 0.18)
        draw.rounded_rectangle((x, 793 + int((1 - p) * 40), x + width, 850 + int((1 - p) * 40)), radius=26, fill=rgba(CREAM, int(32 + 190 * p)), outline=rgba(CREAM, int(25 + 100 * p)), width=2)
        tw = draw.textlength(tag, font=font(20, rounded=True))
        draw.text((x + (width - tw) / 2, 808 + int((1 - p) * 40)), tag, font=font(20, rounded=True), fill=INK)
        x += width + 18


def check_icon(draw: ImageDraw.ImageDraw, x: int, y: int, scale: float = 1.0) -> None:
    r = int(28 * scale)
    draw.ellipse((x - r, y - r, x + r, y + r), fill=GREEN)
    draw.line((x - 12 * scale, y, x - 2 * scale, y + 11 * scale, x + 17 * scale, y - 14 * scale), fill=CREAM, width=max(4, int(6 * scale)), joint="curve")


def scene_results(image: Image.Image, progress: float) -> None:
    draw = ImageDraw.Draw(image, "RGBA")
    add_header(draw, 4, False)
    draw.text((110, 150), "A result you can trust", font=font(68), fill=INK)
    draw.text((112, 238), "Clear enough to act on. Honest about who decides.", font=font(28, rounded=True), fill=MUTED)
    card = (105, 340, 1180, 840)
    draw.rounded_rectangle((card[0] + 16, card[1] + 18, card[2] + 16, card[3] + 18), radius=48, fill=rgba(INK, 22))
    rounded_card(draw, card, PAPER, 48)
    draw.text((155, 388), "HOME SUPPORT · SUNNYVALE", font=font(18, rounded=True), fill=CORAL)
    draw.text((155, 444), "Sunnyvale Home Access Grant", font=font(47), fill=INK)
    draw.text((155, 522), "Up to $9,500 for accessibility improvements", font=font(31, rounded=True), fill=GREEN)
    rows = [("Published eligibility", "Rules shown in plain language"), ("Official source", "City of Sunnyvale"), ("Last checked", "Date shown on every result")]
    for index, (left, right) in enumerate(rows):
        y = 620 + index * 62
        p = ease((progress - 0.10 - index * 0.07) / 0.22)
        check_icon(draw, 177, y + 8, 0.58 * p)
        draw.text((218, y - 7), left, font=font(22, rounded=True), fill=INK)
        draw.text((565, y - 7), right, font=font(22, rounded=True), fill=MUTED)
    draw.rounded_rectangle((1255, 340, 1815, 615), radius=48, fill=GREEN)
    draw.text((1305, 386), "AI EXPLAINS", font=font(20, rounded=True), fill=PEACH)
    draw.text((1305, 443), "Why it may fit", font=font(40), fill=CREAM)
    paragraph(draw, (1305, 505), "Based only on what you chose to share.", font(24, rounded=True), CREAM, 440, 10)
    draw.rounded_rectangle((1255, 644, 1815, 840), radius=48, fill=rgba(CORAL, 34), outline=rgba(CORAL, 100), width=3)
    draw.text((1305, 686), "RULES DECIDE", font=font(20, rounded=True), fill=CORAL)
    paragraph(draw, (1305, 735), "Each program makes the final eligibility and award decision.", font(25, rounded=True), INK, 440, 10)


def browser_panel(draw: ImageDraw.ImageDraw, box: tuple[int, int, int, int], progress: float) -> None:
    x1, y1, x2, y2 = box
    rounded_card(draw, box, PAPER, 34)
    draw.rounded_rectangle((x1, y1, x2, y1 + 64), radius=34, fill=rgba(MINT, 74))
    draw.rectangle((x1, y1 + 32, x2, y1 + 64), fill=rgba(MINT, 74))
    for i, color in enumerate((CORAL, GOLD, GREEN_2)):
        draw.ellipse((x1 + 24 + i * 28, y1 + 24, x1 + 38 + i * 28, y1 + 38), fill=color)
    draw.rounded_rectangle((x1 + 132, y1 + 17, x2 - 24, y1 + 47), radius=15, fill=PAPER)
    draw.text((x1 + 153, y1 + 23), "official-program.gov/application", font=font(15, rounded=True), fill=MUTED)
    draw.text((x1 + 40, y1 + 103), "Application", font=font(34), fill=INK)
    fields = ["Name", "Household size", "Program selection"]
    for i, label in enumerate(fields):
        y = y1 + 178 + i * 105
        draw.text((x1 + 40, y), label, font=font(18, rounded=True), fill=MUTED)
        outline = CORAL if i == 1 and progress > 0.40 else rgba(MUTED, 70)
        draw.rounded_rectangle((x1 + 40, y + 34, x2 - 40, y + 82), radius=14, outline=outline, width=4 if i == 1 and progress > 0.40 else 2)
    draw.rounded_rectangle((x1 + 40, y2 - 85, x1 + 240, y2 - 32), radius=18, fill=rgba(MUTED, 40))
    draw.text((x1 + 99, y2 - 70), "Submit", font=font(18, rounded=True), fill=MUTED)


def scene_guidance(image: Image.Image, progress: float) -> None:
    draw = ImageDraw.Draw(image, "RGBA")
    add_header(draw, 5, True)
    centered(draw, 132, "Built for answers—and reliability", font(66), CREAM)
    centered(draw, 220, "A practical stack connects discovery to the official application", font(27, rounded=True), MINT)
    nodes = [
        (100, 335, 610, 545, "01", "React PWA", "Responsive web and mobile experience"),
        (705, 335, 1215, 545, "02", "SQLite + vectors", "50 curated programs and local semantic matching"),
        (1310, 335, 1820, 545, "03", "OpenAI", "Natural-language understanding and explanations"),
        (400, 620, 920, 830, "04", "Official web search", "Current, source-grounded program answers"),
        (1010, 620, 1530, 830, "05", "Chrome extension", "Guidance beside the official application"),
    ]
    for index, (x1, y1, x2, y2, number, title, detail) in enumerate(nodes):
        p = ease((progress - 0.03 - index * 0.06) / 0.24)
        y_offset = int((1 - p) * 70)
        box = (x1, y1 + y_offset, x2, y2 + y_offset)
        draw.rounded_rectangle((box[0] + 10, box[1] + 13, box[2] + 10, box[3] + 13), radius=34, fill=rgba("#001f1b", 70))
        rounded_card(draw, box, PAPER, 34)
        draw.text((box[0] + 30, box[1] + 26), number, font=font(18, rounded=True), fill=CORAL)
        draw.text((box[0] + 30, box[1] + 72), title, font=font(34), fill=INK)
        paragraph(draw, (box[0] + 30, box[1] + 129), detail, font(21, rounded=True), MUTED, box[2] - box[0] - 60, 8)
    draw.rounded_rectangle((1572, 683, 1812, 763), radius=24, fill=CORAL)
    draw.text((1611, 701), "AI offline?", font=font(19, rounded=True), fill=WHITE)
    draw.text((1596, 730), "Matching still works", font=font(17, rounded=True), fill=WHITE)


def scene_close(image: Image.Image, progress: float) -> None:
    draw = ImageDraw.Draw(image, "RGBA")
    add_header(draw, 6, False)
    pulse = 1 + 0.025 * math.sin(progress * math.pi * 4)
    logo = LOGO_310.resize((int(310 * pulse), int(310 * pulse)), Image.Resampling.LANCZOS)
    image.alpha_composite(logo, ((W - logo.width) // 2, 145))
    centered(draw, 500, "BenefitBeacon", font(92), INK)
    centered(draw, 616, "Find the help. Follow the path.", font(49, italic=True), CORAL)
    items = [("01", "Clear choices"), ("02", "Trusted sources"), ("03", "Guidance that stays")]
    total_width = 1160
    start_x = (W - total_width) // 2
    for index, (number, label) in enumerate(items):
        x = start_x + index * 400
        p = ease((progress - 0.12 - index * 0.08) / 0.24)
        draw.rounded_rectangle((x, 732 + int((1 - p) * 40), x + 360, 826 + int((1 - p) * 40)), radius=28, fill=PAPER, outline=rgba(INK, 26), width=2)
        draw.text((x + 24, 759 + int((1 - p) * 40)), number, font=font(19, rounded=True), fill=CORAL)
        draw.text((x + 78, 752 + int((1 - p) * 40)), label, font=font(25, rounded=True), fill=INK)


SCENE_RENDERERS = [scene_problem, scene_value, scene_intro, scene_matching, scene_results, scene_guidance, scene_close]


def duration_from_media(path: Path, ffmpeg: str) -> float:
    result = subprocess.run([ffmpeg, "-i", str(path)], capture_output=True, text=True)
    match = re.search(r"Duration: (\d+):(\d+):(\d+(?:\.\d+)?)", result.stderr)
    if not match:
        raise RuntimeError(f"Could not read duration from {path}")
    hours, minutes, seconds = match.groups()
    return int(hours) * 3600 + int(minutes) * 60 + float(seconds)


def build_audio(ffmpeg: str) -> tuple[list[float], Path, float]:
    AUDIO_DIR.mkdir(parents=True, exist_ok=True)
    segment_paths: list[Path] = []
    durations: list[float] = []
    for index, words in enumerate(NARRATION, start=1):
        aiff_path = AUDIO_DIR / f"{index:02d}.aiff"
        wav_path = AUDIO_DIR / f"{index:02d}.wav"
        subprocess.run([
            "/usr/bin/say", "-v", "Samantha", "-r", "212", "-o", str(aiff_path),
            words,
        ], check=True)
        subprocess.run([
            "/usr/bin/afconvert", "-f", "WAVE", "-d", "LEI16@44100",
            str(aiff_path), str(wav_path),
        ], check=True)
        with wave.open(str(wav_path), "rb") as source:
            durations.append(source.getnframes() / source.getframerate())
        segment_paths.append(wav_path)

    concat_file = AUDIO_DIR / "segments.txt"
    concat_file.write_text("".join(f"file '{path}'\n" for path in segment_paths), encoding="utf-8")
    narration = AUDIO_DIR / "narration.wav"
    subprocess.run([
        ffmpeg, "-y", "-f", "concat", "-safe", "0", "-i", str(concat_file),
        "-ar", str(SAMPLE_RATE), "-ac", "2", "-c:a", "pcm_s16le", str(narration),
    ], check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)

    total_duration = sum(durations) + 0.25
    ambient = AUDIO_DIR / "ambient.wav"
    create_ambient_audio(ambient, total_duration)
    soundtrack = AUDIO_DIR / "soundtrack.m4a"
    subprocess.run([
        ffmpeg, "-y", "-i", str(narration), "-i", str(ambient),
        "-filter_complex",
        "[0:a]apad=pad_dur=0.25,volume=1.0[n];[1:a]volume=0.12[m];[n][m]amix=inputs=2:duration=longest:normalize=0[out]",
        "-map", "[out]", "-c:a", "aac", "-b:a", "192k", str(soundtrack),
    ], check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    return durations, soundtrack, total_duration


def create_ambient_audio(path: Path, duration: float) -> None:
    frame_count = int(duration * SAMPLE_RATE)
    time = np.arange(frame_count, dtype=np.float64) / SAMPLE_RATE
    music = np.zeros(frame_count, dtype=np.float64)
    chords = ((130.81, 196.00, 261.63), (146.83, 220.00, 293.66), (164.81, 246.94, 329.63), (146.83, 220.00, 293.66))
    section = 8.0
    for chord_index, chord in enumerate(chords * (int(duration // (len(chords) * section)) + 2)):
        start = chord_index * section
        if start >= duration:
            break
        mask = (time >= start) & (time < min(start + section, duration))
        local = time[mask] - start
        envelope = np.minimum(local / 1.4, 1.0) * np.minimum((section - local) / 1.8, 1.0)
        tone = sum(np.sin(2 * math.pi * frequency * local) for frequency in chord) / len(chord)
        shimmer = np.sin(2 * math.pi * chord[0] * 2 * local) * 0.12
        music[mask] += (tone + shimmer) * envelope * 0.20
    music += np.sin(2 * math.pi * 65.41 * time) * 0.025
    music = np.clip(music, -0.9, 0.9)
    pcm = (music * 32767).astype("<i2")
    stereo = np.column_stack((pcm, pcm)).reshape(-1)
    with wave.open(str(path), "wb") as wav:
        wav.setnchannels(2)
        wav.setsampwidth(2)
        wav.setframerate(SAMPLE_RATE)
        wav.writeframes(stereo.tobytes())


def locate_scene(seconds: float, durations: list[float]) -> tuple[int, float]:
    elapsed = 0.0
    for index, duration in enumerate(durations):
        if seconds < elapsed + duration or index == len(durations) - 1:
            return index, clamp((seconds - elapsed) / max(duration, 0.001))
        elapsed += duration
    return len(durations) - 1, 1.0


def render_frame(seconds: float, durations: list[float]) -> Image.Image:
    scene, progress = locate_scene(seconds, durations)
    image = base_background(scene, seconds)
    SCENE_RENDERERS[scene](image, progress)
    add_caption(image, scene, scene in (0, 3, 5))
    opacity = fade_window(progress)
    if opacity < 1:
        curtain = Image.new("RGBA", image.size, rgba(INK if scene in (0, 3, 5) else CREAM, int((1 - opacity) * 255)))
        image.alpha_composite(curtain)
    return image.convert("RGB")


def render_video(durations: list[float], soundtrack: Path, total_duration: float) -> None:
    PREVIEW_DIR.mkdir(parents=True, exist_ok=True)
    frame_count = math.ceil(total_duration * FPS)
    writer = imageio_ffmpeg.write_frames(
        str(OUTPUT), (W, H), fps=FPS, codec="libx264", quality=8,
        pix_fmt_in="rgb24", pix_fmt_out="yuv420p", audio_path=str(soundtrack),
        audio_codec="aac", output_params=["-movflags", "+faststart", "-shortest"],
        ffmpeg_log_level="warning", macro_block_size=8,
    )
    writer.send(None)
    elapsed = 0.0
    preview_points = []
    for duration in durations:
        preview_points.append(elapsed + duration * 0.55)
        elapsed += duration
    preview_saved: set[int] = set()
    try:
        for frame_index in range(frame_count):
            seconds = frame_index / FPS
            frame = render_frame(seconds, durations)
            writer.send(np.asarray(frame))
            for preview_index, preview_time in enumerate(preview_points, start=1):
                if preview_index not in preview_saved and abs(seconds - preview_time) < 0.5 / FPS:
                    frame.save(PREVIEW_DIR / f"scene-{preview_index:02d}.png")
                    preview_saved.add(preview_index)
            if frame_index % (FPS * 5) == 0:
                print(f"Rendered {seconds:5.1f}s / {total_duration:5.1f}s", flush=True)
    finally:
        writer.close()


def main() -> None:
    if not LOGO_PATH.exists():
        raise SystemExit(f"Missing logo: {LOGO_PATH}")
    ffmpeg = imageio_ffmpeg.get_ffmpeg_exe()
    print("Building narration and soundtrack…", flush=True)
    durations, soundtrack, total_duration = build_audio(ffmpeg)
    print("Scene durations:", ", ".join(f"{duration:.1f}s" for duration in durations), flush=True)
    print(f"Rendering {total_duration:.1f}s at {W}×{H}, {FPS} fps…", flush=True)
    render_video(durations, soundtrack, total_duration)
    print(f"Created {OUTPUT}", flush=True)


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        sys.exit(130)
