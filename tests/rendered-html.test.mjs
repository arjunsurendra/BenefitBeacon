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

test("server-renders the finished BenefitFinder experience", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);
  const html = await response.text();
  assert.match(html, /<title>BenefitFinder/);
  assert.match(html, /You may qualify for help/);
  assert.match(html, /Tell us about your situation/);
  assert.match(html, /AI explains/);
  assert.match(html, /Official sources/);
  assert.doesNotMatch(html, /codex-preview|Your site is taking shape|react-loading-skeleton/);
});

test("includes PWA and social metadata", async () => {
  const html = await (await render()).text();
  assert.match(html, /manifest\.webmanifest/);
  assert.match(html, /og\.png/);
  assert.match(html, /theme-color/);
});
