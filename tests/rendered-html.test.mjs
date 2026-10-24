import assert from "node:assert/strict";
import test from "node:test";

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);
  return worker.fetch(
    new Request("http://localhost/", { headers: { accept: "text/html", host: "localhost" } }),
    { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } },
    { waitUntil() {}, passThroughOnException() {} },
  );
}

test("server-renders the finished BenefitBeacon experience", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);
  const html = await response.text();
  assert.match(html, /<title>BenefitBeacon/);
  assert.match(html, /Let’s find the help meant for you/);
  assert.match(html, /Hi, I’m BenefitBeacon/);
  assert.match(html, /benefitbeacon-logo-v1-64\.png/);
  assert.match(html, /What would make life a little easier/);
  assert.match(html, /What is available to me/);
  assert.match(html, /I know what I want/);
  assert.match(html, /Show all available programs/);
  assert.match(html, /Guide me with questions/);
  assert.match(html, /Show all 52 programs/);
  assert.match(html, /Explore all programs/);
  assert.match(html, /Ask BenefitBeacon/);
  assert.match(html, /<strong>52<\/strong>/);
  assert.match(html, /programs BenefitBeacon can explore/);
  assert.match(html, /A guide that listens/);
  assert.match(html, /52 programs ready to explore/i);
  assert.doesNotMatch(html, /CA-17/);
  assert.match(html, /Optional questions/i);
  assert.match(html, /\$34K/);
  assert.match(html, /\$50K/);
  assert.match(html, /\$500/);
  assert.doesNotMatch(html, /Cupertino/i);
  assert.doesNotMatch(html, /AI understands|local index|SQLite|vector|extraction confidence/i);
  assert.doesNotMatch(html, /Search live programs|Use guided questions/);
  assert.doesNotMatch(html, /Reviewed Program|reviewed programs|Rules decide/i);
  assert.doesNotMatch(html, /codex-preview|Your site is taking shape|react-loading-skeleton/);
});

test("includes PWA and social metadata", async () => {
  const html = await (await render()).text();
  assert.match(html, /manifest\.webmanifest/);
  assert.match(html, /og-sunnyvale-guide\.png/);
  assert.match(html, /theme-color/);
});

test("includes core accessibility affordances", async () => {
  const html = await (await render()).text();
  assert.match(html, /href="#main-content"[^>]*>Skip to main content/);
  assert.match(html, /<main id="main-content"[^>]*tabindex="-1"/);
  assert.match(html, /aria-label="Use extra-large text"/);
  assert.match(html, /aria-label="Use high contrast colors"/);
  assert.match(html, /id="situation"[^>]*minLength="8"[^>]*required=""/);
  assert.match(html, /aria-describedby="situation-help situation-privacy"/);
});
