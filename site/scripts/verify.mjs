#!/usr/bin/env node
// Behaviour checks with real CDP input where it matters (tunnel pick = a real mouse click).
//   node scripts/verify.mjs [WxH] [mobile]
import { existsSync } from "node:fs";
import { spawn } from "node:child_process";
const VP = (process.argv[2] || "1280x720").split("x").map(Number);
const IS_MOBILE = process.argv.includes("mobile");
const URL_ = process.env.SITE_URL || "http://localhost:5174";
const CHROME = [process.env.CHROME, "C:/Program Files/Google/Chrome/Application/chrome.exe", "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe"].filter(Boolean).find((p) => existsSync(p));
const PORT = 9335;
const chrome = spawn(CHROME, ["--headless=new", `--remote-debugging-port=${PORT}`, "--no-first-run", "--user-data-dir=" + (process.env.TEMP || "/tmp") + "/verify-profile", "about:blank"], { stdio: "ignore" });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let ws, mid = 0; const pending = new Map(); const exceptions = [];
for (let i = 0; i < 30 && !ws; i++) { try { const r = await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, { method: "PUT" }); ws = new WebSocket((await r.json()).webSocketDebuggerUrl); } catch { await sleep(400); } }
await new Promise((r) => (ws.onopen = r));
ws.onmessage = (m) => { const d = JSON.parse(m.data); if (d.id && pending.has(d.id)) { pending.get(d.id)(d.result); pending.delete(d.id); } else if (d.method === "Runtime.exceptionThrown") exceptions.push(d.params?.exceptionDetails?.exception?.description || d.params?.exceptionDetails?.text); };
const send = (method, params = {}) => new Promise((res) => { const id = ++mid; pending.set(id, res); ws.send(JSON.stringify({ id, method, params })); });
const ev = async (expr) => (await send("Runtime.evaluate", { expression: expr, awaitPromise: true, returnByValue: true })).result?.value;
const results = [];
const check = (name, ok, info = "") => { results.push(`${ok ? "PASS" : "FAIL"}  ${name}${info ? "  — " + info : ""}`); };
await send("Page.enable"); await send("Runtime.enable");
await send("Emulation.setDeviceMetricsOverride", { width: VP[0], height: VP[1], deviceScaleFactor: IS_MOBILE ? 2 : 1, mobile: IS_MOBILE });
await send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-reduced-motion", value: process.env.REDUCED ? "reduce" : "no-preference" }] });
await send("Page.navigate", { url: URL_ });
await sleep(9000);

check("loader gone and scroll unlocked", await ev(`document.getElementById('loader').classList.contains('gone') && !document.body.classList.contains('loading')`));
check("WhatsApp links point at wa.me", await ev(`[...document.querySelectorAll('.wa-link')].every(a => a.href.startsWith('https://wa.me/390152470107'))`));
check("call links point at the studio's number", await ev(`(() => { const t = [...document.querySelectorAll('.tel-link')]; return t.length >= 3 && t.every((a) => a.href === 'tel:+390152470107'); })()`));
check("status chip filled", await ev(`document.querySelector('[data-status] span').textContent.length > 5`), await ev(`document.querySelector('[data-status] span').textContent`));

// tunnel pick: a real mouse click on a card centre (desktop); a tap on phones
if (!IS_MOBILE) {
  let opened = false;
  for (const [x, y] of [[1150, 360], [130, 300], [1120, 300], [180, 500], [1100, 480], [400, 200], [880, 200]]) {
    await send("Input.dispatchMouseEvent", { type: "mouseMoved", x, y });
    await sleep(400);
    await send("Input.dispatchMouseEvent", { type: "mousePressed", x, y, button: "left", clickCount: 1 });
    await send("Input.dispatchMouseEvent", { type: "mouseReleased", x, y, button: "left", clickCount: 1 });
    await sleep(300);
    if (await ev(`!document.getElementById('lightbox').hidden`)) { opened = true; break; }
  }
  const lbSrc = opened ? await ev(`document.getElementById('lb-img').src`) : ""; // a tattoo's lifted design, or one of his drawings (/works/zNN)
  check("flying tattoo click opens its design", opened && (lbSrc.includes('/ink/') || /\/works\/z\d\d\.webp/.test(lbSrc)), opened ? await ev(`document.getElementById('lb-cap').textContent`) : "");
  // the system pointer is hidden, so the machine cursor must stay visible over the open lightbox
  await send("Input.dispatchMouseEvent", { type: "mouseMoved", x: 640, y: 380 });
  await sleep(450);
  const curOk = await ev(`(() => { const c = document.querySelector('.cursor'), lb = document.getElementById('lightbox'), cs = getComputedStyle(c);
    return { on: c.classList.contains('on'), opacity: +cs.opacity, z: +cs.zIndex, lbZ: +getComputedStyle(lb).zIndex, lbOpen: !lb.hidden }; })()`);
  check("cursor stays visible over the lightbox", curOk.lbOpen && curOk.on && curOk.opacity > 0.9 && curOk.z > curOk.lbZ, JSON.stringify(curOk));
  await ev(`document.getElementById('lb-close').click()`);
  await sleep(300);
} else {
  // phones (round 8): a tap opens the design under it. Headless tap gestures never become clicks, so send the click a
  // real tap produces, at points around the badge
  let opened = false;
  for (const [x, y] of [[40, 130], [330, 160], [60, 640], [320, 680], [100, 200], [300, 600], [60, 400], [340, 420]]) {
    await send("Input.dispatchMouseEvent", { type: "mousePressed", x, y, button: "left", buttons: 1, clickCount: 1 });
    await send("Input.dispatchMouseEvent", { type: "mouseReleased", x, y, button: "left", buttons: 0, clickCount: 1 });
    await sleep(350);
    if (await ev(`!document.getElementById('lightbox').hidden`)) { opened = true; break; }
  }
  check("tapping a flying tattoo opens its design", opened, opened ? await ev(`document.getElementById('lb-cap').textContent`) : "");
  if (opened) { await ev(`document.getElementById('lb-close').click()`); await sleep(300); }
}

// the viper rail: hovering a section's scale shows its name, clicking it scrolls there (desktop)
if (!IS_MOBILE) {
  const r = await ev(`(() => { const b = [...document.querySelectorAll('.vrail-mark button')].find((x) => x.getAttribute('aria-label').endsWith('Stili')); const q = b.getBoundingClientRect(); return { x: q.left + q.width / 2, y: q.top + q.height / 2 }; })()`);
  await send("Input.dispatchMouseEvent", { type: "mouseMoved", x: r.x, y: r.y });
  await sleep(500);
  const label = await ev(`(() => { const b = [...document.querySelectorAll('.vrail-mark button')].find((x) => x.getAttribute('aria-label').endsWith('Stili')); return +getComputedStyle(b.querySelector('.vrail-label')).opacity; })()`);
  await send("Input.dispatchMouseEvent", { type: "mousePressed", x: r.x, y: r.y, button: "left", clickCount: 1 });
  await send("Input.dispatchMouseEvent", { type: "mouseReleased", x: r.x, y: r.y, button: "left", clickCount: 1 });
  await sleep(2600);
  const at = await ev(`Math.round(document.querySelector('#stili').getBoundingClientRect().top) + 0`); // + 0: -0 does not serialise
  check("viper rail: hover names a section, click goes there", label > 0.9 && Math.abs(at) < 40, `label ${label}, #stili top ${at}px`);
  await ev(`__lenis.scrollTo(0, { immediate: true, force: true })`);
  await sleep(600);
}

// the owner's AL3 mark (cut out, not the 150 px avatar) in the nav, and the favicon it feeds
check("AL3 logo and favicon load", await ev(`(async () => { const img = document.querySelector('.brand img'); await img.decode().catch(() => {});
  const icon = await fetch(document.querySelector('link[rel=icon]').href).then((r) => r.ok && r.headers.get('content-type') !== 'text/html');
  return img.src.endsWith('/brand/al3.webp') && img.naturalWidth >= 256 && icon; })()`));

// la postazione: sketches go live on the central screen; the push-in ends on the finished owl
await ev(`(() => { const s = document.querySelector('#postazione'); __lenis.scrollTo(s.offsetTop + 0.2 * (s.offsetHeight - innerHeight), { immediate: true, force: true }); })()`);
await sleep(1500);
const desk = await ev(`(async () => { const sc = document.getElementById('desk-screen'); const imgs = [...sc.querySelectorAll('img')];
  await Promise.all(imgs.map((i) => i.decode().catch(() => {})));
  await new Promise((r) => setTimeout(r, 200)); // the screen goes live just after its sheets decode
  return { live: sc.classList.contains('live'), imgs: imgs.length, ok: imgs.filter((i) => i.naturalWidth > 0).length, reduced: matchMedia('(prefers-reduced-motion: reduce)').matches }; })()`);
// phones (round 8 mobile pass) and reduced motion keep the photo's own owl sketch: no live screen
check(IS_MOBILE ? "desk screen stays the photo on phones" : "desk screen draws the sketches", desk.reduced || IS_MOBILE ? !desk.live : desk.live && desk.imgs === 11 && desk.ok === 11, JSON.stringify(desk));
await ev(`(() => { const s = document.querySelector('#postazione'); __lenis.scrollTo(s.offsetTop + 0.98 * (s.offsetHeight - innerHeight), { immediate: true, force: true }); })()`);
await sleep(1400);
const end = await ev(`(() => { const sk = [...document.querySelectorAll('#desk-screen .sk')]; const r = document.getElementById('desk-screen').getBoundingClientRect();
  return { owl: sk.length ? +getComputedStyle(sk[0]).opacity : 1, others: sk.slice(1).reduce((m, e) => Math.max(m, +getComputedStyle(e).opacity), 0),
    inView: r.top >= 0 && r.bottom <= innerHeight + 1 && r.left >= -1 && r.right <= innerWidth + 1 }; })()`);
check("push-in ends on the finished owl, fully in view", end.owl > 0.95 && end.others < 0.05 && end.inView, JSON.stringify(end));

// chapter CTA → archive, filtered
await ev(`(() => { const t = document.querySelector('#stili').getBoundingClientRect().top + scrollY; __lenis.scrollTo(t + 0.4 * innerHeight * 6, { immediate: true, force: true }); })()`);
await sleep(900);
const label = await ev(`(() => { const b = [...document.querySelectorAll('.ch-copy')].find(c => getComputedStyle(c).pointerEvents === 'auto')?.querySelector('button'); if (!b) return null; b.click(); return b.dataset.style; })()`);
await sleep(2600);
const pressed = await ev(`document.querySelector('#filters [aria-pressed=true]').dataset.key`);
const near = await ev(`Math.abs(document.querySelector('#archivio').getBoundingClientRect().top) < 40`);
check("chapter 'Vedi i lavori' filters the archive", label && pressed === label, `${label} → ${pressed}`);
check("…and lands on the archive", near, await ev(`Math.round(document.querySelector('#archivio').getBoundingClientRect().top) + 'px'`));
const counts = await ev(`({ shown: document.querySelectorAll('#grid li:not(.out)').length, total: +document.getElementById('archive-count').textContent, page: ${IS_MOBILE ? 24 : 30} })`);
check("filtered count and first page", counts.total > 0 && counts.shown === Math.min(counts.page, counts.total), JSON.stringify(counts));
await ev(`document.querySelector('#filters [data-key=tutti]').click()`);
await sleep(400);
const all = await ev(`({ total: +document.getElementById('archive-count').textContent, shown: document.querySelectorAll('#grid li:not(.out)').length })`);
check("archive holds 150+ works", all.total >= 150, JSON.stringify(all));
await ev(`document.querySelector('#filters [data-key=serpenti]').click()`);
await sleep(400);
const snakes = await ev(`({ total: +document.getElementById('archive-count').textContent, shown: document.querySelectorAll('#grid li:not(.out)').length })`);
check("Serpenti filter collects his snakes", snakes.total === 19 && snakes.shown === 19, JSON.stringify(snakes));
await ev(`document.querySelector('#filters [data-key=tutti]').click()`);
await sleep(400);
await ev(`document.getElementById('more-btn').click()`);
await sleep(500);
const after = await ev(`document.querySelectorAll('#grid li:not(.out)').length`);
check("'Mostra altri' reveals the next page", after === Math.min(all.shown * 2, all.total), `${all.shown} → ${after}`);
await ev(`[...document.querySelectorAll('#grid li:not(.out) .tile img')].find(im => im.src.includes('/works/w33_s')).closest('button').click()`);
await sleep(400);
const modeVisible = await ev(`!document.getElementById('lb-mode').hidden`);
await ev(`document.getElementById('lb-mode').click()`);
await sleep(400);
const inkSrc = await ev(`document.getElementById('lb-img').src`);
check("lightbox toggles to the lifted design", modeVisible && inkSrc.includes('/ink/'), inkSrc.split('/').slice(-2).join('/'));
await ev(`document.getElementById('lb-close').click()`);
await sleep(300);

// lightbox from a tile: next, Esc
await ev(`document.querySelector('#filters [data-key=tutti]').click()`);
await sleep(400);
await ev(`document.querySelector('#grid li:not(.out) .tile').click()`);
await sleep(300);
const c1 = await ev(`document.getElementById('lb-cap').textContent`);
await send("Input.dispatchKeyEvent", { type: "keyDown", key: "ArrowRight", code: "ArrowRight", windowsVirtualKeyCode: 39 });
await send("Input.dispatchKeyEvent", { type: "keyUp", key: "ArrowRight", code: "ArrowRight", windowsVirtualKeyCode: 39 });
await sleep(300);
const c2 = await ev(`document.getElementById('lb-cap').textContent`);
check("lightbox opens and → steps", c1 && c2 && c1 !== c2, `${c1} → ${c2}`);
await send("Input.dispatchKeyEvent", { type: "keyDown", key: "Escape", code: "Escape", windowsVirtualKeyCode: 27 });
await sleep(300);
check("Esc closes the lightbox", await ev(`document.getElementById('lightbox').hidden`));
const imgOk = await ev(`(async () => { const im = document.getElementById('lb-img'); return im.naturalWidth > 0; })()`);
check("lightbox image decoded", imgOk);
const broken = await ev(`[...document.images].filter(i => i.complete && i.naturalWidth === 0 && i.getAttribute('loading') !== 'lazy').map(i => i.src)`);
check("no broken eager images", broken.length === 0, broken.slice(0, 3).join(", "));
// the menu (round 10): below 1100 px it holds the sections; a link closes it and lands there, and the page scrolls again
if (VP[0] <= 1100) {
  await ev(`__lenis.scrollTo(0, { immediate: true, force: true })`);
  await sleep(300);
  const m = await ev(`(() => { document.getElementById('menu-open').click(); return { open: document.getElementById('menu').open, links: document.querySelectorAll('.menu-links li:not([hidden]) a').length }; })()`);
  await ev(`document.querySelector('.menu-links a[href="#archivio"]').click()`);
  await sleep(1200);
  const l = await ev(`({ closed: !document.getElementById('menu').open, top: Math.round(document.querySelector('#archivio').getBoundingClientRect().top) + 0, stopped: __lenis.isStopped })`);
  check("menu opens and lands on a section", m.open && m.links >= 6 && l.closed && Math.abs(l.top) < 40 && !l.stopped, JSON.stringify({ ...m, ...l }));
}
// footer (round 8): the Partita IVA and the privacy contact are the owner's; missing ones show a "da inserire" marker
const legal = await ev(`(() => { document.getElementById('privacy-open').click(); const d = document.getElementById('privacy');
  const r = { vat: document.getElementById('vat-line').textContent, todo: document.querySelectorAll('.todo').length, open: d.open,
    mail: !!d.querySelector('a[href^="mailto:"]'), host: /Vercel/.test(d.textContent) && !/Higgsfield|Cloudflare|__cf_bm/.test(d.textContent) }; d.close(); return r; })()`);
check("footer shows the Partita IVA, privacy notice opens with its contact and names the real host", /^P\.IVA \d{11}$/.test(legal.vat) && legal.todo === 0 && legal.open && legal.mail && legal.host, JSON.stringify(legal));
check("no exceptions", exceptions.length === 0, exceptions.slice(0, 3).join(" | "));
console.log(results.join("\n"));
ws.close(); chrome.kill(); process.exit(0);
