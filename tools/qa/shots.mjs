/* 视觉巡检：把每个游戏/分镜的真实运行画面截下来，人工核对视觉效果
   用法: node _qa_shots.mjs <baseUrl> <outDir> */
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const CHROME = process.env.CHROME || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const baseUrl = process.argv[2];
const outDir = process.argv[3];
const filter = process.argv[4] || '';
mkdirSync(outDir, { recursive: true });

const P = `
  const __wait = ms => new Promise(r => setTimeout(r, ms));
  const __$ = s => document.querySelector(s);
  const __$$ = s => [...document.querySelectorAll(s)];
  const __pd = (el, type, x, y) => el.dispatchEvent(new PointerEvent(type, {
    bubbles: true, cancelable: true, clientX: x, clientY: y, pointerId: 7,
    pointerType: 'mouse', isPrimary: true, button: 0, buttons: type === 'pointerup' ? 0 : 1 }));
  const __mouse = (el, type, extra) => el.dispatchEvent(new MouseEvent(type, Object.assign({
    bubbles: true, cancelable: true, clientX: 420, clientY: 320, button: type === 'contextmenu' ? 2 : 0 }, extra || {})));
  const __center = el => { const r = el.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; };
  const __openMode = label => { const m = __$$('.mode').find(x => x.textContent.includes(label)); if (m) m.click(); return !!m; };
`;
const j = (body) => `(async () => { ${P} try { ${body} } catch (e) { return String(e); } })()`;

const SHOTS = [
  { name: '键盘-数字关卡', page: '键盘练习营.html', js: j(`
      __$('#nav [data-mode="n"]').click(); await __wait(600); return 'ok';`) },
  { name: '鼠标-左键关卡', page: '鼠标练习营.html', js: j(`
      __$('#nav [data-mode="left"]').click(); await __wait(600); return 'ok';`) },
  { name: '鼠标-右键关卡', page: '鼠标练习营.html', js: j(`
      __$('#nav [data-mode="right"]').click(); await __wait(600); return 'ok';`) },
  { name: '鼠标-双击关卡', page: '鼠标练习营.html', js: j(`
      __$('#nav [data-mode="double"]').click(); await __wait(600); return 'ok';`) },
  { name: '鼠标-滚轮关卡半满', page: '鼠标练习营.html', js: j(`
      __$('#nav [data-mode="wheel"]').click(); await __wait(500);
      const z = __$('#play .wheel-zone');
      for (let i = 0; i < 5; i++) { z.dispatchEvent(new WheelEvent('wheel', { bubbles: true, cancelable: true, deltaY: -120 })); await __wait(60); }
      return 'ok';`) },
  { name: '鼠标-选菜单关卡', page: '鼠标练习营.html', js: j(`
      __$('#nav [data-mode="menu"]').click(); await __wait(500);
      const z = __$('#play .menu-zone');
      const [x, y] = __center(z);
      z.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: x, clientY: y }));
      await __wait(400); return 'ok';`) },
  { name: '鼠标-已完成关卡(冻结态)', page: '鼠标练习营.html', js: j(`
      __$('#nav [data-mode="left"]').click(); await __wait(400);
      for (let i = 0; i < 10; i++) { const t = __$('#play .target'); if (!t) break; __mouse(t, 'click'); await __wait(420);
        if (__$('#overlay').classList.contains('show')) { __$('#mOk').click(); await __wait(300); } }
      await __wait(400);
      __$('#nav [data-mode="left"]').click(); await __wait(500); return 'ok';`) },
  { name: '鼠标-通关页无尽关', page: '鼠标练习营.html', js: j(`
      const start = async m => { __$('#nav [data-mode="' + m + '"]').click(); await __wait(450); };
      const closeModal = async () => { if (__$('#overlay').classList.contains('show')) { __$('#mOk').click(); await __wait(320); } };
      await start('left');
      for (let i = 0; i < 10; i++) { const t = __$('#play .target'); if (!t) break; __mouse(t, 'click'); await __wait(420); await closeModal(); }
      await start('right');
      for (let i = 0; i < 10; i++) { const t = __$('#play .target'); if (!t) break; __mouse(t, 'contextmenu'); await __wait(420); await closeModal(); }
      await start('double');
      for (let i = 0; i < 10; i++) { const t = __$('#play .target'); if (!t) break; __mouse(t, 'dblclick'); await __wait(420); await closeModal(); }
      await start('wheel');
      for (let round = 0; round < 10; round++) {
        let guard = 0;
        while (guard++ < 60) { const t = __$('#wnum'); if (!t) break;
          const parts = t.textContent.split('/'); const cur = parseInt(parts[0], 10), goal = parseInt(parts[1], 10);
          if (!(goal > 0) || cur === goal) break;
          __$('#play .wheel-zone').dispatchEvent(new WheelEvent('wheel', { bubbles: true, cancelable: true, deltaY: cur < goal ? -120 : 120 }));
          await __wait(45); }
        await __wait(650); await closeModal();
      }
      await start('menu');
      for (let i = 0; i < 10; i++) {
        const z = __$('#play .menu-zone'); if (!z) break;
        __mouse(z, 'contextmenu'); await __wait(260);
        const reqEl = __$('.menu-zone .req'); const req = reqEl ? reqEl.textContent.trim() : '';
        const hit = __$$('#ctmenu .mi').find(x => x.textContent.includes(req)); if (!hit) break;
        hit.click(); await __wait(460); await closeModal();
      }
      await __wait(3000);                       /* 等无尽关启动，点两个让画面有分数 */
      for (let i = 0; i < 60 && Number(__$('#epScore').textContent) < 2; i++) {
        const it = __$('#epArea .ep-item');
        if (it) { const r = it.getBoundingClientRect(); __pd(it, 'pointerdown', r.left + r.width / 2, r.top + r.height / 2); }
        await __wait(160);
      }
      await __wait(1200); return 'ok';`) },
  { name: '鼠标-通关页无尽关-1080p', viewport: [1920, 1080], page: '鼠标练习营.html', js: j(`
      const start = async m => { __$('#nav [data-mode="' + m + '"]').click(); await __wait(450); };
      const closeModal = async () => { if (__$('#overlay').classList.contains('show')) { __$('#mOk').click(); await __wait(320); } };
      await start('left');
      for (let i = 0; i < 10; i++) { const t = __$('#play .target'); if (!t) break; __mouse(t, 'click'); await __wait(420); await closeModal(); }
      await start('right');
      for (let i = 0; i < 10; i++) { const t = __$('#play .target'); if (!t) break; __mouse(t, 'contextmenu'); await __wait(420); await closeModal(); }
      await start('double');
      for (let i = 0; i < 10; i++) { const t = __$('#play .target'); if (!t) break; __mouse(t, 'dblclick'); await __wait(420); await closeModal(); }
      await start('wheel');
      for (let round = 0; round < 10; round++) {
        let guard = 0;
        while (guard++ < 60) { const t = __$('#wnum'); if (!t) break;
          const parts = t.textContent.split('/'); const cur = parseInt(parts[0], 10), goal = parseInt(parts[1], 10);
          if (!(goal > 0) || cur === goal) break;
          __$('#play .wheel-zone').dispatchEvent(new WheelEvent('wheel', { bubbles: true, cancelable: true, deltaY: cur < goal ? -120 : 120 }));
          await __wait(45); }
        await __wait(650); await closeModal();
      }
      await start('menu');
      for (let i = 0; i < 10; i++) {
        const z = __$('#play .menu-zone'); if (!z) break;
        __mouse(z, 'contextmenu'); await __wait(260);
        const reqEl = __$('.menu-zone .req'); const req = reqEl ? reqEl.textContent.trim() : '';
        const hit = __$$('#ctmenu .mi').find(x => x.textContent.includes(req)); if (!hit) break;
        hit.click(); await __wait(460); await closeModal();
      }
      await __wait(4200);
      for (let i = 0; i < 40 && Number(__$('#epScore').textContent) < 3; i++) {
        const it = __$('#epArea .ep-item');
        if (it) { const r = it.getBoundingClientRect(); __pd(it, 'pointerdown', r.left + r.width / 2, r.top + r.height / 2); }
        await __wait(170);
      }
      await __wait(1400); return 'ok';`) },

  { name: '反应力-闪电反应(准备)', page: '鼠标反应力实验室.html', js: j(`
      __openMode('闪电反应'); await __wait(500);
      const st = __$('#stage'); const [x, y] = __center(st);
      __pd(st, 'pointerdown', x, y); __pd(st, 'pointerup', x, y);
      for (let i = 0; i < 60 && !__$('#stage').classList.contains('rx-ready'); i++) await __wait(50);
      return 'ok';`) },
  { name: '反应力-打地鼠', page: '鼠标反应力实验室.html', js: j(`
      __openMode('打地鼠'); await __wait(4300);
      for (let i = 0; i < 60 && !__$('.hole.up'); i++) await __wait(60);
      return 'ok';`) },
  { name: '反应力-靶心连击', page: '鼠标反应力实验室.html', js: j(`
      __openMode('靶心连击'); await __wait(3600);
      for (let i = 0; i < 60 && !__$('#stage .target'); i++) await __wait(60);
      return 'ok';`) },
  { name: '反应力-拖拽归位', page: '鼠标反应力实验室.html', js: j(`
      __openMode('拖拽归位'); await __wait(2600);
      for (let i = 0; i < 80 && !__$('#stage .ball'); i++) await __wait(80);
      const ball = __$('#stage .ball'); const bin = __$$('#stage .bin').find(b => b.dataset.color === (ball || {}).dataset?.color);
      if (ball && bin) { const [bx, by] = __center(ball), [tx, ty] = __center(bin);
        __pd(ball, 'pointerdown', bx, by);
        for (let s = 1; s <= 5; s++) { __pd(ball, 'pointermove', bx + (tx - bx) * s / 5, by + (ty - by) * s / 5); await __wait(40); }
        __pd(ball, 'pointerup', tx, ty); await __wait(500); }
      return 'ok';`) },
  { name: '反应力-循迹追踪', page: '鼠标反应力实验室.html', js: j(`
      __openMode('循迹追踪'); await __wait(4200); return 'ok';`) },
  { name: '反应力-描线平稳', page: '鼠标反应力实验室.html', js: j(`
      __openMode('描线平稳');
      for (let w = 0; w < 80 && !__$('#stage svg .tr-center'); w++) await __wait(120);
      await __wait(2600);
      const st = __$('#stage'), path = __$('#stage svg .tr-center');
      if (path) { const box = st.getBoundingClientRect(), len = path.getTotalLength();
        const at = f => { const p = path.getPointAtLength(len * f); return [box.left + p.x, box.top + p.y]; };
        const s0 = at(0); __pd(st, 'pointerdown', s0[0], s0[1]);
        for (let k = 1; k <= 26; k++) { const q = at(k / 60); __pd(st, 'pointermove', q[0], q[1]); await __wait(16); } }
      return 'ok';`) },
  { name: '反应力-双击特训', page: '鼠标反应力实验室.html', js: j(`
      __openMode('双击特训'); await __wait(3600);
      for (let i = 0; i < 60 && !__$('#stage .dtarget'); i++) await __wait(60);
      return 'ok';`) },
  { name: '反应力-连点狂潮', page: '鼠标反应力实验室.html', js: j(`
      __openMode('连点狂潮'); await __wait(3600);
      const st = __$('#stage'); const [x, y] = __center(st);
      for (let i = 0; i < 14; i++) { __pd(st, 'pointerdown', x + (i % 5) * 20, y + (i % 3) * 16); await __wait(70); }
      return 'ok';`) },
  { name: '反应力-结果弹层', page: '鼠标反应力实验室.html', js: j(`
      __openMode('闪电反应'); await __wait(500);
      const st = __$('#stage'); const [cx, cy] = __center(st);
      __pd(st, 'pointerdown', cx, cy); __pd(st, 'pointerup', cx, cy);
      for (let i = 0; i < 12 && !__$('#overlay').classList.contains('show'); i++) {
        let waited = 0;
        while (waited < 6000 && !__$('#stage').classList.contains('rx-go')) { await __wait(80); waited += 80; }
        __pd(st, 'pointerdown', cx, cy); __pd(st, 'pointerup', cx, cy);
        await __wait(600);
      }
      return 'ok';`) },

  /* 反应力实验室的通关闭幕：预览入口 ?finale=1（不写存档），截图时点几个掉落物让计分牌有分 */
  { name: '反应力-通关闭幕', page: '鼠标反应力实验室.html?finale=1', js: j(`
      await __wait(2600);
      for (let i = 0; i < 40 && Number(__$('#epScore').textContent) < 8; i++) {
        const it = __$('#epArea .ep-item');
        if (it) { const r = it.getBoundingClientRect(); __pd(it, 'pointerdown', r.left + r.width / 2, r.top + r.height / 2); }
        await __wait(150);
      }
      await __wait(700); return 'ok';`) },
  { name: '反应力-通关闭幕-1080p', viewport: [1920, 1080], page: '鼠标反应力实验室.html?finale=1', js: j(`
      await __wait(2600);
      for (let i = 0; i < 40 && Number(__$('#epScore').textContent) < 8; i++) {
        const it = __$('#epArea .ep-item');
        if (it) { const r = it.getBoundingClientRect(); __pd(it, 'pointerdown', r.left + r.width / 2, r.top + r.height / 2); }
        await __wait(150);
      }
      await __wait(700); return 'ok';`) },
  /* 结算卡：先把七关记成三星，再真打完第八关（连点狂潮），截「进入通关庆典」那张卡 */
  { name: '反应力-通关结算卡(前置存档)', page: 'index.html', js: j(`
      const rows = {};
      ['reaction','whack','aim','drag','track','trace','dbl'].forEach(id => { rows[id] = { best:null, stars:3, plays:1 }; });
      localStorage.setItem('mouseReactionLab.v1', JSON.stringify(rows)); return 'ok';`) },
  { name: '反应力-通关结算卡', page: '鼠标反应力实验室.html', js: j(`
      __openMode('连点狂潮');
      const st = __$('#stage'); const [cx, cy] = __center(st);
      const t0 = Date.now();
      while (Date.now() - t0 < 60000 && !__$('#overlay').classList.contains('show')) {
        __pd(st, 'pointerdown', cx, cy); __pd(st, 'pointerup', cx, cy);
        await __wait(60);
      }
      await __wait(700); return 'ok';`) },
  { name: '反应力-首页庆典入口', page: '鼠标反应力实验室.html', js: j(`
      await __wait(600); return 'ok';`) },

  { name: '3D-第一屏', page: '鼠标3D探索馆.html', wait: 20000, js: j(`return 'ok';`) },
  { name: '3D-拆解70%', page: '鼠标3D探索馆.html', wait: 20000, js: j(`
      const r = __$('#explodeRange'); r.value = 70; r.dispatchEvent(new Event('input', { bubbles: true }));
      await __wait(1200); return 'ok';`) },
  { name: '3D-零件卡片', page: '鼠标3D探索馆.html', wait: 20000, js: j(`
      const hs = __$$('#hotspots .hs').find(h => h.offsetParent !== null) || __$$('#hotspots .hs')[0];
      if (hs) { const [x, y] = __center(hs); hs.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, clientX: x, clientY: y })); await __wait(700); }
      return 'ok';`) },
  { name: '3D-第四屏(发展史)', page: '鼠标3D探索馆.html', wait: 20000, js: j(`
      window.scrollTo(0, Math.round(document.body.scrollHeight * 0.72)); await __wait(1200); return 'ok';`) },
  { name: '3D-无线模式', page: '鼠标3D探索馆.html', wait: 20000, js: j(`
      __$$('#connSeg button')[1].click(); await __wait(1500); return 'ok';`) },

  { name: '自画像-填写后', page: '数据自画像-猜猜我是谁.html', js: j(`
      const set = (id, v) => { const el = __$('#' + id); el.value = v; el.dispatchEvent(new Event('input', { bubbles: true })); };
      set('age','10'); set('height','140'); set('weight','35');
      set('hobby','爱画画、踢足球、看书'); set('diet','爱吃苹果，不喜欢吃辣椒');
      set('extra','性格开朗，擅长跳绳'); set('nick','小画笔');
      await __wait(400); return 'ok';`) },
  { name: '自画像-预览弹窗', page: '数据自画像-猜猜我是谁.html', js: j(`
      const set = (id, v) => { const el = __$('#' + id); el.value = v; el.dispatchEvent(new Event('input', { bubbles: true })); };
      set('age','10'); set('height','140'); set('weight','35');
      set('hobby','爱画画、踢足球、看书'); set('diet','爱吃苹果，不喜欢吃辣椒');
      set('extra','性格开朗，擅长跳绳'); set('nick','小画笔');
      __$('#btnPreview').click(); await __wait(600); return 'ok';`) },
  { name: '自画像-封存态', page: '数据自画像-猜猜我是谁.html', block: ['*quickform.cn*'], js: j(`
      const set = (id, v) => { const el = __$('#' + id); el.value = v; el.dispatchEvent(new Event('input', { bubbles: true })); };
      set('age','10'); set('height','140'); set('weight','35');
      set('hobby','爱画画、踢足球、看书'); set('diet','爱吃苹果，不喜欢吃辣椒');
      set('extra','性格开朗，擅长跳绳'); set('nick','小画笔');
      __$('#btnSubmit').click(); await __wait(900);
      __$('#btnSuccessOk').click(); await __wait(500); return 'ok';`) },
  { name: '看板-详情弹窗', page: '数据自画像-教师端看板.html', wait: 4000, js: j(`
      const card = __$('#cards .card'); if (card) card.click(); await __wait(600); return 'ok';`) }
];

const userDir = join(tmpdir(), 'cdp-shots-' + Date.now());
const chrome = spawn(CHROME, [
  '--headless=new', '--disable-gpu', '--no-first-run', '--remote-debugging-port=9336',
  '--user-data-dir=' + userDir, '--window-size=1366,768', '--hide-scrollbars', '--force-device-scale-factor=1', 'about:blank'
], { stdio: 'ignore' });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function getJson(p) {
  for (let i = 0; i < 80; i++) { try { const r = await fetch('http://127.0.0.1:9336' + p); if (r.ok) return await r.json(); } catch (e) {} await sleep(250); }
  throw new Error('devtools not reachable');
}
const version = await getJson('/json/version');
const ws = new WebSocket(version.webSocketDebuggerUrl);
await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
let nextId = 1; const pending = new Map(); let events = [];
ws.onmessage = (ev) => {
  const msg = JSON.parse(ev.data);
  if (msg.id && pending.has(msg.id)) { const { resolve } = pending.get(msg.id); pending.delete(msg.id); resolve(msg.result || { __error: msg.error }); }
  else if (msg.method) events.push(msg);
};
const send = (method, params, sessionId) => {
  const id = nextId++; const payload = { id, method, params: params || {} };
  if (sessionId) payload.sessionId = sessionId;
  return new Promise((resolve) => { pending.set(id, { resolve }); ws.send(JSON.stringify(payload)); });
};
for (const sh of SHOTS) {
  if (filter && !sh.name.includes(filter)) continue;
  events = [];
  const { targetId } = await send('Target.createTarget', { url: 'about:blank' });
  const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true });
  const s = (m, p) => send(m, p, sessionId);
  await s('Runtime.enable'); await s('Page.enable'); await s('Network.enable');
  if (sh.viewport) {
    await s('Emulation.setDeviceMetricsOverride', { width: sh.viewport[0], height: sh.viewport[1], deviceScaleFactor: 1, mobile: false });
  }
  if (sh.block) await s('Network.setBlockedURLs', { urls: sh.block });
  const shotUrl = baseUrl + encodeURIComponent(sh.page)
    .replace(/%3F/gi, '?').replace(/%3D/gi, '=').replace(/%26/gi, '&');
  await s('Page.navigate', { url: shotUrl });
  await sleep(sh.wait || 2500);
  await s('Runtime.evaluate', { expression: sh.js, awaitPromise: true, returnByValue: true });
  await sleep(350);
  const shot = await s('Page.captureScreenshot', { format: 'png' });
  if (shot && shot.data) writeFileSync(join(outDir, sh.name + '.png'), Buffer.from(shot.data, 'base64'));
  const errs = events.filter(e => e.method === 'Runtime.exceptionThrown')
    .map(e => (e.params.exceptionDetails.exception || {}).description || e.params.exceptionDetails.text);
  console.log(JSON.stringify({ shot: sh.name, errors: errs }));
  await send('Target.closeTarget', { targetId });
}
ws.close(); chrome.kill(); await sleep(400);
try { rmSync(userDir, { recursive: true, force: true }); } catch (e) {}
console.log('SHOTS DONE');
