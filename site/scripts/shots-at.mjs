#!/usr/bin/env node
// Screenshot exact scroll positions (headless Chrome over CDP, same pattern as scrollshots.mjs).
//   POINTS='["expr returning y", …]' [HOVER='x,y'] [PRESS=1] node scripts/shots-at.mjs <outDir> [WxH] [mobile]
// PRESS=1 holds the left button down at the HOVER point while the shot is taken (released after it).
// Each expression runs in the page; e.g. a pinned act's spacer top + progress × its pin length.
import { writeFileSync, mkdirSync, existsSync } from "node:fs";
import { spawn } from "node:child_process";

const OUT = process.argv[2] || "qa/at";
const VP = (process.argv[3] || "1280x720").split("x").map(Number);
const IS_MOBILE = process.argv.includes("mobile");
const URL_ = process.env.SITE_URL || "http://localhost:5174";
const POINTS = JSON.parse(process.env.POINTS || "[]");
const CHROME = [process.env.CHROME, "C:/Program Files/Google/Chrome/Application/chrome.exe", "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe"].filter(Boolean).find((p) => existsSync(p));
const PORT = 9334;
mkdirSync(OUT, { recursive: true });
const chrome = spawn(CHROME, ["--headless=new", `--remote-debugging-port=${PORT}`, "--no-first-run", "--no-default-browser-check",
  "--user-data-dir=" + (process.env.TEMP || "/tmp") + "/shots-at-profile", "about:blank"], { stdio: "ignore" });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let ws, mid = 0; const pending = new Map(); const exceptions = [], logs = [];
for (let i = 0; i < 30 && !ws; i++) {
  try { const r = await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, { method: "PUT" }); ws = new WebSocket((await r.json()).webSocketDebuggerUrl); }
  catch { await sleep(400); }
}
await new Promise((r) => (ws.onopen = r));
ws.onmessage = (m) => {
  const d = JSON.parse(m.data);
  if (d.id && pending.has(d.id)) { pending.get(d.id)(d.result); pending.delete(d.id); }
  else if (d.method === "Runtime.exceptionThrown") exceptions.push(d.params?.exceptionDetails?.exception?.description || d.params?.exceptionDetails?.text);
  else if (d.method === "Runtime.consoleAPICalled" && ["error", "warning"].includes(d.params.type)) logs.push(d.params.args.map((a) => a.value ?? a.description).join(" ").slice(0, 200));
};
const send = (method, params = {}) => new Promise((res) => { const id = ++mid; pending.set(id, res); ws.send(JSON.stringify({ id, method, params })); });
await send("Page.enable"); await send("Runtime.enable");
await send("Emulation.setDeviceMetricsOverride", { width: VP[0], height: VP[1], deviceScaleFactor: IS_MOBILE ? 2 : 1, mobile: IS_MOBILE });
await send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-reduced-motion", value: process.env.REDUCED ? "reduce" : "no-preference" }] });
await send("Page.navigate", { url: URL_ });
await sleep(+(process.env.SETTLE_MS || 9000));
const evalJs = async (expr) => (await send("Runtime.evaluate", { expression: expr, awaitPromise: true, returnByValue: true })).result?.value;
let k = 0;
for (const expr of POINTS) {
  const y = await evalJs(`(() => { const y = Math.round(${expr}); __lenis.scrollTo(y, { immediate: true, force: true }); return y; })()`);
  if (process.env.HOVER) { // HOVER='x,y' (or a JS expression returning [x, y]): move the real mouse there first
    const at = process.env.HOVER.includes(",") && !process.env.HOVER.includes("(") ? process.env.HOVER.split(",").map(Number) : await evalJs(process.env.HOVER);
    await send("Input.dispatchMouseEvent", { type: "mouseMoved", x: at[0], y: at[1] });
    if (process.env.PRESS) { await sleep(600); await send("Input.dispatchMouseEvent", { type: "mousePressed", x: at[0], y: at[1], button: "left", buttons: 1, clickCount: 1 }); }
    var pressAt = at;
  }
  await sleep(+(process.env.WAIT_MS || 1100));
  const shot = await send("Page.captureScreenshot", { format: "jpeg", quality: 80 });
  writeFileSync(`${OUT}/p${String(k++).padStart(2, "0")}_y${y}.jpg`, Buffer.from(shot.data, "base64"));
  if (process.env.EVAL_EACH) console.log("each:", JSON.stringify(await evalJs(process.env.EVAL_EACH)));
  if (process.env.PRESS && pressAt) await send("Input.dispatchMouseEvent", { type: "mouseReleased", x: pressAt[0], y: pressAt[1], button: "left", buttons: 0, clickCount: 1 });
}
if (process.env.EVAL) console.log("eval:", JSON.stringify(await evalJs(process.env.EVAL)));
console.log("shots", POINTS.length, "| overflow:", await evalJs("document.documentElement.scrollWidth > innerWidth"), "| exceptions:", exceptions.length, exceptions.slice(0, 3), "| console:", logs.slice(0, 5));
ws.close(); chrome.kill(); process.exit(0);
