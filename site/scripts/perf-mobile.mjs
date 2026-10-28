#!/usr/bin/env node
// Mobile scroll performance, per act (headless Chrome over CDP, same pattern as shots-at.mjs).
//   [CPU=4] [SPEED=1400] [GPU=0] [SITE_URL=…] node scripts/perf-mobile.mjs [WxH]
// A phone (touch, DPR 3, CPU slowed CPU×) scrolls the page top to bottom at SPEED px/s, one step per frame, like a
// steady thumb. For each act: frames, mean / p95 frame time, % of frames over 25 ms (visible stutter), long tasks;
// for the whole run: style recalcs, layouts and their main-thread time. Headless WebGL may be software: read the
// WebGL acts (hero, owl) for main-thread cost, not GPU cost.
import { existsSync } from "node:fs";
import { spawn } from "node:child_process";

const VP = (process.argv[2] || "390x844").split("x").map(Number);
const URL_ = process.env.SITE_URL || "http://localhost:5174";
const CPU = +(process.env.CPU || 4), SPEED = +(process.env.SPEED || 1400);
const CHROME = [process.env.CHROME, "C:/Program Files/Google/Chrome/Application/chrome.exe", "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe"].filter(Boolean).find((p) => existsSync(p));
const PORT = 9336;
// GPU=0: software compositing. Slower, but steady run to run; the headless GPU path swings wildly (same code, ×5).
const chrome = spawn(CHROME, ["--headless=new", `--remote-debugging-port=${PORT}`, "--no-first-run", "--no-default-browser-check",
  ...(process.env.GPU === "0" ? ["--disable-gpu"] : []),
  "--user-data-dir=" + (process.env.TEMP || "/tmp") + "/perf-mobile-profile", "about:blank"], { stdio: "ignore" });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let ws, mid = 0; const pending = new Map(); const exceptions = [];
for (let i = 0; i < 30 && !ws; i++) {
  try { const r = await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, { method: "PUT" }); ws = new WebSocket((await r.json()).webSocketDebuggerUrl); }
  catch { await sleep(400); }
}
await new Promise((r) => (ws.onopen = r));
ws.onmessage = (m) => {
  const d = JSON.parse(m.data);
  if (d.id && pending.has(d.id)) { pending.get(d.id)(d.result); pending.delete(d.id); }
  else if (d.method === "Runtime.exceptionThrown") exceptions.push(d.params?.exceptionDetails?.exception?.description || d.params?.exceptionDetails?.text);
};
const send = (method, params = {}) => new Promise((res) => { const id = ++mid; pending.set(id, res); ws.send(JSON.stringify({ id, method, params })); });
const evalJs = async (expr) => (await send("Runtime.evaluate", { expression: expr, awaitPromise: true, returnByValue: true })).result?.value;

await send("Page.enable"); await send("Runtime.enable"); await send("Performance.enable");
await send("Emulation.setDeviceMetricsOverride", { width: VP[0], height: VP[1], deviceScaleFactor: 3, mobile: true });
await send("Emulation.setTouchEmulationEnabled", { enabled: true, maxTouchPoints: 5 });
await send("Emulation.setUserAgentOverride", { userAgent: "Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Mobile Safari/537.36" });
await send("Page.navigate", { url: URL_ });
await sleep(+(process.env.SETTLE_MS || 10000));
await send("Emulation.setCPUThrottlingRate", { rate: CPU });
await sleep(800);

const metrics = async () => Object.fromEntries((await send("Performance.getMetrics")).metrics.map((m) => [m.name, m.value]));
const m0 = await metrics();
const result = await evalJs(`(async () => {
  const acts = [...document.querySelectorAll("main > section, section.act, footer")].filter((s, i, a) => a.indexOf(s) === i && s.id);
  const top = (el) => el.getBoundingClientRect().top + scrollY;
  const bounds = acts.map((el) => ({ id: el.id, y: top(el) })).sort((a, b) => a.y - b.y);
  const actAt = (y) => { let id = bounds[0].id; for (const b of bounds) if (y + innerHeight / 2 >= b.y) id = b.id; return id; };
  const long = [];
  new PerformanceObserver((l) => l.getEntries().forEach((e) => long.push({ t: e.startTime, d: e.duration }))).observe({ type: "longtask", buffered: false });
  const max = document.documentElement.scrollHeight - innerHeight;
  const frames = [];
  let y = 0, last = performance.now();
  await new Promise((done) => {
    const step = (t) => {
      const dt = t - last; last = t;
      frames.push({ t, dt, act: actAt(y) });
      y = Math.min(max, y + ${SPEED} * Math.min(dt, 50) / 1000);
      window.scrollTo(0, y);
      if (y >= max) return done();
      requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  });
  await new Promise((r) => setTimeout(r, 400));
  const by = {};
  frames.slice(1).forEach((f) => { (by[f.act] ||= []).push(f.dt); });
  const order = [...new Set(frames.map((f) => f.act))];
  const stat = (a) => { const s = [...a].sort((x, y) => x - y); return { n: a.length, mean: +(a.reduce((x, y) => x + y, 0) / a.length).toFixed(1), p95: +s[Math.floor(s.length * 0.95)].toFixed(1), jank: +(100 * a.filter((d) => d > 25).length / a.length).toFixed(0), worst: +s[s.length - 1].toFixed(0) }; };
  const actOfTime = (t) => { let a = frames[0].act; for (const f of frames) { if (f.t > t) break; a = f.act; } return a; };
  const lt = {};
  long.forEach((e) => { const a = actOfTime(e.t); lt[a] ||= { n: 0, ms: 0 }; lt[a].n++; lt[a].ms += e.d; });
  return { height: max + innerHeight, acts: order.map((a) => ({ act: a, ...stat(by[a]), longTasks: lt[a]?.n || 0, longMs: Math.round(lt[a]?.ms || 0) })), all: stat(frames.slice(1).map((f) => f.dt)) };
})()`);
const m1 = await metrics();
const d = (k) => +(m1[k] - m0[k]).toFixed(k.endsWith("Duration") ? 3 : 0);
console.log(`phone ${VP.join("x")} · CPU ×${CPU} · ${SPEED} px/s · page ${result.height}px`);
console.log("act".padEnd(14), "frames  mean   p95  jank%  worst  longTasks(ms)");
for (const a of result.acts) console.log(a.act.padEnd(14), String(a.n).padStart(6), String(a.mean).padStart(6), String(a.p95).padStart(6), String(a.jank).padStart(5), String(a.worst).padStart(6), `  ${a.longTasks} (${a.longMs})`);
console.log("ALL".padEnd(14), String(result.all.n).padStart(6), String(result.all.mean).padStart(6), String(result.all.p95).padStart(6), String(result.all.jank).padStart(5), String(result.all.worst).padStart(6));
console.log(`style recalcs ${d("RecalcStyleCount")} (${(d("RecalcStyleDuration") * 1000).toFixed(0)} ms) · layouts ${d("LayoutCount")} (${(d("LayoutDuration") * 1000).toFixed(0)} ms) · script ${(d("ScriptDuration") * 1000).toFixed(0)} ms · tasks ${(d("TaskDuration") * 1000).toFixed(0)} ms`);
console.log("exceptions:", exceptions.length, exceptions.slice(0, 2));
ws.close(); chrome.kill(); process.exit(0);
