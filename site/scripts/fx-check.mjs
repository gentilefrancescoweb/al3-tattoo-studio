#!/usr/bin/env node
// Interaction check for the tattoo effects, with real CDP mouse input:
// a clean pointer (no trail), ink splatter, the machine's sound toggle, the title mid-tattoo.
//   node scripts/fx-check.mjs <outDir>
import { writeFileSync, mkdirSync, existsSync } from "node:fs";
import { spawn } from "node:child_process";
const OUT = process.argv[2] || "qa/fx";
const URL_ = process.env.SITE_URL || "http://localhost:5174";
const CHROME = [process.env.CHROME, "C:/Program Files/Google/Chrome/Application/chrome.exe", "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe"].filter(Boolean).find((p) => existsSync(p));
const PORT = 9336;
mkdirSync(OUT, { recursive: true });
const chrome = spawn(CHROME, ["--headless=new", `--remote-debugging-port=${PORT}`, "--no-first-run", "--autoplay-policy=no-user-gesture-required", "--user-data-dir=" + (process.env.TEMP || "/tmp") + "/fx-profile", "about:blank"], { stdio: "ignore" });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let ws, mid = 0; const pending = new Map(); const exceptions = [];
for (let i = 0; i < 30 && !ws; i++) { try { const r = await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, { method: "PUT" }); ws = new WebSocket((await r.json()).webSocketDebuggerUrl); } catch { await sleep(400); } }
await new Promise((r) => (ws.onopen = r));
ws.onmessage = (m) => { const d = JSON.parse(m.data); if (d.id && pending.has(d.id)) { pending.get(d.id)(d.result); pending.delete(d.id); } else if (d.method === "Runtime.exceptionThrown") exceptions.push(d.params?.exceptionDetails?.exception?.description || d.params?.exceptionDetails?.text); };
const send = (method, params = {}) => new Promise((res) => { const id = ++mid; pending.set(id, res); ws.send(JSON.stringify({ id, method, params })); });
const ev = async (expr) => (await send("Runtime.evaluate", { expression: expr, awaitPromise: true, returnByValue: true })).result?.value;
const shot = async (name) => { const s = await send("Page.captureScreenshot", { format: "jpeg", quality: 80 }); writeFileSync(`${OUT}/${name}.jpg`, Buffer.from(s.data, "base64")); };
const mouse = (type, x, y, extra = {}) => send("Input.dispatchMouseEvent", { type, x, y, ...extra });
const results = [];
const check = (name, ok, info = "") => results.push(`${ok ? "PASS" : "FAIL"}  ${name}${info ? "  — " + info : ""}`);

await send("Page.enable"); await send("Runtime.enable");
await send("Emulation.setDeviceMetricsOverride", { width: 1280, height: 720, deviceScaleFactor: 1, mobile: false });
await send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-reduced-motion", value: "no-preference" }] });
await send("Page.navigate", { url: URL_ });
await sleep(10500);

check("title fully inked after the intro", await ev(`document.querySelector('.hero-title').classList.contains('inked') && getComputedStyle(document.querySelector('.ht-logo')).getPropertyValue('--p').trim() === '1.0000'`));

// a needle stroke across the hero
for (let i = 0; i <= 40; i++) {
  const t = i / 40;
  await mouse("mouseMoved", 220 + t * 840, 420 + Math.sin(t * Math.PI * 2) * 120);
  await sleep(12);
}
await shot("trail");
check("nothing follows the pointer", await ev(`(() => { const c = document.querySelector('.ink-fx'); const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let n = 0; for (let i = 3; i < d.length; i += 16) if (d[i] > 40) n++; return n === 0; })()`)); // round 8: no cursor viper

// splatter where the needle lands
await mouse("mousePressed", 640, 300, { button: "left", clickCount: 1 });
await mouse("mouseReleased", 640, 300, { button: "left", clickCount: 1 });
await sleep(160);
await shot("splat");
const splat = await ev(`(() => { const c = document.querySelector('.ink-fx'); const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let n = 0; for (let i = 3; i < d.length; i += 16) if (d[i] > 40) n++; return n; })()`);
check("ink splatter on click", splat > 300, `${splat} inked samples`);
await sleep(3500);
const clean = await ev(`(() => { const c = document.querySelector('.ink-fx'); const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let n = 0; for (let i = 3; i < d.length; i += 16) if (d[i] > 10) n++; return n; })()`);
check("ink heals away", clean === 0, `${clean} samples left`);

// a click on a flying design opens it: close that first
await ev(`document.getElementById('lightbox').hidden || document.getElementById('lb-close').click()`);
await sleep(300);
// the machine's sound: a real click on the toggle
const r = await ev(`(() => { const b = document.getElementById('snd').getBoundingClientRect(); return [b.x + b.width / 2, b.y + b.height / 2]; })()`);
await mouse("mouseMoved", r[0], r[1]);
const hitEl = await ev(`(() => { const e = document.elementFromPoint(${r[0]}, ${r[1]}); return e ? (e.tagName + '#' + e.id + '.' + e.className.baseVal ?? e.className) : null; })()`);
await mouse("mousePressed", r[0], r[1], { button: "left", clickCount: 1 });
await mouse("mouseReleased", r[0], r[1], { button: "left", clickCount: 1 });
await sleep(400);
check("sound toggle switches on", await ev(`document.getElementById('snd').getAttribute('aria-pressed') === 'true'`), "hit " + hitEl + " at " + r.map(Math.round));
await mouse("mousePressed", r[0], r[1], { button: "left", clickCount: 1 });
await mouse("mouseReleased", r[0], r[1], { button: "left", clickCount: 1 });
await sleep(300);
check("…and off again", await ev(`document.getElementById('snd').getAttribute('aria-pressed') === 'false'`));

// the title mid-tattoo (forced to 55% on the second line, needle visible)
await ev(`(() => { const l = document.querySelector('.ht-logo'); document.querySelector('.hero-title').classList.remove('inked'); l.style.setProperty('--p', .55); l.classList.add('writing'); })()`);
await mouse("mouseMoved", 5, 700);
await sleep(300);
await shot("title-mid");
check("no exceptions", exceptions.length === 0, exceptions.slice(0, 3).join(" | "));
console.log(results.join("\n"));
ws.close(); chrome.kill(); process.exit(0);
