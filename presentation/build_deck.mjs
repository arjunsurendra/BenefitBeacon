import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { FileBlob, Presentation, PresentationFile } from "@oai/artifact-tool";

const workspaceDir = "/Users/surendra.s/Documents/App Challenge";
const buildDir = path.join(workspaceDir, "presentation/.build");
const previewDir = path.join(buildDir, "previews");
const finalDir = path.join(workspaceDir, "presentation/output");
const finalPath = path.join(finalDir, "BenefitBeacon-Presentation-v5-avatar-safe.pptx");
const skillDir = "/Users/surendra.s/.codex/plugins/cache/openai-primary-runtime/presentations/26.1022.11436/skills/presentations";
const pythonExecutable = "/Users/surendra.s/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/bin/python3";

const W = 1280;
const H = 720;
// Reserve x: 0–320 and y: 540–720 for the presenter's video avatar.
const AVATAR_SAFE = { x: 0, y: 540, w: 320, h: 180 };
const FONT = "Avenir Next";
const C = {
  ink: "#073E35",
  forest: "#0C4B40",
  forest2: "#145D4F",
  cream: "#F7F1E7",
  paper: "#FFFDFC",
  coral: "#FF6B4A",
  peach: "#FFB08C",
  mint: "#BEDBCF",
  gray: "#60716D",
  pale: "#E8F0ED",
  white: "#FFFFFF",
  black: "#111816",
};

async function bytes(filePath) {
  const b = await fs.readFile(filePath);
  return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength);
}

function rect(slide, { x, y, w, h, fill, radius = 0, line = "none", lineWidth = 0, name }) {
  return slide.shapes.add({
    geometry: radius ? "roundRect" : "rect",
    name,
    position: { left: x, top: y, width: w, height: h },
    fill,
    line: { style: "solid", fill: line, width: lineWidth },
    ...(radius ? { borderRadius: "rounded-xl" } : {}),
  });
}

function textBox(slide, text, { x, y, w, h, size = 24, color = C.ink, bold = false, align = "left", name, font = FONT, italic = false }) {
  const shape = slide.shapes.add({
    geometry: "textbox",
    name,
    position: { left: x, top: y, width: w, height: h },
    fill: "none",
    line: { style: "solid", fill: "none", width: 0 },
  });
  shape.text = text;
  shape.text.style = {
    typeface: font,
    fontSize: size,
    color,
    bold,
    italic,
    alignment: align,
  };
  return shape;
}

function circle(slide, { x, y, d, fill, line = "none", lineWidth = 0, name }) {
  return slide.shapes.add({
    geometry: "ellipse",
    name,
    position: { left: x, top: y, width: d, height: d },
    fill,
    line: { style: "solid", fill: line, width: lineWidth },
  });
}

function addBrand(slide, n, dark = false) {
  const color = dark ? C.cream : C.ink;
  textBox(slide, "BENEFITBEACON", { x: 56, y: 34, w: 260, h: 28, size: 18, color, bold: true });
  textBox(slide, "SUNNYVALE BENEFIT GUIDE", { x: 56, y: 60, w: 270, h: 18, size: 10, color: dark ? C.mint : C.gray, bold: true });
  textBox(slide, String(n).padStart(2, "0"), { x: 1180, y: 38, w: 44, h: 22, size: 13, color: dark ? C.peach : C.coral, bold: true, align: "right" });
}

function notes(slide, body) {
  slide.speakerNotes.text = body;
  slide.speakerNotes.setVisible(true);
}

function sectionTitle(slide, title, subtitle, dark = false) {
  textBox(slide, title, { x: 72, y: 112, w: 1136, h: 64, size: 42, color: dark ? C.cream : C.ink, bold: true });
  if (subtitle) textBox(slide, subtitle, { x: 74, y: 178, w: 1050, h: 40, size: 20, color: dark ? C.mint : C.gray });
}

function badge(slide, label, x, y, w, { fill = C.paper, color = C.ink, border = C.mint } = {}) {
  rect(slide, { x, y, w, h: 42, fill, radius: 12, line: border, lineWidth: 1 });
  textBox(slide, label, { x: x + 10, y: y + 8, w: w - 20, h: 24, size: 15, color, bold: true, align: "center" });
}

async function build() {
  await fs.mkdir(previewDir, { recursive: true });
  await fs.mkdir(finalDir, { recursive: true });
  const p = Presentation.create({ slideSize: { width: W, height: H } });

  // 1 — Cover
  {
    const s = p.slides.add();
    s.background.fill = C.cream;
    rect(s, { x: 0, y: 0, w: 1280, h: 720, fill: C.cream });
    rect(s, { x: 760, y: 0, w: 520, h: 720, fill: C.forest, radius: 20 });
    s.images.add({
      blob: await bytes(path.join(workspaceDir, "presentation/assets/beacon-journey-art.png")),
      contentType: "image/png",
      alt: "Illustrated path connecting residents to benefit programs",
      fit: "cover",
      position: { left: 750, top: 0, width: 530, height: 720 },
    });
    s.images.add({
      blob: await bytes(path.join(workspaceDir, "public/benefitbeacon-logo-v1-512.png")),
      contentType: "image/png",
      alt: "BenefitBeacon logo",
      fit: "contain",
      position: { left: 70, top: 60, width: 90, height: 90 },
    });
    textBox(s, "BenefitBeacon", { x: 70, y: 188, w: 630, h: 92, size: 60, color: C.ink, bold: true });
    textBox(s, "Your personal guide to government benefits", { x: 72, y: 288, w: 580, h: 78, size: 31, color: C.ink });
    rect(s, { x: 72, y: 398, w: 112, h: 6, fill: C.coral, radius: 3 });
    textBox(s, "A resident-first path from one plain-language story to trusted programs and guided applications.", { x: 72, y: 432, w: 600, h: 92, size: 21, color: C.gray });
    rect(s, { x: 340, y: 580, w: 240, h: 42, fill: C.paper, radius: 12, line: C.mint, lineWidth: 1 });
    textBox(s, "SUNNYVALE · CALIFORNIA", { x: 350, y: 591, w: 220, h: 20, size: 12, color: C.ink, bold: true, align: "center" });
    textBox(s, "WEB · MOBILE · BROWSER GUIDE", { x: 600, y: 590, w: 350, h: 24, size: 14, color: C.gray, bold: true });
    notes(s, `Open with the 1:27 BenefitBeacon introduction video if time allows. Then say: “BenefitBeacon helps residents find the right starting point without knowing an agency or program name.”\n\nPresentation goal: explain the access problem, demonstrate the resident journey, and show why the architecture is trustworthy and resilient.`);
  }

  // 2 — Problem and evidence
  {
    const s = p.slides.add();
    s.background.fill = C.forest;
    addBrand(s, 2, true);
    sectionTitle(s, "The benefit access gap is measurable", "NCOA estimates for older adults use 2023 participation data and published average benefit values.", true);
    const cols = [72, 432, 792];
    const data = [
      ["SANTA CLARA COUNTY", "≈ $318M", "Estimated annual gap across SNAP, SSI, and Medicare Savings Programs"],
      ["CALIFORNIA", "≈ $7.0B", "Estimated annual gap across the same three programs"],
      ["UNITED STATES", "$58B", "NCOA's estimated 2023 annual gap for older adults"],
    ];
    data.forEach((d, i) => {
      rect(s, { x: cols[i], y: 270, w: 320, h: 260, fill: C.paper, radius: 18 });
      textBox(s, d[0], { x: cols[i] + 28, y: 302, w: 260, h: 24, size: 14, color: C.coral, bold: true });
      textBox(s, d[1], { x: cols[i] + 28, y: 350, w: 270, h: 72, size: 38, color: C.ink, bold: true });
      textBox(s, d[2], { x: cols[i] + 28, y: 454, w: 265, h: 66, size: 17, color: C.gray });
    });
    textBox(s, "County and state values are derived estimates using NCOA nonparticipant counts and benefit assumptions.", { x: 340, y: 624, w: 868, h: 30, size: 15, color: C.mint, align: "center" });
    notes(s, `These figures estimate missed program benefits, not unclaimed property. NCOA and the Urban Institute estimate that eligible adults age 65 and older left $58 billion unclaimed in 2023 across SNAP, Supplemental Security Income, and Medicare Savings Programs.\n\nSanta Clara County estimate: NCOA reports 39,962 eligible SNAP nonparticipants, 27,582 eligible SSI nonparticipants, and 22,687 eligible Medicare Savings Program nonparticipants. Applying NCOA's national monthly benefit assumptions of $188 for SNAP, $552.29 for SSI, and $164.90 for MSP produces an estimated annual gap of $317,846,461, shown as approximately $318 million.\n\nCalifornia estimate: NCOA reports 855,248 eligible SNAP nonparticipants, 602,919 eligible SSI nonparticipants, and 537,779 eligible MSP nonparticipants. Applying the same assumptions produces $6,989,430,187, shown as approximately $7.0 billion.\n\nThese program counts may overlap because a person can qualify for more than one program. NCOA does not publish a Sunnyvale-only estimate, so the slide uses Santa Clara County as the local figure.\n\nSources:\n- NCOA, Benefits Participation Map and 2023 data export: https://www.ncoa.org/benefits-participation-map/\n- NCOA, 9 Million Older Adults Missing Out on $58 Billion: https://www.ncoa.org/article/over-9-million-eligible-older-adults-are-missing-out-on-58-billion-in-benefits-that-can-help-them-afford-basic-necessities/\n- NCOA and Urban Institute technical report: https://assets.ncoa.org/ffacfe7d-10b6-0083-2632-604077fd4eca/3462824a-d7e9-4ddb-a936-7c2172599005/Estimated_Program_Participation_Rates_for_Adults_65_and_Older_2023.pdf`);
  }

  // 3 — Resident barriers
  {
    const s = p.slides.add();
    s.background.fill = C.cream;
    addBrand(s, 3);
    sectionTitle(s, "Residents should not need to know the system", "The burden today is on the person asking for help.");
    const items = [
      ["01", "Find the right doorway", "Programs are scattered across city, county, state, federal, utility, and community websites."],
      ["02", "Interpret the rules", "Eligibility language is hard to compare, and missing information can feel like a rejection."],
      ["03", "Finish the application", "The guidance often ends exactly when a resident reaches the official form."],
    ];
    items.forEach((it, i) => {
      const y = 254 + i * 112;
      circle(s, { x: 80, y: y + 4, d: 54, fill: i === 1 ? C.coral : C.ink });
      textBox(s, it[0], { x: 89, y: y + 18, w: 36, h: 20, size: 13, color: C.white, bold: true, align: "center" });
      textBox(s, it[1], { x: 164, y, w: 390, h: 38, size: 26, color: C.ink, bold: true });
      textBox(s, it[2], { x: 580, y: y - 2, w: 610, h: 72, size: 19, color: C.gray });
      if (i < 2) rect(s, { x: 107, y: y + 58, w: 2, h: 48, fill: C.mint });
    });
    rect(s, { x: 340, y: 650, w: 868, h: 2, fill: C.mint });
    textBox(s, "The goal is not more information. It is a clear next action.", { x: 340, y: 665, w: 868, h: 30, size: 18, color: C.ink, bold: true, align: "center" });
    notes(s, `Use a resident example: “I am in Sunnyvale, my water bill is high, and I may need help fixing a leak.” Today that person must know which city, utility, county, state, or federal site to search. BenefitBeacon starts from the story instead.`);
  }

  // 4 — Product experience
  {
    const s = p.slides.add();
    s.background.fill = C.paper;
    addBrand(s, 4);
    sectionTitle(s, "One conversation creates a guided path", "Questions are optional. The resident stays in control of what they share.");
    const x = [72, 354, 636, 918];
    const steps = [
      ["1", "Tell your story", "Use natural language or choose a sample prompt."],
      ["2", "Clarify only what matters", "Answer or skip focused follow-up questions."],
      ["3", "Compare possibilities", "See relevant programs with published rules and sources."],
      ["4", "Explore and apply", "Ask questions, then continue on the official site with the side-panel guide."],
    ];
    rect(s, { x: 140, y: 312, w: 990, h: 4, fill: C.mint });
    steps.forEach((st, i) => {
      circle(s, { x: x[i] + 74, y: 280, d: 68, fill: i === 3 ? C.coral : C.ink });
      textBox(s, st[0], { x: x[i] + 94, y: 299, w: 28, h: 30, size: 19, color: C.white, bold: true, align: "center" });
      textBox(s, st[1], { x: x[i], y: 376, w: 216, h: 60, size: 22, color: C.ink, bold: true, align: "center" });
      textBox(s, st[2], { x: x[i] - 8, y: 446, w: 232, h: 82, size: 16, color: C.gray, align: "center" });
    });
    badge(s, "NO ACCOUNT REQUIRED", 340, 614, 190, { fill: C.pale, color: C.ink, border: C.pale });
    badge(s, "OPTIONAL QUESTIONS", 548, 614, 190, { fill: C.pale, color: C.ink, border: C.pale });
    badge(s, "OFFICIAL SOURCES", 756, 614, 190, { fill: C.pale, color: C.ink, border: C.pale });
    badge(s, "ACCESSIBLE DESIGN", 964, 614, 244, { fill: C.pale, color: C.ink, border: C.pale });
    notes(s, `Walk through the four stages. Emphasize that every follow-up is optional and is asked only when it can materially improve the shortlist or answer. Residents can also browse all programs without sharing personal information.`);
  }

  // 5 — Program result
  {
    const s = p.slides.add();
    s.background.fill = C.cream;
    addBrand(s, 5);
    sectionTitle(s, "Every result is built to be checked", "AI explains the match. Published rules and program administrators decide.");
    rect(s, { x: 330, y: 260, w: 520, h: 350, fill: C.paper, radius: 18, line: C.mint, lineWidth: 1 });
    textBox(s, "HOME SUPPORT · SUNNYVALE", { x: 365, y: 296, w: 300, h: 26, size: 13, color: C.coral, bold: true });
    textBox(s, "Sunnyvale Home Access Grant", { x: 365, y: 342, w: 450, h: 52, size: 28, color: C.ink, bold: true });
    textBox(s, "Up to $9,500 for accessibility improvements", { x: 365, y: 410, w: 450, h: 44, size: 20, color: C.forest2, bold: true });
    const rows = [
      ["Published eligibility", "Lower-income Sunnyvale homeowners who are seniors or have a disability"],
      ["Official source", "City of Sunnyvale"],
      ["Last checked", "October 23, 2026"],
    ];
    rows.forEach((r, i) => {
      const y = 484 + i * 44;
      circle(s, { x: 365, y: y + 2, d: 20, fill: C.forest2 });
      textBox(s, "✓", { x: 366, y: y - 1, w: 18, h: 20, size: 14, color: C.white, bold: true, align: "center" });
      textBox(s, r[0], { x: 400, y, w: 140, h: 28, size: 14, color: C.ink, bold: true });
      textBox(s, r[1], { x: 545, y, w: 270, h: 40, size: 14, color: C.gray });
    });
    rect(s, { x: 880, y: 260, w: 328, h: 160, fill: C.forest, radius: 18 });
    textBox(s, "Why it may fit", { x: 912, y: 296, w: 264, h: 36, size: 24, color: C.white, bold: true });
    textBox(s, "A short explanation based only on the facts the resident chose to share.", { x: 912, y: 352, w: 254, h: 62, size: 16, color: C.mint });
    rect(s, { x: 880, y: 448, w: 328, h: 162, fill: C.coral, radius: 18 });
    textBox(s, "Explore this", { x: 912, y: 480, w: 264, h: 34, size: 24, color: C.ink, bold: true });
    textBox(s, "Ask about documents, next steps, deadlines, or published eligibility.", { x: 912, y: 530, w: 254, h: 58, size: 16, color: C.black });
    notes(s, `This is the trust moment. Each result preserves the curated program name, benefit, published eligibility text, official source, and freshness date. The AI may explain relevance, but it cannot rewrite these facts or claim final eligibility.\n\nProject sources:\n- /Users/surendra.s/Documents/App Challenge/data/programs.seed.json\n- /Users/surendra.s/Documents/App Challenge/data/programs.seed.sql\nThe generated SQL snapshot contains 62 records checked 2026-10-23; 52 records serve Sunnyvale.`);
  }

  // 6 — Guided application
  {
    const s = p.slides.add();
    s.background.fill = C.forest;
    addBrand(s, 6, true);
    sectionTitle(s, "The guide stays beside the official application", "The resident does not lose context when they leave the discovery page.", true);
    const stages = [
      ["DISCOVER", "BenefitBeacon", "Find a relevant program and understand why it may apply."],
      ["UNDERSTAND", "Explore this", "Ask source-grounded questions about eligibility and documents."],
      ["APPLY", "Browser side panel", "Explain visible fields and offer resident-approved safe fills."],
    ];
    stages.forEach((st, i) => {
      const x = 72 + i * 390;
      rect(s, { x, y: 260, w: 340, h: 260, fill: C.paper, radius: 18 });
      textBox(s, st[0], { x: x + 28, y: 290, w: 280, h: 24, size: 13, color: C.coral, bold: true });
      textBox(s, st[1], { x: x + 28, y: 340, w: 280, h: 44, size: 28, color: C.ink, bold: true });
      textBox(s, st[2], { x: x + 28, y: 410, w: 282, h: 82, size: 17, color: C.gray });
      if (i < 2) {
        rect(s, { x: x + 340, y: 390, w: 50, h: 4, fill: C.coral });
        circle(s, { x: x + 370, y: 378, d: 28, fill: C.coral });
      }
    });
    textBox(s, "Safety boundary", { x: 340, y: 598, w: 180, h: 30, size: 18, color: C.peach, bold: true });
    textBox(s, "No form submission, signature, sensitive identifier, consent, or verification bypass.", { x: 520, y: 598, w: 660, h: 48, size: 17, color: C.cream });
    notes(s, `Demonstrate the handoff from a program result to the official application. The side panel carries only the selected program, a constrained profile, and bounded conversation context. It can explain fields and offer safe fills after the resident approves the site. It does not submit forms or fill sensitive identifiers.\n\nSource: /Users/surendra.s/Documents/App Challenge/extension/README.md`);
  }

  // 7 — AI boundaries
  {
    const s = p.slides.add();
    s.background.fill = C.paper;
    addBrand(s, 7);
    sectionTitle(s, "AI helps inside firm boundaries", "The model supports judgment. It does not become the source of truth.");
    const labels = [
      ["UNDERSTAND", "Extract explicit facts from the resident’s words"],
      ["ASK", "Request only the missing detail that changes the answer"],
      ["RANK", "Reorder known record IDs after rule-based filtering"],
      ["EXPLAIN", "Describe why a published program may fit"],
    ];
    labels.forEach((v, i) => {
      const x = 72 + i * 285;
      circle(s, { x: x + 91, y: 270, d: 74, fill: i === 3 ? C.coral : C.ink });
      textBox(s, String(i + 1), { x: x + 113, y: 291, w: 30, h: 28, size: 18, color: C.white, bold: true, align: "center" });
      textBox(s, v[0], { x, y: 374, w: 256, h: 26, size: 14, color: C.coral, bold: true, align: "center" });
      textBox(s, v[1], { x, y: 414, w: 256, h: 82, size: 17, color: C.gray, align: "center" });
    });
    rect(s, { x: 340, y: 548, w: 868, h: 94, fill: C.pale, radius: 18 });
    textBox(s, "Program facts stay locked", { x: 370, y: 576, w: 260, h: 34, size: 22, color: C.ink, bold: true });
    textBox(s, "Names, amounts, rules, URLs, and freshness dates come from the local index. Unknown resident details are never treated as disqualifying facts.", { x: 650, y: 568, w: 510, h: 64, size: 16, color: C.gray });
    notes(s, `Explain the separation of responsibilities: deterministic code resolves geography, applies narrow contradiction checks, and retrieves records. AI extracts explicit facts, proposes optional questions, ranks only supplied IDs, and explains. Unknown facts are not negative evidence. The administering program makes the final decision.\n\nSource: /Users/surendra.s/Documents/App Challenge/ARCHITECTURE_AND_TECHNICAL_DESIGN.md`);
  }

  // 8 — Architecture
  {
    const s = p.slides.add();
    s.background.fill = C.cream;
    addBrand(s, 8);
    sectionTitle(s, "A practical architecture built for reliability", "The normal discovery path still works when AI or live search is unavailable.");
    const nodes = [
      [72, 286, 200, 98, C.paper, "React PWA", "Web + mobile"],
      [320, 286, 220, 98, C.paper, "Worker APIs", "Intake · discovery · chat"],
      [590, 232, 250, 98, C.forest, "D1 / SQLite", "62 records · 52 serve Sunnyvale"],
      [590, 392, 250, 98, C.paper, "Deterministic matcher", "Rules + 128-D similarity"],
      [890, 232, 250, 98, C.coral, "OpenAI", "Understand · rank · explain"],
      [890, 392, 250, 98, C.paper, "Official web search", "Current program answers"],
      [320, 550, 220, 82, C.paper, "Chrome / Edge", "Guide beside official form"],
    ];
    nodes.forEach((n) => {
      const [x, y, w, h, fill, title, sub] = n;
      rect(s, { x, y, w, h, fill, radius: 16, line: fill === C.paper ? C.mint : fill, lineWidth: fill === C.paper ? 1 : 0 });
      const wrappedTitle = title === "Deterministic matcher";
      textBox(s, title, { x: x + 18, y: y + (wrappedTitle ? 12 : 18), w: w - 36, h: wrappedTitle ? 48 : 30, size: wrappedTitle ? 18 : 20, color: fill === C.forest ? C.white : C.ink, bold: true, align: "center" });
      textBox(s, sub, { x: x + 18, y: y + (wrappedTitle ? 64 : 56), w: w - 36, h: 24, size: 13, color: fill === C.forest ? C.mint : C.gray, align: "center" });
    });
    // orthogonal connectors
    rect(s, { x: 272, y: 332, w: 48, h: 4, fill: C.coral });
    rect(s, { x: 540, y: 332, w: 50, h: 4, fill: C.coral });
    rect(s, { x: 540, y: 438, w: 50, h: 4, fill: C.mint });
    rect(s, { x: 840, y: 278, w: 50, h: 4, fill: C.coral });
    rect(s, { x: 840, y: 438, w: 50, h: 4, fill: C.mint });
    rect(s, { x: 428, y: 384, w: 4, h: 166, fill: C.mint });
    rect(s, { x: 860, y: 548, w: 330, h: 50, fill: C.forest, radius: 14 });
    textBox(s, "MATCHING WORKS WITHOUT AI", { x: 875, y: 564, w: 300, h: 22, size: 12, color: C.white, bold: true, align: "center" });
    notes(s, `High-level stack: React 19 and TypeScript with a Next.js-compatible App Router, Vinext/Vite, Cloudflare Worker-compatible APIs, D1/SQLite, deterministic 128-dimensional local embeddings, optional OpenAI Responses API calls, official web search for current program questions, and a Manifest V3 browser extension.\n\nThe critical reliability point: normal indexed discovery does not require live search, and deterministic ranking remains available when OpenAI times out.\n\nSource: /Users/surendra.s/Documents/App Challenge/ARCHITECTURE_AND_TECHNICAL_DESIGN.md`);
  }

  // 9 — Demo plan
  {
    const s = p.slides.add();
    s.background.fill = C.paper;
    addBrand(s, 9);
    sectionTitle(s, "Live demo: from a need to an application", "A focused two-minute resident journey.");
    rect(s, { x: 72, y: 254, w: 1136, h: 84, fill: C.forest, radius: 18 });
    textBox(s, "“I live in Sunnyvale. My water bill is high, and I think I may have a leak.”", { x: 110, y: 278, w: 1060, h: 42, size: 24, color: C.white, bold: true, align: "center" });
    const demo = [
      ["1", "START", "Enter the story in natural language"],
      ["2", "CLARIFY", "Skip or answer one optional question"],
      ["3", "EXPLORE", "Open a water-related program and ask what is needed"],
      ["4", "APPLY", "Launch the official site with BenefitBeacon beside it"],
    ];
    demo.forEach((d, i) => {
      const x = 72 + i * 285;
      circle(s, { x, y: 400, d: 48, fill: i === 3 ? C.coral : C.ink });
      textBox(s, d[0], { x: x + 13, y: 413, w: 22, h: 20, size: 14, color: C.white, bold: true, align: "center" });
      textBox(s, d[1], { x: x + 64, y: 397, w: 190, h: 26, size: 13, color: C.coral, bold: true });
      textBox(s, d[2], { x: x + 64, y: 432, w: 188, h: 86, size: 17, color: C.gray });
    });
    rect(s, { x: 340, y: 580, w: 868, h: 72, fill: C.pale, radius: 18 });
    textBox(s, "Backup path", { x: 370, y: 603, w: 140, h: 28, size: 18, color: C.ink, bold: true });
    textBox(s, "If an AI call is unavailable, show that local matching, source links, and the full program catalog still work.", { x: 520, y: 598, w: 640, h: 44, size: 16, color: C.gray });
    notes(s, `Demo checklist:\n1. Open the Agent experience.\n2. Paste the sample resident story.\n3. Answer or skip a follow-up to show resident control.\n4. Select a water or utility program.\n5. Ask: “What documents should I have ready?”\n6. Click Apply with BenefitBeacon and open the extension side panel.\n\nIf the network or AI service is unavailable, use Show all available programs and explain the deterministic fallback.`);
  }

  // 10 — Close
  {
    const s = p.slides.add();
    s.background.fill = C.cream;
    addBrand(s, 10);
    s.images.add({
      blob: await bytes(path.join(workspaceDir, "public/benefitbeacon-logo-v1-512.png")),
      contentType: "image/png",
      alt: "BenefitBeacon logo",
      fit: "contain",
      position: { left: 520, top: 120, width: 240, height: 240 },
    });
    textBox(s, "BenefitBeacon", { x: 220, y: 378, w: 840, h: 82, size: 56, color: C.ink, bold: true, align: "center" });
    textBox(s, "Find the help. Follow the path.", { x: 220, y: 468, w: 840, h: 52, size: 28, color: C.coral, bold: true, italic: true, align: "center" });
    const values = ["Clear choices", "Trusted sources", "Guidance that stays"];
    values.forEach((v, i) => badge(s, v, 340 + i * 290, 566, 240, { fill: C.paper, color: C.ink, border: C.mint }));
    notes(s, `Close with: “Public benefits should not depend on knowing the right agency, acronym, or search terms. BenefitBeacon gives residents a trustworthy starting point and stays with them through the next step.”\n\nInvite questions or return to the live product.`);
  }

  // Render authoring previews.
  for (const [index, slide] of p.slides.items.entries()) {
    const blob = await p.export({ slide, format: "png", scale: 1 });
    await fs.writeFile(path.join(previewDir, `slide-${String(index + 1).padStart(2, "0")}.png`), new Uint8Array(await blob.arrayBuffer()));
  }
  const montage = await p.export({ format: "webp", montage: true, scale: 0.5 });
  await fs.writeFile(path.join(buildDir, "deck-montage.webp"), new Uint8Array(await montage.arrayBuffer()));

  const { finalizePresentation } = await import(pathToFileURL(path.join(skillDir, "container_tools/artifact_tool_utils.mjs")).href);
  const stagingDir = path.join(workspaceDir, "presentation/.codex-finalizer");
  await fs.mkdir(stagingDir, { recursive: true });
  const candidatePath = path.join(stagingDir, "candidate-v5-avatar-safe.pptx");
  await (await PresentationFile.exportPptx(p)).save(candidatePath);
  const result = await finalizePresentation({
    workspaceDir,
    candidatePath,
    finalPath,
    pythonExecutable,
    integrityValidatorPath: path.join(skillDir, "container_tools/inspect_presentation_package_integrity.py"),
    layoutValidatorPath: path.join(skillDir, "container_tools/inspect_presentation_layout_geometry.py"),
    layoutArgs: [
      "--expected-slide-size-emu", "12192000,6858000",
      "--validate-bullet-geometry",
      "--validate-heading-fit",
    ],
    explicitTotalSlideCount: 10,
    requiredNativeTableOwnerSlides: [],
    requiredNativeChartOwnerSlides: [],
    fontPolicy: { basis: "design", families: [FONT] },
    verifyArtifactToolImport: true,
    receiptPath: path.join(stagingDir, "BenefitBeacon-Presentation-v5-avatar-safe.validation.json"),
  });
  console.log(JSON.stringify({ finalPath, result }, null, 2));

  // Render the finalized file, not only the in-memory draft.
  const finalDeck = await PresentationFile.importPptx(await FileBlob.load(finalPath));
  const finalPreviewDir = path.join(buildDir, "final-previews");
  await fs.mkdir(finalPreviewDir, { recursive: true });
  for (const [index, slide] of finalDeck.slides.items.entries()) {
    const blob = await finalDeck.export({ slide, format: "png", scale: 1 });
    await fs.writeFile(path.join(finalPreviewDir, `slide-${String(index + 1).padStart(2, "0")}.png`), new Uint8Array(await blob.arrayBuffer()));
  }
  const finalMontage = await finalDeck.export({ format: "webp", montage: true, scale: 0.5 });
  await fs.writeFile(path.join(buildDir, "final-deck-montage.webp"), new Uint8Array(await finalMontage.arrayBuffer()));
}

build().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
