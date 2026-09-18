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
      /* 升关机制是内部的（不显示第几关），所以用"掉落速度变快"来验证它确实在生效 */
      const speedOf = async () => {
        const it = __$('#epArea .ep-item');
        if (!it) return null;
        /* 不用正则：模板字符串里的反斜杠会被吃掉，直接按逗号拆 "translate3d(xpx, ypx, 0)" */
        const readY = () => {
          const parts = (it.style.transform || '').split(',');
          if (parts.length < 2) return null;
          const v = parseFloat(parts[1]);
          return isNaN(v) ? null : v;
        };
        const y0 = readY(), ts = Date.now();
        await __wait(320);
        const y1 = readY();
        if (y0 === null || y1 === null || y1 <= y0) return null;
        return Math.round((y1 - y0) / ((Date.now() - ts) / 1000));
      };
      const sampleSpeed = async (n) => {
        const out = [];
        for (let i = 0; i < n * 5 && out.length < n; i++) { const v = await speedOf(); if (v) out.push(v); await __wait(160); }
        return out;
      };
      const mean = a => a.length ? Math.round(a.reduce((x, y) => x + y, 0) / a.length) : null;
      const earlySpeeds = await sampleSpeed(4);
      const t0 = Date.now();
      let swings = 0, ticksWithItem = 0;
      while (Date.now() - t0 < 26000 && Number(__$('#epScore').textContent) < 26) {
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
      const mid = { score: Number(__$('#epScore').textContent),
                    level: __$('#epLevel') ? __$('#epLevel').textContent : null };
      const lateSpeeds = await sampleSpeed(4);
      await __wait(2500);                                   /* 再等一会，确认还在源源不断刷新 */
      const aliveLater = __$$('#epArea .ep-item').length;
      const t1 = Date.now();
      let hits2 = 0;
      while (Date.now() - t1 < 4000) {
        const it = __$('#epArea .ep-item');
        if (it) { const r = it.getBoundingClientRect();
          __pd(it, 'pointerdown', r.left + r.width / 2, r.top + r.height / 2); hits2++; }
        await __wait(150);
      }
      return JSON.stringify({
        startScore, swings, ticksWithItem, mid, hits2, aliveLater,
        earlySpeed: mean(earlySpeeds), lateSpeed: mean(lateSpeeds),
        speedUpAfterLevels: (mean(lateSpeeds) || 0) > (mean(earlySpeeds) || 0),
        stillSpawning: aliveLater > 0,
        score: Number(__$('#epScore').textContent),
        chips: __$$('.ep-head .ep-k').length,
        comboGone: !__$('#epCombo'),
        levelShown: !!__$('#epLevel'),
        levelNow: __$('#epLevel') ? Number(__$('#epLevel').textContent) : null,
        levelUpWorks: mid.level !== null && Number(mid.level) >= 2,
        bestGone: !__$('#epBest'),
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
      const chipsGone = !__$('#finaleChips') && !__$('.finale-chips');
      const bandShare = +( __$('#epArea').getBoundingClientRect().height / window.innerHeight ).toFixed(2);
      const bandWidth = Math.round(__$('#epArea').getBoundingClientRect().width);
      const cardTop = __$('.finale-card').getBoundingClientRect().bottom;
      const bandTop = __$('#epArea').getBoundingClientRect().top;
      const navDisabled = __$$('#nav button').every(b => b.disabled);
      const t0 = Date.now();
      let swings = 0;
      while (Date.now() - t0 < 9000 && Number(__$('#epScore').textContent) < 5) {
        const it = __$('#epArea .ep-item');
        if (it) { const r = it.getBoundingClientRect();
          __pd(it, 'pointerdown', r.left + r.width / 2, r.top + r.height / 2); swings++; }
        await __wait(160);
      }
      return JSON.stringify({ jumped, chipsGone, bandShare, bandWidth,
        bandWidthCapped: bandWidth <= 1002, innerW: window.innerWidth,
        gapBetween: Math.round(bandTop - cardTop), navDisabled, swings,
        score: Number(__$('#epScore').textContent),
        level: __$('#epLevel') ? Number(__$('#epLevel').textContent) : null,
        chips: __$$('.ep-head .ep-k').length,
        bestGone: !__$('#epBest'), comboGone: !__$('#epCombo'),
        finaleStillOn: __$('#finale').classList.contains('show') });
    `), shot: true }
  ]
});

/* 宽屏下游戏区必须仍然封顶，否则物件撒得太开没法点 */
add({
  name: '鼠标练习营-通关页直达-宽屏',
  page: '鼠标练习营.html?finale=1',
  viewport: [2560, 1080],
  steps: [
    { label: '2560 宽屏下游戏区宽度仍封顶', js: wrap(`
      await __wait(2500);
      const band = __$('#epArea').getBoundingClientRect();
      const head = __$('.ep-head').getBoundingClientRect();
      return JSON.stringify({ innerW: window.innerWidth,
        bandWidth: Math.round(band.width), headWidth: Math.round(head.width),
        bandHeight: Math.round(band.height),
        capped: band.width <= 1002, centered: Math.abs((band.left + band.right) / 2 - window.innerWidth / 2) < 3,
        jumped: __$('#finale').classList.contains('show') });
    `), shot: true }
  ]
});

/* ============ 3c. 鼠标练习营2：通关页 + 无尽点点乐（同一套玩法，卡片更高） ============ */
add({
  name: '鼠标练习营2-通关页无尽关',
  page: '鼠标练习营2.html?finale=1',
  wait: 6000,
  steps: [
    { label: '通关页出现、只有得分/第几关两块牌子、预览入口不写进度', js: wrap(`
      await __wait(1500);
      const card = __$('.finale-card').getBoundingClientRect();
      const head = __$('.ep-head').getBoundingClientRect();
      const area = __$('#epArea').getBoundingClientRect();
      return JSON.stringify({
        jumped: __$('#finale').classList.contains('show'),
        hud: __$$('.ep-head .ep-k').map(e => e.textContent.trim()),
        chips: __$$('.ep-head .ep-k').length,
        comboGone: !__$('#epCombo'), bestGone: !__$('#epBest'),
        starLineGone: !__$('#finaleStarTxt') && !__$('.finale-stars'),
        exitGone: !__$('#finaleOk') && !__$('.finale-actions'),
        skillChipsGone: !__$('#finaleChips') && !__$('.finale-chips'),
        items: __$$('#epArea .ep-item').length,
        bandWidth: Math.round(area.width), bandWidthCapped: area.width <= 1002,
        bandHeight: Math.round(area.height),
        noOverlap: head.top >= card.bottom - 1,
        gap: Math.round(head.top - card.bottom),
        previewSavedNothing: !localStorage.getItem('mousecamp2.progress.v1')
      });
    `), shot: true },
    { label: '点掉落物能加分、每 10 分升一关、一直有得玩', js: wrap(`
      const t0 = Date.now();
      let taps = 0;
      while (Date.now() - t0 < 22000 && Number(__$('#epScore').textContent) < 12) {
        const it = __$('#epArea .ep-item');
        if (it) { const r = it.getBoundingClientRect();
          __pd(it, 'pointerdown', r.left + r.width / 2, r.top + r.height / 2); taps++; }
        await __wait(160);
      }
      await __wait(2500);                     /* 再等一会，确认物件还在源源不断刷新 */
      return JSON.stringify({
        taps, score: Number(__$('#epScore').textContent),
        level: Number(__$('#epLevel').textContent), levelUpWorks: Number(__$('#epLevel').textContent) >= 2,
        tipHidden: __$('#epTip').classList.contains('hide'),
        stillSpawning: __$$('#epArea .ep-item').length > 0,
        finaleStillOn: __$('#finale').classList.contains('show')
      });
    `), shot: true },
    { label: '通关页锁死：没有出口按钮、页面留在原地、游戏一直有得玩', js: wrap(`
      const path0 = location.pathname + location.search;
      const itemsBefore = __$$('#epArea .ep-item').length;
      /* 点一下页面正中（奖杯卡附近），不该发生任何跳转/关闭 */
      const box = __$('#finale').getBoundingClientRect();
      __pd(__$('#finale'), 'pointerdown', box.left + box.width / 2, box.top + 60);
      await __wait(2200);
      const covered = __$('#finale').contains(document.elementFromPoint(12, 12));
      return JSON.stringify({
        stayed: location.pathname + location.search === path0,
        stillShown: __$('#finale').classList.contains('show'),
        overlayCoversNav: covered,
        itemsBefore, itemsAfter: __$$('#epArea .ep-item').length,
        stillSpawning: __$$('#epArea .ep-item').length > 0
      });
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

/* 真的打完最后一关：先在同一个浏览器 profile 里把七关记成三星（场景共用一个
   user-data-dir，localStorage 会带到下一个场景），再实打实打完第八关。 */
add({
  name: '反应力-最后一关前置存档',
  page: 'index.html',
  steps: [
    { label: '把七关记成三星（21 / 24）', js: wrap(`
      const rows = {};
      ['reaction','whack','aim','drag','track','trace','dbl'].forEach(id => { rows[id] = { best:null, stars:3, plays:1 }; });
      localStorage.setItem('mouseReactionLab.v1', JSON.stringify(rows));
      return JSON.stringify({ seeded: Object.keys(rows).length,
        raw: localStorage.getItem('mouseReactionLab.v1').length });
    `) }
  ]
});

add({
  name: '反应力-最后一关进庆典',
  page: '鼠标反应力实验室.html',
  steps: [
    { label: '打完第八关（连点狂潮）直接进通关闭幕并能继续玩', js: wrap(`${openMode('连点狂潮')}
      const seeded = __$('.total').textContent.trim();
      const st = __$('#stage');
      const [cx, cy] = __center(st);
      await __wait(300);
      /* 进关卡后首页金色横幅必须收起来，否则会从游戏视图底下透出来 */
      const barHiddenWhilePlaying = __$('#celebrateBar').classList.contains('hidden');
      const t0 = Date.now();
      let sawSheet = false, finaleBtn = false, homeBtn = false, retryBtn = false, sheetAt = null, clicks = 0;
      let btnFits = null;
      while (Date.now() - t0 < 60000 && !__$('#finale').classList.contains('show')) {
        if (__$('#overlay').classList.contains('show')) {
          if (!sawSheet) { sawSheet = true; sheetAt = Date.now() - t0; }
          finaleBtn = finaleBtn || !!__$('#overlay [data-act="finale"]');
          homeBtn = homeBtn || !!__$('#overlay [data-act="home"]');
          retryBtn = retryBtn || !!__$('#overlay [data-act="retry"]');
          const b = __$('#overlay [data-act="finale"]');
          if (b && btnFits === null) {
            const br = b.getBoundingClientRect(), orr = __$('#overlay').getBoundingClientRect();
            const sh = __$('#overlay .sheet').getBoundingClientRect();
            btnFits = { btnBottom: Math.round(br.bottom), boxBottom: Math.round(orr.bottom),
                        sheetH: Math.round(sh.height),
                        scrolls: __$('#overlay .sheet').scrollHeight > __$('#overlay .sheet').clientHeight + 1,
                        fullyVisible: br.bottom <= orr.bottom + 1 && br.top >= orr.top - 1 };
          }
          if (b) b.click();
          await __wait(150);
        } else {
          __pd(st, 'pointerdown', cx, cy); __pd(st, 'pointerup', cx, cy); clicks++;
          await __wait(60);
        }
      }
      const before = { stars: __$('.total').textContent.trim(), clicks, sawSheet, sheetAt,
        finaleBtn, btnFits, barHiddenWhilePlaying, homeBtnGone: !homeBtn, retryBtnGone: !retryBtn,
        timedOut: !__$('#finale').classList.contains('show') };
      await __wait(2600);
      const after = { finaleOn: __$('#finale').classList.contains('show'),
        card: !!__$('.finale-card'),
        title: (__$('.finale-title') || {}).textContent || '',
        endless: !!__$('#epArea'),
        locked: document.body.classList.contains('locked'),
        savedStars: (JSON.parse(localStorage.getItem('mouseReactionLab.v1') || '{}').frenzy || {}).stars };
      const t1 = Date.now();
      let hits = 0;
      while (Date.now() - t1 < 10000 && Number(__$('#epScore').textContent) < 3) {
        const it = __$('#epArea .ep-item');
        if (it) { const r = it.getBoundingClientRect();
          __pd(it, 'pointerdown', r.left + r.width / 2, r.top + r.height / 2); hits++; }
        await __wait(160);
      }
      return JSON.stringify({ seeded, before, after, hits, score: __$('#epScore').textContent,
        bandHeight: Math.round(__$('#epArea').getBoundingClientRect().height) });
    `), shot: true }
  ]
});

/* 已经八关全满的存档：重玩某一关应该给普通结算卡，不把人硬拉进庆典 */
add({
  name: '反应力-全满后重玩-前置存档',
  page: 'index.html',
  steps: [
    { label: '把八关都记成三星（24 / 24）', js: wrap(`
      const rows = {};
      ['reaction','whack','aim','drag','track','trace','dbl','frenzy']
        .forEach(id => { rows[id] = { best:null, stars:3, plays:1 }; });
      localStorage.setItem('mouseReactionLab.v1', JSON.stringify(rows));
      localStorage.removeItem('mouseReactionLab.finale.v1');   /* 别把「正在庆典里」带进下一个场景 */
      return JSON.stringify({ seeded: Object.keys(rows).length });
    `) }
  ]
});

add({
  name: '反应力-全满后重玩',
  page: '鼠标反应力实验室.html',
  steps: [
    { label: '首页露出金色横幅，头部 24 / 24', js: wrap(`
      await __wait(400);
      return JSON.stringify({ stars: __$('.total').textContent.trim(),
        barShown: !__$('#celebrateBar').classList.contains('hidden'),
        barText: __$('#celebrateBar').textContent.trim(),
        overflowX: document.documentElement.scrollWidth > window.innerWidth + 1 });
    `), shot: true },
    { label: '重玩一关仍是普通结算卡，8 秒内不会自己进庆典', js: wrap(`${openMode('连点狂潮')}
      const st = __$('#stage'); const [cx, cy] = __center(st);
      const t0 = Date.now();
      let barHidden = false;
      while (Date.now() - t0 < 60000 && !__$('#overlay').classList.contains('show')) {
        if (Date.now() - t0 > 300) barHidden = barHidden || __$('#celebrateBar').classList.contains('hidden');
        __pd(st, 'pointerdown', cx, cy); __pd(st, 'pointerup', cx, cy);
        await __wait(60);
      }
      const shown = { homeBtn: !!__$('#overlay [data-act="home"]'),
        retryBtn: !!__$('#overlay [data-act="retry"]'),
        finaleBtn: !!__$('#overlay [data-act="finale"]'),
        celebrationCard: !!__$('#overlay .sheet.celebration'),
        barHidden };
      await __wait(8000);                       /* 比自动进庆典的 6 秒更长 */
      return JSON.stringify({ shown,
        finaleAfterWait: __$('#finale').classList.contains('show'),
        sheetStillOn: __$('#overlay').classList.contains('show'),
        stars: __$('.total').textContent.trim() });
    `), shot: true }
  ]
});

/* 进度存档：练到一半退出/刷新，下次进这一关接着做。
   「前半」把两个关卡都做一半就退出（现场落盘），「后半」是一个全新的页面
   （等价于刷新，场景共用一个浏览器 profile），检查标记、接着做和重新开始。 */
add({
  name: '反应力-进度存档-清档',
  page: 'index.html',
  steps: [
    { label: '清掉前面场景留下的存档，从零开始', js: wrap(`
      localStorage.removeItem('mouseReactionLab.v1');
      localStorage.removeItem('mouseReactionLab.stage.v1');
      localStorage.removeItem('mouseReactionLab.finale.v1');
      return JSON.stringify({ left: Object.keys(localStorage).filter(k => k.indexOf('mouseReactionLab') === 0) });
    `) }
  ]
});

add({
  name: '反应力-进度存档-前半',
  page: '鼠标反应力实验室.html',
  steps: [
    { label: '打地鼠打到一半就退出', js: wrap(`${openMode('打地鼠')}
      await __wait(6200);
      let hits = 0;
      for (let i = 0; i < 40; i++) {
        const mole = __$('.hole.up .mole');
        if (mole) {
          const hole = mole.closest('.hole');
          const [x, y] = __center(mole);
          __pd(hole, 'pointerdown', x, y); __pd(hole, 'pointerup', x, y);
          hits++;
        }
        await __wait(170);
      }
      const hud = __hud();
      ${exitGame}
      const raw = JSON.parse(localStorage.getItem('mouseReactionLab.stage.v1') || '{}');
      return JSON.stringify({ hits, hud, halfDone: !!(raw.stage && raw.stage.whack),
        snap: (raw.stage && raw.stage.whack) ? raw.stage.whack.snap : null });
    `) },
    { label: '闪电反应做完两回合也退出', js: wrap(`${openMode('闪电反应')}
      await __wait(400);
      const st = __$('#stage');
      const [cx, cy] = __center(st);
      __pd(st, 'pointerdown', cx, cy); __pd(st, 'pointerup', cx, cy);
      for (let i = 0; i < 5; i++) {
        let waited = 0;
        while (waited < 6000 && !__$('#stage').classList.contains('rx-go')) { await __wait(80); waited += 80; }
        __pd(st, 'pointerdown', cx, cy); __pd(st, 'pointerup', cx, cy);
        await __wait(900);
        if (__$$('.rx-dots i.done').length >= 2) break;
      }
      const done = __$$('.rx-dots i.done').length;
      const hud = __hud();
      ${exitGame}
      const raw = JSON.parse(localStorage.getItem('mouseReactionLab.stage.v1') || '{}');
      return JSON.stringify({ done, hud,
        snap: (raw.stage && raw.stage.reaction) ? raw.stage.reaction.snap : null,
        modes: Object.keys(raw.stage || {}) });
    `) }
  ]
});

add({
  name: '反应力-进度存档-后半',
  page: '鼠标反应力实验室.html',
  steps: [
    { label: '新打开的页面在首页标出「上次做到一半」，星级不受影响', js: wrap(`
      await __wait(600);
      const cats = __$$('#homeGrid .mode .m-cat').map(e => e.textContent.trim());
      return JSON.stringify({ halfRows: cats.filter(t => t.indexOf('上次做到一半') >= 0).length,
        cats, total: __$('.total').textContent.trim() });
    `), shot: true },
    { label: '进打地鼠接着做：分数和剩余时间都在；「重新开始」能从头做', js: wrap(`
      const raw = JSON.parse(localStorage.getItem('mouseReactionLab.stage.v1') || '{}');
      const snap = (raw.stage && raw.stage.whack) ? raw.stage.whack.snap : null;
      ${openMode('打地鼠')}
      await __wait(800);
      const hud0 = __hud();
      const chip = !__$('#resumeChip').classList.contains('hidden');
      const rbtn = !__$('#restartBtn').classList.contains('hidden');
      const left0 = Number(String(hud0[3] || '').replace('剩余', '').replace('s', '').trim());
      const scoreKept = !!snap && hud0[0] === ('得分' + snap.score);
      __$('#restartBtn').click();
      await __wait(900);
      const hud1 = __hud();
      return JSON.stringify({ snap, hud0, scoreKept,
        left0, leftKept: !!snap && isFinite(left0) && left0 > 0 && left0 < 30,
        chip, rbtn, hud1, chipGoneAfterRestart: __$('#resumeChip').classList.contains('hidden'),
        stillHalfDone: !!(JSON.parse(localStorage.getItem('mouseReactionLab.stage.v1') || '{}').stage || {}).whack });
    `), shot: true },
    { label: '进闪电反应接着做：已经测完的回合还在', js: wrap(`
      const raw = JSON.parse(localStorage.getItem('mouseReactionLab.stage.v1') || '{}');
      const snap = (raw.stage && raw.stage.reaction) ? raw.stage.reaction.snap : null;
      ${openMode('闪电反应')}
      await __wait(700);
      return JSON.stringify({ snap, hud: __hud(),
        doneDots: __$$('.rx-dots i.done').length,
        chip: !__$('#resumeChip').classList.contains('hidden') });
    `), shot: true }
  ]
});

/* 通关闭幕也存现场：在庆典页玩着无尽点点乐时刷新，应该还在庆典、分数还在。
   同样分两半：前半真进庆典玩一会儿，后半是全新页面（等价于刷新）。 */
add({
  name: '反应力-庆典存档-前置存档',
  page: 'index.html',
  steps: [
    { label: '把八关都记成三星（24 / 24）', js: wrap(`
      const rows = {};
      ['reaction','whack','aim','drag','track','trace','dbl','frenzy']
        .forEach(id => { rows[id] = { best:null, stars:3, plays:1 }; });
      localStorage.setItem('mouseReactionLab.v1', JSON.stringify(rows));
      localStorage.removeItem('mouseReactionLab.finale.v1');
      localStorage.removeItem('mouseReactionLab.stage.v1');
      return 'seeded';
    `) }
  ]
});

add({
  name: '反应力-庆典存档-前半',
  page: '鼠标反应力实验室.html',
  steps: [
    { label: '从首页金色横幅进庆典，玩无尽关攒点分', js: wrap(`
      await __wait(400);
      const bar = __$('#celebrateBar');
      const barShown = !bar.classList.contains('hidden');
      bar.click();
      await __wait(2600);                       /* 等幕布拉开 + 无尽关启动 */
      const opened = __$('#finale').classList.contains('show');
      const t0 = Date.now();
      let hits = 0;
      while (Date.now() - t0 < 20000 && Number(__$('#epScore').textContent) < 6) {
        const it = __$('#epArea .ep-item');
        if (it) { const r = it.getBoundingClientRect();
          __pd(it, 'pointerdown', r.left + r.width / 2, r.top + r.height / 2); hits++; }
        await __wait(150);
      }
      const score = Number(__$('#epScore').textContent);
      const level = Number(__$('#epLevel').textContent);
      const saved = JSON.parse(localStorage.getItem('mouseReactionLab.finale.v1') || 'null');
      return JSON.stringify({ barShown, opened, hits, score, level,
        saved, savedMatchesScore: !!saved && saved.score === score });
    `), shot: true }
  ]
});

add({
  name: '反应力-庆典存档-后半',
  page: '鼠标反应力实验室.html',
  steps: [
    { label: '新页面直接回到庆典，分数接着上次继续', js: wrap(`
      const saved = JSON.parse(localStorage.getItem('mouseReactionLab.finale.v1') || 'null');
      await __wait(1200);
      const autoOpened = __$('#finale').classList.contains('show');
      const score = Number(__$('#epScore').textContent);
      const level = Number(__$('#epLevel').textContent);
      const locked = document.body.classList.contains('locked') &&
        document.documentElement.style.overflow === 'hidden';
      /* 再点几个，确认是在原来的分数上继续加 */
      await __wait(1400);
      const t0 = Date.now();
      let added = 0;
      while (Date.now() - t0 < 15000 && Number(__$('#epScore').textContent) <= score) {
        const it = __$('#epArea .ep-item');
        if (it) { const r = it.getBoundingClientRect();
          __pd(it, 'pointerdown', r.left + r.width / 2, r.top + r.height / 2); added++; }
        await __wait(150);
      }
      const grew = Number(__$('#epScore').textContent) > score;
      /* 收尾：把"正在庆典里"清掉，后面的分辨率检查才看得到正常的关卡列表 */
      localStorage.removeItem('mouseReactionLab.finale.v1');
      return JSON.stringify({ saved, autoOpened, score, level, locked, added,
        scoreKept: !!saved && score === saved.score,
        levelKept: !!saved && level >= saved.level,
        grewAfterResume: grew,
        stillFinale: __$('#finale').classList.contains('show') });
    `), shot: true }
  ]
});

/* 防误触兜底回归：这一页加了通关闭幕后，右键拦截和历史哨兵都不能被带坏 */
add({
  name: '反应力-防误触兜底',
  page: '鼠标反应力实验室.html',
  steps: [
    { label: 'history 哨兵：back/forward/go(-6) 都留在原地且页面没重载', js: wrap(`
      window.__probe = 'kept';
      const before = location.pathname;
      history.back(); await __wait(500);
      const afterBack = location.pathname;
      history.forward(); await __wait(500);
      const afterForward = location.pathname;
      history.go(-6); await __wait(500);
      return JSON.stringify({ probeKept: window.__probe === 'kept',
        samePlace: before === afterBack && before === afterForward && before === location.pathname,
        path: location.pathname });
    `) },
    { label: '右键被拦下，但事件继续冒泡（页内逻辑照常收到）', js: wrap(`
      let reachedDoc = false, reachedPanel = false;
      const spyDoc = () => { reachedDoc = true; };
      const spyPanel = () => { reachedPanel = true; };
      document.addEventListener('contextmenu', spyDoc);
      __$('#panel').addEventListener('contextmenu', spyPanel);
      const ev = new MouseEvent('contextmenu', { bubbles: true, cancelable: true,
        button: 2, clientX: 400, clientY: 300 });
      __$('#panel').dispatchEvent(ev);
      document.removeEventListener('contextmenu', spyDoc);
      await __wait(200);
      return JSON.stringify({ defaultPrevented: ev.defaultPrevented, reachedPanel, reachedDoc });
    `) }
  ]
});

/* ============ 4b. 反应力实验室 · 通关闭幕（?finale=1 测试入口） ============ */
add({
  name: '反应力-通关庆典',
  page: '鼠标反应力实验室.html?finale=1',
  steps: [
    { label: '?finale=1 直达通关闭幕，无尽点点乐能加分/升关/加速', js: wrap(`
      await __wait(2500);
      const jumped = __$('#finale').classList.contains('show');
      const band = __$('#epArea').getBoundingClientRect();
      const head = __$('.ep-head').getBoundingClientRect();
      const saved = localStorage.getItem('mouseReactionLab.v1');
      const scrollBefore = window.scrollY;
      window.scrollTo(0, 600);
      await __wait(300);
      const locked = window.scrollY === scrollBefore &&
        document.documentElement.style.overflow === 'hidden' &&
        document.body.classList.contains('locked');
      const speedOf = async () => {
        const it = __$('#epArea .ep-item');
        if (!it) return null;
        /* 不动正则：模板字符串里的反斜杠会被吃掉，直接按逗号拆 "translate3d(xpx, ypx, 0)" */
        const readY = () => {
          const parts = (it.style.transform || '').split(',');
          if (parts.length < 2) return null;
          const v = parseFloat(parts[1]);
          return isNaN(v) ? null : v;
        };
        const y0 = readY(), ts = Date.now();
        await __wait(320);
        const y1 = readY();
        if (y0 === null || y1 === null || y1 <= y0) return null;
        return Math.round((y1 - y0) / ((Date.now() - ts) / 1000));
      };
      const sampleSpeed = async (n) => {
        const out = [];
        for (let i = 0; i < n * 5 && out.length < n; i++) { const v = await speedOf(); if (v) out.push(v); await __wait(160); }
        return out;
      };
      const mean = a => a.length ? Math.round(a.reduce((x, y) => x + y, 0) / a.length) : null;
      await __wait(900);
      const earlySpeeds = await sampleSpeed(3);
      const t0 = Date.now();
      let swings = 0;
      while (Date.now() - t0 < 24000 && Number(__$('#epScore').textContent) < 12) {
        const it = __$('#epArea .ep-item');
        if (it) { const r = it.getBoundingClientRect();
          __pd(it, 'pointerdown', r.left + r.width / 2, r.top + r.height / 2); swings++; }
        await __wait(170);
      }
      const mid = { score: Number(__$('#epScore').textContent),
                    level: Number(__$('#epLevel').textContent) };
      const lateSpeeds = await sampleSpeed(3);
      await __wait(2200);                                  /* 再等一会，确认还在源源不断刷新 */
      return JSON.stringify({
        jumped, totalStars: __$('#starNum').textContent.trim(),
        celebrateBarShown: !__$('#celebrateBar').classList.contains('hidden'),
        rowDisabled: __$$('#homeGrid .mode').every(b => b.disabled),
        savedIsNull: saved === null,                        /* 预览那次不写存档 */
        locked, swings, mid,
        bandWidth: Math.round(band.width), bandWidthCapped: band.width <= 1002,
        headWidth: Math.round(head.width), bandHeight: Math.round(band.height),
        centered: Math.abs((band.left + band.right) / 2 - window.innerWidth / 2) < 3,
        earlySpeed: mean(earlySpeeds), lateSpeed: mean(lateSpeeds),
        speedUpAfterLevels: (mean(lateSpeeds) || 0) > (mean(earlySpeeds) || 0),
        levelUpWorks: mid.level >= 2,
        stillSpawning: __$$('#epArea .ep-item').length > 0,
        chips: __$$('.ep-head .ep-k').length,
        bestGone: !__$('#epBest'), comboGone: !__$('#epCombo'),
        levelShown: !!__$('#epLevel'),
        finaleStillOn: __$('#finale').classList.contains('show')
      });
    `), shot: true }
  ]
});

/* 宽屏下游戏区必须仍然封顶，否则物件撒得太开没法点 */
add({
  name: '反应力-通关庆典-宽屏',
  page: '鼠标反应力实验室.html?finale=1',
  viewport: [2560, 1080],
  steps: [
    { label: '2560 宽屏下游戏区宽度仍封顶', js: wrap(`
      await __wait(2500);
      const band = __$('#epArea').getBoundingClientRect();
      return JSON.stringify({ innerW: window.innerWidth,
        bandWidth: Math.round(band.width), bandHeight: Math.round(band.height),
        capped: band.width <= 1002,
        centered: Math.abs((band.left + band.right) / 2 - window.innerWidth / 2) < 3,
        jumped: __$('#finale').classList.contains('show') });
    `), shot: true }
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
  for (const page of ['index.html', '键盘练习营.html', '鼠标练习营.html', '鼠标练习营2.html', '鼠标反应力实验室.html', '数据自画像-猜猜我是谁.html', '数据自画像-教师端看板.html']) {
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
  if (r && r.exceptionDetails) {
    const d = r.exceptionDetails;
    return JSON.stringify({ error: (d.text || 'exception') + ' ' + ((d.exception || {}).description || '') });
  }
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
