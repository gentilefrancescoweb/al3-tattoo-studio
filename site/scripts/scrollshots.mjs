#!/usr/bin/env node
// Scroll ladder QA — headless Chrome/Edge over raw CDP (no npm deps, Node ≥ 22).
// Screenshots the page at a ladder of scroll positions with the full motion
// stack running, which is the ONLY trustworthy way to see what a visitor sees:
// embedded preview panes freeze requestAnimationFrame when occluded, so scrub,
// pins and reveals silently die there and look like bugs (or hide real ones).
//
//   node scrollshots.mjs [outDir] [WxH] [mobile]
//   node scrollshots.mjs qa/desk                    → 1280x720, 15 even stops
//   node scrollshots.mjs qa/m390 390x844 mobile     → phone emulation (dsf 2, touch UA)
//   SITE_URL=http://localhost:5174 CHROME="C:/…/chrome.exe" node scrollshots.mjs …
//
// Review the JPEGs in order: every pinned act should show its film at the right
// progress, copy should never overlap controls, and no stop should be blank.

import { writeFileSync, mkdirSync, existsSync } from "node:fs";
import { spawn } from "node:child_process";

const OUT = process.argv[2] || "qa/shots";
const VP = (process.argv[3] || "1280x720").split("x").map(Number);
const IS_MOBILE = process.argv.includes("mobile");
const URL_ = process.env.SITE_URL || "http://localhost:5174";
const CANDIDATES = [
  process.env.CHROME,
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  "C:/Program Files/Microsoft/Edge/Application/msedge.exe",
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/usr/bin/google-chrome", "/usr/bin/chromium", "/usr/bin/chromium-browser",
].filter(Boolean);
const CHROME = CANDIDATES.find((p) => existsSync(p));
if (!CHROME) { console.error("no Chrome/Edge found — set CHROME=/path/to/browser"); process.exit(1); }
const PORT = 9333;
const SETTLE_MS = +(process.env.SETTLE_MS || 6000); // loader gate + first decode
const STOPS = +(process.env.STOPS || 15);

mkdirSync(OUT, { recursive: true });
const chrome = spawn(CHROME, [
  "--headless=new", `--remote-debugging-port=${PORT}`,
  "--window-size=1300,800", "--no-first-run", "--no-default-browser-check",
  "--user-data-dir=" + (process.env.TEMP || "/tmp") + "/scrollshots-profile", "about:blank",
], { stdio: "ignore" });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function getWs() {
  for (let i = 0; i < 30; i++) {
    try {
      const res = await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, { method: "PUT" });
      return (await res.json()).webSocketDebuggerUrl;
    } catch { await sleep(400); }
  }
  throw new Error("CDP not reachable");
}
let mid = 0; const pending = new Map(); let ws;
const send = (method, params = {}) => new Promise((resolve, reject) => {
  const id = ++mid; pending.set(id, { resolve, reject }); ws.send(JSON.stringify({ id, method, params }));
});
ws = new WebSocket(await getWs());
await new Promise((r) => (ws.onopen = r));
const exceptions = [];
ws.onmessage = (m) => {
  const d = JSON.parse(m.data);
  if (d.id && pending.has(d.id)) { pending.get(d.id).resolve(d.result); pending.delete(d.id); }
  else if (d.method === "Runtime.exceptionThrown") exceptions.push(d.params?.exceptionDetails?.text);
};

await send("Page.enable");
await send("Runtime.enable");
// metrics BEFORE navigate so width gates (MOBILE = innerWidth < 760) run correctly;
// --window-size does not govern CDP-spawned tabs
await send("Emulation.setDeviceMetricsOverride", { width: VP[0], height: VP[1], deviceScaleFactor: IS_MOBILE ? 2 : 1, mobile: IS_MOBILE });
// headless defaults to prefers-reduced-motion: reduce — force the motion branch
await send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-reduced-motion", value: "no-preference" }] });
await send("Page.navigate", { url: URL_ });
await sleep(SETTLE_MS);

const evalJs = async (expr) => (await send("Runtime.evaluate", { expression: expr, awaitPromise: true, returnByValue: true })).result?.value;
const height = await evalJs("document.body.scrollHeight");
console.log("viewport", VP.join("x"), IS_MOBILE ? "mobile" : "desktop", "pageHeight", height);
const stops = Array.from({ length: STOPS }, (_, i) => Math.round(((height - VP[1]) * i) / (STOPS - 1)));
for (const y of stops) {
  // the site exposes window.__lenis; scrolling through it is the only way to move
  // while Lenis runs (window.scrollTo is overridden on the next frame)
  await evalJs(`window.__lenis ? (__lenis.scrollTo(${y}, { immediate: true }), true) : (window.scrollTo(0, ${y}), true)`);
  await sleep(900); // let scrub smoothing + decode settle
  const shot = await send("Page.captureScreenshot", { format: "jpeg", quality: 70 });
  writeFileSync(`${OUT}/y${String(y).padStart(5, "0")}.jpg`, Buffer.from(shot.data, "base64"));
  console.log("shot", y);
}
const overflow = await evalJs("document.documentElement.scrollWidth > window.innerWidth");
console.log("horizontal overflow:", overflow, "| exceptions:", exceptions.length, exceptions.slice(0, 3));
ws.close(); chrome.kill(); process.exit(0);
