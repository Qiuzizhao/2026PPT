/* 真实浏览器（无头 Chrome + CDP）全量功能测试
   用法: node _qa.mjs <baseUrl> <outDir> [只跑包含该关键字的场景] */
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const CHROME = process.env.CHROME || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const baseUrl = process.argv[2];
const outDir = process.argv[3];
const filter = process.argv[4] || '';
mkdirSync(outDir, { recursive: true });

/* ---------- 页面内通用助手（每个场景都会注入） ---------- */
const HELPERS = `
  const __wait = ms => new Promise(r => setTimeout(r, ms));
  const __$ = s => document.querySelector(s);
  const __$$ = s => [...document.querySelectorAll(s)];
  const __hud = () => __$$('#hud .stat').map(x => x.textContent.trim());
  const __pd = (el, type, x, y) => el.dispatchEvent(new PointerEvent(type, {
    bubbles: true, cancelable: true, clientX: x, clientY: y, pointerId: 7,
    pointerType: 'mouse', isPrimary: true, button: 0, buttons: type === 'pointerup' ? 0 : 1 }));
  const __mouse = (el, type, extra) => el.dispatchEvent(new MouseEvent(type, Object.assign({
    bubbles: true, cancelable: true, clientX: 420, clientY: 320, button: type === 'contextmenu' ? 2 : 0 }, extra || {})));
  const __center = el => { const r = el.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; };
`;

const wrap = (body) => `(async () => { ${HELPERS}
  try { ${body} } catch (e) { return JSON.stringify({ error: String(e && e.stack || e) }); }
})()`;

const SCENARIOS = [];
const add = (s) => SCENARIOS.push(s);

/* ============ 1. 目录页 ============ */
add({
  name: 'index',
  page: 'index.html',
  steps: [
    { label: '链接全部可达', js: wrap(`
      const links = __$$('a.item').map(a => ({ text: a.querySelector('.t').textContent.trim(), href: a.getAttribute('href') }));
      const checks = [];
      for (const l of links) {
        const r = await fetch(l.href, { cache: 'no-store' }).then(x => x.status).catch(e => String(e));
        checks.push(l.href + ' => ' + r);
      }
      const leaders = __$$('a.item .lead').map(x => Math.round(x.getBoundingClientRect().width));
      return JSON.stringify({ count: links.length, checks, leaderWidths: leaders,
        overflow: document.documentElement.scrollWidth > window.innerWidth + 1 });
    `), shot: true }
  ]
});

/* ============ 2. 键盘练习营：三关全通 + 通关大奖 ============ */
add({
  name: '键盘练习营',
  page: '键盘练习营.html',
  steps: [
    { label: '字母/数字/全部 三关全通', js: wrap(`
      const counts = { a: 26, n: 10, m: 36 };
      const out = [];
      for (const mode of ['a', 'n', 'm']) {
        __$('#nav [data-mode="' + mode + '"]').click();
        await __wait(260);
        const startPrompt = __$('#prompt').textContent.trim();
        for (let i = 0; i < counts[mode]; i++) {
          const ch = __$('#target').textContent.trim();
          window.dispatchEvent(new KeyboardEvent('keydown', { key: ch, bubbles: true, cancelable: true }));
          await __wait(470);
          if (__$('#overlay').classList.contains('show')) { __$('#mOk').click(); await __wait(260); }
        }
        out.push({ mode, startPrompt, scount: __$('#scount').textContent.trim(), tot: __$('#totN').textContent.trim() });
        await __wait(600);
      }
      await __wait(1800);
      return JSON.stringify({
        out,
        finaleShown: __$('#finale').classList.contains('show'),
        finaleStars: __$('#finaleStarTxt').textContent.trim(),
        finaleChips: __$('#finaleChips').children.length,
        navDisabled: __$$('#nav button').every(b => b.disabled),
        bodyLocked: document.body.classList.contains('locked')
      });
    `), shot: true },
    { label: '通关后画面被锁住', js: wrap(`
      window.scrollTo(0, 400);
      await __wait(300);
      return JSON.stringify({ scrollY: window.scrollY, overflowHidden: document.documentElement.style.overflow === 'hidden' });
    `), shot: true }
  ]
});

/* ============ 3. 鼠标练习营：五个关卡全通 + 通关大奖 ============ */
add({
  name: '鼠标练习营',
  page: '鼠标练习营.html',
  steps: [
    { label: '左键/右键/双击/滚轮/选菜单 全通', js: wrap(`
      const out = [];
      const start = async (m) => { __$('#nav [data-mode="' + m + '"]').click(); await __wait(450); };
      const closeModal = async () => { if (__$('#overlay').classList.contains('show')) { __$('#mOk').click(); await __wait(320); } };

      await start('left');
      for (let i = 0; i < 10; i++) { const t = __$('#play .target'); if (!t) break; __mouse(t, 'click'); await __wait(430); await closeModal(); }
      out.push({ left: __$('#starNum').textContent.trim() });

      await start('right');
      for (let i = 0; i < 10; i++) { const t = __$('#play .target'); if (!t) break; __mouse(t, 'contextmenu'); await __wait(430); await closeModal(); }
      out.push({ right: __$('#starNum').textContent.trim() });

      await start('double');
      for (let i = 0; i < 10; i++) { const t = __$('#play .target'); if (!t) break; __mouse(t, 'dblclick'); await __wait(430); await closeModal(); }
      out.push({ double: __$('#starNum').textContent.trim() });

      await start('wheel');
      for (let round = 0; round < 10; round++) {
        let guard = 0;
        while (guard++ < 60) {
          const t = __$('#wnum'); if (!t) break;
          const parts = t.textContent.split('/');
          const cur = parseInt(parts[0], 10), goal = parseInt(parts[1], 10);
          if (!(goal > 0) || cur === goal) break;
          const z = __$('#play .wheel-zone');
          z.dispatchEvent(new WheelEvent('wheel', { bubbles: true, cancelable: true, deltaY: cur < goal ? -120 : 120 }));
          await __wait(45);
        }
        await __wait(650);
        await closeModal();
      }
      out.push({ wheel: __$('#starNum').textContent.trim() });

      await start('menu');
      for (let i = 0; i < 10; i++) {
        const z = __$('#play .menu-zone'); if (!z) break;
        __mouse(z, 'contextmenu');
        await __wait(260);
        const reqEl = __$('.menu-zone .req');
        const req = reqEl ? reqEl.textContent.trim() : '';
        const hit = __$$('#ctmenu .mi').find(x => x.textContent.includes(req));
        if (!hit) break;
        hit.click();
        await __wait(460);
        await closeModal();
      }
      out.push({ menu: __$('#starNum').textContent.trim() });
      await __wait(1800);
      return JSON.stringify({ out, totalStars: __$('#starNum').textContent.trim(),
        finaleShown: __$('#finale').classList.contains('show') });
    `), shot: true },
    { label: '通关页无尽点点乐：能加分、能升关、一直有得玩', js: wrap(`
      await __wait(2600);                                   /* 等无尽关启动 */
      const area = __$('#epArea');
      if (!area) return JSON.stringify({ error: '没有无尽关区域' });
      const startScore = Number(__$('#epScore').textContent);
      const t0 = Date.now();
      let swings = 0, ticksWithItem = 0;
      while (Date.now() - t0 < 17000 && Number(__$('#epScore').textContent) < 14) {
        const items = __$$('#epArea .ep-item');
        if (items.length) {
          ticksWithItem++;
          const it = items[0];
          const r = it.getBoundingClientRect();
          __pd(it, 'pointerdown', r.left + r.width / 2, r.top + r.height / 2);
          swings++;
        }
        await __wait(170);
      }
      const mid = { score: Number(__$('#epScore').textContent), level: __$('#epLevel').textContent,
                    combo: Number(__$('#epCombo').textContent) };
      await __wait(3500);                                   /* 再等一会，确认还在源源不断刷新 */
      const aliveLater = __$$('#epArea .ep-item').length;
      const t1 = Date.now();
      let hits2 = 0;
      while (Date.now() - t1 < 4000) {
        const it = __$('#epArea .ep-item');
        if (it) { const r = it.getBoundingClientRect();
          __pd(it, 'pointerdown', r.left + r.width / 2, r.top + r.height / 2); hits2++; }
        await __wait(150);
      }
      let stored = null;
      try { stored = localStorage.getItem('mouse_endless_best'); } catch (e) {}
      return JSON.stringify({
        startScore, swings, ticksWithItem, mid, hits2, aliveLater,
        stillSpawning: aliveLater > 0,
        score: Number(__$('#epScore').textContent),
        level: __$('#epLevel').textContent,
        bestShown: __$('#epBest').textContent,
        bestStored: stored,
        tipHidden: __$('#epTip').classList.contains('hide'),
        finaleStillOn: __$('#finale').classList.contains('show'),
        bandHeight: Math.round(area.getBoundingClientRect().height)
      });
    `), shot: true }
  ]
});

/* ============ 3b. 通关页直达（?finale=1 测试入口） ============ */
add({
  name: '鼠标练习营-通关页直达',
  page: '鼠标练习营.html?finale=1',
  steps: [
    { label: '?finale=1 直接进通关页并能玩无尽关', js: wrap(`
      await __wait(2500);
      const jumped = __$('#finale').classList.contains('show');
      const chips = __$('#finaleChips').children.length;
      const stars = __$('#finaleStarTxt').textContent.trim();
      const navDisabled = __$$('#nav button').every(b => b.disabled);
      const t0 = Date.now();
      let swings = 0;
      while (Date.now() - t0 < 9000 && Number(__$('#epScore').textContent) < 5) {
        const it = __$('#epArea .ep-item');
        if (it) { const r = it.getBoundingClientRect();
          __pd(it, 'pointerdown', r.left + r.width / 2, r.top + r.height / 2); swings++; }
        await __wait(160);
      }
      return JSON.stringify({ jumped, chips, stars, navDisabled, swings,
        score: Number(__$('#epScore').textContent), level: __$('#epLevel').textContent,
        best: __$('#epBest').textContent, finaleStillOn: __$('#finale').classList.contains('show') });
    `), shot: true }
  ]
});

/* ============ 4. 鼠标反应力实验室：八个关卡逐个进入并操作 ============ */
const openMode = (label) => `
  const mode = __$$('.mode').find(m => m.textContent.includes(${JSON.stringify(label)}));
  if (!mode) return JSON.stringify({ error: '找不到关卡 ' + ${JSON.stringify(label)} });
  mode.click();
`;
const exitGame = `
  if (__$('#overlay').classList.contains('show')) {
    const home = __$('#overlay [data-act="home"]'); if (home) home.click();
  } else if (__$('#backBtn')) { __$('#backBtn').click(); }
  await __wait(400);
`;
add({
  name: '反应力-闪电反应',
  page: '鼠标反应力实验室.html',
  steps: [
    { label: '玩到出结果（等变深再点）', js: wrap(`${openMode('闪电反应')}
      await __wait(400);
      const st = __$('#stage');
      const [cx, cy] = __center(st);
      __pd(st, 'pointerdown', cx, cy); __pd(st, 'pointerup', cx, cy);
      for (let i = 0; i < 12 && !__$('#overlay').classList.contains('show'); i++) {
        let waited = 0;
        while (waited < 6000 && !__$('#stage').classList.contains('rx-go')) { await __wait(80); waited += 80; }
        __pd(st, 'pointerdown', cx, cy); __pd(st, 'pointerup', cx, cy);
        await __wait(600);
      }
      const res = { hud: __hud(), overlay: __$('#overlay').classList.contains('show'),
        value: (__$('.s-value') || {}).textContent || '', totalStars: __$('.total').textContent.trim() };
      ${exitGame}
      return JSON.stringify(res);
    `), shot: true, shotBeforeExit: true }
  ]
});

add({
  name: '反应力-打地鼠',
  page: '鼠标反应力实验室.html',
  steps: [
    { label: '敲中地鼠', js: wrap(`${openMode('打地鼠')}
      await __wait(4300);
      let hits = 0;
      for (let i = 0; i < 45; i++) {
        const mole = __$('.hole.up .mole');
        if (mole) {
          const hole = mole.closest('.hole');   /* 事件要落在 .hole 上：页面用 closest('.hole') 判分 */
          const [x, y] = __center(mole);
          __pd(hole, 'pointerdown', x, y); __pd(hole, 'pointerup', x, y);
          hits++;
        }
        await __wait(170);
      }
      const res = { hits, hud: __hud(), moleBox: (() => { const m = __$('.hole.up .mole'); if (!m) return null; const r = m.getBoundingClientRect(); return { w: Math.round(r.width), h: Math.round(r.height) }; })() };
      ${exitGame}
      return JSON.stringify(res);
    `), shot: true, shotBeforeExit: true }
  ]
});

add({
  name: '反应力-靶心连击',
  page: '鼠标反应力实验室.html',
  steps: [
    { label: '打中靶心', js: wrap(`${openMode('靶心连击')}
      await __wait(3400);
      let shots = 0;
      for (let i = 0; i < 40; i++) {
        const t = __$('#stage .target');
        if (t) { const [x, y] = __center(t); __pd(t, 'pointerdown', x, y); __pd(t, 'pointerup', x, y); shots++; }
        await __wait(150);
      }
      const res = { shots, hud: __hud() };
      ${exitGame}
      return JSON.stringify(res);
    `), shot: true, shotBeforeExit: true }
  ]
});

add({
  name: '反应力-拖拽归位',
  page: '鼠标反应力实验室.html',
  steps: [
    { label: '把彩球拖进同色框', js: wrap(`${openMode('拖拽归位')}
      let dragged = 0, filled = 0;
      for (let round = 0; round < 4; round++) {
        let ball = null;
        for (let w = 0; w < 100 && !ball; w++) { ball = __$('#stage .ball:not(.placed)'); if (!ball) await __wait(120); }
        if (!ball) break;
        const color = ball.dataset.color;
        const bin = __$$('#stage .bin').find(b => b.dataset.color === color);
        if (!bin) break;
        const [bx, by] = __center(ball), [tx, ty] = __center(bin);
        __pd(ball, 'pointerdown', bx, by);
        for (let s = 1; s <= 6; s++) {
          __pd(ball, 'pointermove', bx + (tx - bx) * s / 6, by + (ty - by) * s / 6);
          await __wait(30);
        }
        __pd(ball, 'pointerup', tx, ty);
        dragged++;
        await __wait(420);
      }
      filled = __$$('#stage .bin.filled').length;
      const res = { dragged, filled, hud: __hud() };
      ${exitGame}
      return JSON.stringify(res);
    `), shot: true, shotBeforeExit: true }
  ]
});

add({
  name: '反应力-循迹追踪',
  page: '鼠标反应力实验室.html',
  steps: [
    { label: '跟着目标点移动', js: wrap(`${openMode('循迹追踪')}
      await __wait(3600);
      const st = __$('#stage');
      for (let i = 0; i < 60; i++) {
        const dot = __$('.tdot');
        if (dot) { const [x, y] = __center(dot); __pd(st, 'pointermove', x, y); }
        await __wait(80);
      }
      const res = { hud: __hud() };
      ${exitGame}
      return JSON.stringify(res);
    `), shot: true, shotBeforeExit: true }
  ]
});

add({
  name: '反应力-描线平稳',
  page: '鼠标反应力实验室.html',
  steps: [
    { label: '沿路径描线', js: wrap(`${openMode('描线平稳')}
      const st = __$('#stage');
      for (let round = 0; round < 3; round++) {
        let path = null;
        for (let w = 0; w < 80 && !path; w++) { path = __$('#stage svg .tr-center'); if (!path) await __wait(150); }
        if (!path) break;
        await __wait(2600);                                  /* 等这一轮开跑 */
        const box = st.getBoundingClientRect();
        const len = path.getTotalLength();
        const at = f => { const p = path.getPointAtLength(len * f); return [box.left + p.x, box.top + p.y]; };
        const start = at(0);
        __pd(st, 'pointerdown', start[0], start[1]);
        for (let s = 1; s <= 60; s++) {
          const pt = at(s / 60);
          __pd(st, 'pointermove', pt[0], pt[1]);
          await __wait(16);
        }
        const end = at(1);
        __pd(st, 'pointerup', end[0], end[1]);
        await __wait(1400);
      }
      const res = { hud: __hud(), round: (__$$('#hud .stat')[0] || {}).textContent };
      ${exitGame}
      return JSON.stringify(res);
    `), shot: true, shotBeforeExit: true }
  ]
});

add({
  name: '反应力-双击特训',
  page: '鼠标反应力实验室.html',
  steps: [
    { label: '双击击碎', js: wrap(`${openMode('双击特训')}
      await __wait(3600);
      let done = 0;
      for (let i = 0; i < 40; i++) {
        const t = __$('#stage .dtarget:not(.dead)');
        if (t) {
          const [x, y] = __center(t);
          __pd(t, 'pointerdown', x, y); __pd(t, 'pointerup', x, y);
          await __wait(120);
          const t2 = __$('#stage .dtarget:not(.dead)');
          if (t2) { const [x2, y2] = __center(t2); __pd(t2, 'pointerdown', x2, y2); __pd(t2, 'pointerup', x2, y2); done++; }
        }
        await __wait(180);
      }
      const res = { doubleClicks: done, hud: __hud() };
      ${exitGame}
      return JSON.stringify(res);
    `), shot: true, shotBeforeExit: true }
  ]
});

add({
  name: '反应力-连点狂潮',
  page: '鼠标反应力实验室.html',
  steps: [
    { label: '快速连点', js: wrap(`${openMode('连点狂潮')}
      await __wait(3600);
      const st = __$('#stage');
      const [x, y] = __center(st);
      for (let i = 0; i < 60; i++) { __pd(st, 'pointerdown', x, y); __pd(st, 'pointerup', x, y); await __wait(60); }
      const res = { hud: __hud() };
      ${exitGame}
      return JSON.stringify(res);
    `), shot: true, shotBeforeExit: true }
  ]
});

/* ============ 5. 鼠标 3D 探索馆 ============ */
add({
  name: '3D探索馆',
  page: '鼠标3D探索馆.html',
  wait: 20000,
  steps: [
    { label: '引擎就绪', js: wrap(`
      return JSON.stringify({ source: window.__threeSource || null, ready: window.__mouseReady === true,
        loaderHidden: __$('#loader').classList.contains('hide'), errShown: __$('#err').classList.contains('show'),
        canvasSize: (() => { const c = __$('#scene'); return { w: c.width, h: c.height }; })(),
        hotspots: __$$('#hotspots .hs').length,
        swatches: __$$('#swatches .swatch').length });
    `), shot: true },
    { label: '滚动切场景 + 热点联动', js: wrap(`
      const seen = [];
      const total = document.body.scrollHeight;
      for (const frac of [0.18, 0.42, 0.66, 0.9]) {
        window.scrollTo(0, Math.round(total * frac));
        await __wait(900);
        seen.push({
          frac,
          activeDot: (__$$('#dots button').findIndex(b => b.classList.contains('on'))),
          progress: Math.round(parseFloat(getComputedStyle(__$('#progress i')).width) || 0),
          visibleHotspots: __$$('#hotspots .hs').filter(h => h.style.opacity !== '0' && h.offsetParent !== null).length
        });
      }
      return JSON.stringify({ seen });
    `), shot: true },
    { label: '旋转模型', js: wrap(`
      const c = __$('#scene');
      const r = c.getBoundingClientRect();
      const cx = r.left + r.width * 0.62, cy = r.top + r.height * 0.5;
      __pd(c, 'pointerdown', cx, cy);
      for (let i = 1; i <= 12; i++) { __pd(c, 'pointermove', cx - i * 14, cy + i * 3); await __wait(20); }
      __pd(c, 'pointerup', cx - 168, cy + 36);
      await __wait(600);
      return JSON.stringify({ ok: true });
    `), shot: true },
    { label: '点击零件卡片 + 关闭', js: wrap(`
      const hs = __$$('#hotspots .hs').find(h => h.style.opacity !== '0' && h.offsetParent !== null) || __$$('#hotspots .hs')[0];
      let title = '';
      if (hs) {
        const [x, y] = __center(hs);
        hs.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, clientX: x, clientY: y }));
        await __wait(600);
        title = __$('#cardTitle').textContent.trim();
      }
      const shown = __$('#card').classList.contains('show') || getComputedStyle(__$('#card')).opacity !== '0';
      __$('#cardClose').click();
      await __wait(500);
      return JSON.stringify({ clicked: !!hs, title, cardShown: shown,
        closedOpacity: getComputedStyle(__$('#card')).opacity });
    `), shot: true },
    { label: '配色 / 连接 / 标注 / 拆解 / 重置', js: wrap(`
      const sw = __$$('#swatches .swatch');
      sw[2].click(); await __wait(500);
      const swOn = __$$('#swatches .swatch').findIndex(b => b.classList.contains('on'));

      const conn = __$$('#connSeg button');
      conn[1].click(); await __wait(700);
      const connOn = __$$('#connSeg button').findIndex(b => b.classList.contains('on'));
      const connText = __$('#connSeg button.on').textContent.trim();

      __$('#labelTgl').click(); await __wait(300);
      const labelAfter = __$('#labelTgl').textContent.trim();
      __$('#labelTgl').click(); await __wait(300);

      const range = __$('#explodeRange');
      range.value = 70; range.dispatchEvent(new Event('input', { bubbles: true }));
      await __wait(700);
      const explodeVal = __$('#explodeRange').value;

      __$('#resetBtn').click(); await __wait(700);
      return JSON.stringify({ swOn, connOn, connText, labelAfter, explodeVal, explodeAfterReset: __$('#explodeRange').value });
    `), shot: true },
    { label: '滚到最后一屏（页脚）', js: wrap(`
      window.scrollTo(0, document.body.scrollHeight);
      await __wait(900);
      return JSON.stringify({ scrollY: window.scrollY, activeDot: __$$('#dots button').findIndex(b => b.classList.contains('on')) });
    `), shot: true }
  ]
});

/* ============ 6. 数据自画像 · 学生端 ============ */
add({
  name: '数据自画像-学生端',
  page: '数据自画像-猜猜我是谁.html',
  blockUrls: ['*quickform.cn*'],
  steps: [
    { label: '填写 → 预览 → 提交（上传已拦截）', js: wrap(`
      const set = (id, v) => { const el = __$('#' + id); el.value = v; el.dispatchEvent(new Event('input', { bubbles: true })); };
      set('age', '10'); set('height', '140'); set('weight', '35');
      set('hobby', '爱画画、踢足球、看书'); set('diet', '爱吃苹果，不喜欢吃辣椒');
      set('extra', '性格开朗，擅长跳绳'); set('nick', '小画笔');
      await __wait(300);

      __$('#btnPreview').click(); await __wait(600);
      const previewShown = __$('#overlay').classList.contains('show');
      const previewText = __$('#previewBody').textContent.replace(/\\s+/g, ' ').trim().slice(0, 60);
      __$('#btnClose').click(); await __wait(400);
      const previewClosed = !__$('#overlay').classList.contains('show');

      __$('#btnSubmit').click(); await __wait(900);
      const sealed = __$('#modA').classList.contains('sealed');
      const successShown = __$('#successOverlay').classList.contains('show');
      const stored = JSON.parse(localStorage.getItem('data_self_portraits') || '[]').length;
      __$('#btnSuccessOk').click(); await __wait(300);
      return JSON.stringify({ previewShown, previewText, previewClosed, sealed, successShown, stored });
    `), shot: true },
    { label: '空表单提交被拦下', js: wrap(`
      localStorage.removeItem('data_self_portraits');
      __$('#modA').classList.remove('sealed');
      __$$('input, textarea').forEach(el => { el.value = ''; });
      __$('#btnSubmit').click(); await __wait(600);
      return JSON.stringify({ toast: __$('#toast').textContent.trim(), sealed: __$('#modA').classList.contains('sealed'),
        stored: JSON.parse(localStorage.getItem('data_self_portraits') || '[]').length });
    `), shot: true }
  ]
});

/* ============ 7. 数据自画像 · 教师端看板 ============ */
add({
  name: '数据自画像-教师端',
  page: '数据自画像-教师端看板.html',
  steps: [
    { label: '加载真实数据', js: wrap(`
      await __wait(2500);
      return JSON.stringify({ total: __$('#total').textContent.trim(), cards: __$$('#cards .card').length,
        msg: __$('#msg').textContent.trim().slice(0, 40), sub: __$('#taskSub').textContent.trim() });
    `), shot: true },
    { label: '打开一张卡片详情', js: wrap(`
      const card = __$('#cards .card');
      let opened = false, title = '';
      if (card) {
        card.click(); await __wait(500);
        opened = __$('#viewOverlay').classList.contains('show');
        title = __$('#viewTitle').textContent.trim();
        __$('#viewClose').click(); await __wait(300);
      }
      return JSON.stringify({ opened, title, closedNow: !__$('#viewOverlay').classList.contains('show') });
    `), shot: true },
    { label: '时间筛选 + 清除 + 自动更新开关', js: wrap(`
      const before = __$$('#cards .card').length;
      const t = __$('#timeFrom');
      t.value = '2030-01-01T00:00'; t.dispatchEvent(new Event('change', { bubbles: true }));
      await __wait(400);
      const filtered = __$$('#cards .card').length;
      __$('#btnClearFilter').click(); await __wait(400);
      const restored = __$$('#cards .card').length;
      const auto = __$('#auto');
      auto.checked = true; auto.dispatchEvent(new Event('change', { bubbles: true }));
      await __wait(300);
      auto.checked = false; auto.dispatchEvent(new Event('change', { bubbles: true }));
      return JSON.stringify({ before, filtered, restored, empty: __$$('#cards .empty').length });
    `), shot: true }
  ]
});

/* ============ 8. 多分辨率不溢出 ============ */
for (const [w, h] of [[1024, 768], [1920, 1080]]) {
  for (const page of ['index.html', '键盘练习营.html', '鼠标练习营.html', '鼠标反应力实验室.html', '数据自画像-猜猜我是谁.html', '数据自画像-教师端看板.html']) {
    add({
      name: `${w}x${h}-${page.replace('.html', '')}`,
      page,
      viewport: [w, h],
      steps: [
        { label: '无横向溢出', js: wrap(`
          await __wait(1200);
          return JSON.stringify({ overflowX: document.documentElement.scrollWidth > window.innerWidth + 1,
            scrollW: document.documentElement.scrollWidth, innerW: window.innerWidth });
        `), shot: true }
      ]
    });
  }
}

/* ================= CDP 驱动 ================= */
const userDir = join(tmpdir(), 'cdp-qa-' + Date.now());
const chrome = spawn(CHROME, [
  '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
  '--remote-debugging-port=9335', '--user-data-dir=' + userDir,
  '--window-size=1366,768', '--hide-scrollbars', '--force-device-scale-factor=1', 'about:blank'
], { stdio: 'ignore' });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function getJson(path) {
  for (let i = 0; i < 80; i++) {
    try { const r = await fetch('http://127.0.0.1:9335' + path); if (r.ok) return await r.json(); } catch (e) {}
    await sleep(250);
  }
  throw new Error('devtools not reachable');
}
const version = await getJson('/json/version');
const ws = new WebSocket(version.webSocketDebuggerUrl);
await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
let nextId = 1;
const pending = new Map();
let events = [];
ws.onmessage = (ev) => {
  const msg = JSON.parse(ev.data);
  if (msg.id && pending.has(msg.id)) {
    const { resolve } = pending.get(msg.id);
    pending.delete(msg.id);
    resolve(msg.result || { __error: msg.error });
  } else if (msg.method) events.push(msg);
};
function send(method, params, sessionId) {
  const id = nextId++;
  const payload = { id, method, params: params || {} };
  if (sessionId) payload.sessionId = sessionId;
  return new Promise((resolve) => { pending.set(id, { resolve }); ws.send(JSON.stringify(payload)); });
}
const evalIn = async (s, expression) => {
  const r = await s('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
  if (r && r.__error) return JSON.stringify({ error: r.__error.message });
  const res = r.result || {};
  if (res.exceptionDetails) return JSON.stringify({ error: res.exceptionDetails.text + ' ' + (res.exceptionDetails.exception || {}).description });
  return res.value;
};

const report = [];
for (const sc of SCENARIOS) {
  if (filter && !sc.name.includes(filter)) continue;
  events = [];
  const { targetId } = await send('Target.createTarget', { url: 'about:blank' });
  const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true });
  const s = (m, p) => send(m, p, sessionId);
  await s('Runtime.enable'); await s('Log.enable'); await s('Page.enable'); await s('Network.enable');
  if (sc.viewport) {
    await s('Emulation.setDeviceMetricsOverride', { width: sc.viewport[0], height: sc.viewport[1], deviceScaleFactor: 1, mobile: false });
  }
  if (sc.blockUrls) await s('Network.setBlockedURLs', { urls: sc.blockUrls });
  const url = baseUrl + encodeURIComponent(sc.page)
    .replace(/%3F/gi, '?').replace(/%3D/gi, '=').replace(/%26/gi, '&');
  await s('Page.navigate', { url });
  await sleep(sc.wait || (sc.page.includes('3D') ? 20000 : 2500) );

  const rec = { scenario: sc.name, steps: [], consoleErrors: [] };
  for (let i = 0; i < sc.steps.length; i++) {
    const st = sc.steps[i];
    events = [];
    const value = await evalIn(s, st.js);
    const errs = events.filter(e => e.method === 'Runtime.exceptionThrown')
      .map(e => (e.params.exceptionDetails.exception || {}).description || e.params.exceptionDetails.text);
    const logs = events.filter(e => e.method === 'Runtime.consoleAPICalled' && e.params.type === 'error')
      .map(e => e.params.args.map(a => a.value ?? a.description).join(' '));
    const step = { label: st.label, value, errors: errs.concat(logs) };
    rec.steps.push(step);
    if (errs.length || logs.length) rec.consoleErrors.push({ step: st.label, errors: errs.concat(logs) });
    if (st.shot) {
      const shot = await s('Page.captureScreenshot', { format: 'png' });
      if (shot && shot.data) {
        writeFileSync(join(outDir, `${sc.name}--${i}-${st.label.replace(/[^\w\u4e00-\u9fa5]/g, '_')}.png`), Buffer.from(shot.data, 'base64'));
      }
    }
  }
  report.push(rec);
  console.log(JSON.stringify(rec));
  try { await send('Target.closeTarget', { targetId }); } catch (e) {}
}
ws.close();
chrome.kill();
await sleep(400);
try { rmSync(userDir, { recursive: true, force: true }); } catch (e) {}
writeFileSync(join(outDir, 'report.json'), JSON.stringify(report, null, 2));
console.log('DONE ' + report.length + ' scenarios, consoleErrors=' + report.filter(r => r.consoleErrors.length).length);
