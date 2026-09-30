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

/* ============ 3b2. 鼠标练习营1：进度存档（练一半刷新接着做 + 通关页也存） ============ */
add({
  name: '鼠标练习营-进度存档-清档',
  page: 'index.html',
  steps: [
    { label: '清掉存档，从零开始', js: wrap(`
      localStorage.removeItem('mousecamp1.progress.v1');
      localStorage.removeItem('mousecamp1.finale.v1');
      return JSON.stringify({ left: Object.keys(localStorage).filter(k => k.indexOf('mousecamp1') === 0) });
    `) }
  ]
});

add({
  name: '鼠标练习营-进度存档-前半',
  page: '鼠标练习营.html',
  steps: [
    { label: '左键关做 4 颗星、双击关做 2 颗星就离开', js: wrap(`
      const start = async m => { __$('#nav [data-mode="' + m + '"]').click(); await __wait(450); };
      await start('left');
      for (let i = 0; i < 4; i++) { const t = __$('#play .target'); if (!t) break; __mouse(t, 'click'); await __wait(430); }
      await start('double');
      for (let i = 0; i < 2; i++) { const t = __$('#play .target'); if (!t) break; __mouse(t, 'dblclick'); await __wait(430); }
      __$('#nav [data-mode="home"]').click();
      await __wait(400);
      const raw = JSON.parse(localStorage.getItem('mousecamp1.progress.v1') || '{}');
      return JSON.stringify({ total: __$('#starNum').textContent.trim(),
        best: raw.best, stage: raw.stage, cleared: raw.cleared });
    `), shot: true }
  ]
});

add({
  name: '鼠标练习营-进度存档-后半',
  page: '鼠标练习营.html',
  steps: [
    { label: '新打开的页面：星星还在，导航按钮标出「做了一半」', js: wrap(`
      await __wait(500);
      const half = __$$('#nav button.n-half').map(b => b.dataset.mode);
      const done = __$$('#nav button.n-done').map(b => b.dataset.mode);
      return JSON.stringify({ total: __$('#starNum').textContent.trim(), half, done,
        leftBtnText: __$('#nav [data-mode="left"]').textContent.trim() });
    `), shot: true },
    { label: '进左键关接着做：从 4 / 10 继续（没有"重新开始"按钮）', js: wrap(`
      __$('#nav [data-mode="left"]').click();
      await __wait(700);
      const resumed = (__$('#stars .big-count') || {}).textContent || '';
      return JSON.stringify({ resumed,
        againBtnGone: !__$('#stars .again-btn'),
        againTextGone: document.body.textContent.indexOf('重新开始') < 0,
        navOutline: __$('#nav [data-mode="left"]').style.outline ? 'on' : 'off' });
    `), shot: true },
    { label: '接着做两下：星星往上走，现场跟着更新', js: wrap(`
      for (let i = 0; i < 2; i++) { const t = __$('#play .target'); if (!t) break; __mouse(t, 'click'); await __wait(430); }
      __$('#nav [data-mode="home"]').click();
      await __wait(300);
      const raw = JSON.parse(localStorage.getItem('mousecamp1.progress.v1') || '{}');
      return JSON.stringify({ stageNow: (raw.stage || {}).left, bestNow: (raw.best || {}).left,
        total: __$('#starNum').textContent.trim(),
        navHalf: __$$('#nav button.n-half').map(b => b.dataset.mode) });
    `), shot: true }
  ]
});

add({
  name: '鼠标练习营-庆典存档-前置存档',
  page: 'index.html',
  steps: [
    { label: '五关全通（各 10 星）的存档', js: wrap(`
      const best = {}, cleared = {};
      ['left','right','double','wheel','menu'].forEach(id => { best[id] = 10; cleared[id] = true; });
      localStorage.setItem('mousecamp1.progress.v1', JSON.stringify({ v:1, best, cleared, stage:{}, ts:Date.now() }));
      localStorage.removeItem('mousecamp1.finale.v1');
      return 'seeded';
    `) }
  ]
});

add({
  name: '鼠标练习营-庆典存档-前半',
  page: '鼠标练习营.html',
  steps: [
    { label: '全通后从金色入口进通关页，玩无尽关攒点分', js: wrap(`
      await __wait(500);
      const bar = __$('#finaleBar');
      const barShown = !!bar && bar.style.display !== 'none';
      bar.click();
      await __wait(2600);
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
      const saved = JSON.parse(localStorage.getItem('mousecamp1.finale.v1') || 'null');
      return JSON.stringify({ barShown, opened, hits, score,
        level: Number(__$('#epLevel').textContent),
        saved, savedMatchesScore: !!saved && saved.score === score });
    `), shot: true }
  ]
});

add({
  name: '鼠标练习营-庆典存档-后半',
  page: '鼠标练习营.html',
  steps: [
    { label: '新页面直接回到通关页，得分接着上次继续', js: wrap(`
      const saved = JSON.parse(localStorage.getItem('mousecamp1.finale.v1') || 'null');
      await __wait(1200);
      const autoOpened = __$('#finale').classList.contains('show');
      const score = Number(__$('#epScore').textContent);
      const locked = document.body.classList.contains('locked');
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
      /* 收尾：把"正在通关页"清掉，后面的分辨率检查才看得到正常页面 */
      localStorage.removeItem('mousecamp1.finale.v1');
      return JSON.stringify({ saved, autoOpened, score, locked, added,
        scoreKept: !!saved && score === saved.score,
        grewAfterResume: grew,
        navDisabled: __$$('#nav button').every(b => b.disabled),
        stillFinale: __$('#finale').classList.contains('show') });
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

/* ============ 3c.1 鼠标练习营2：最后一击直接进入隐藏关 ============
   预置前五关已通、最后一关练到第 10 轮并已有 9 星，真实点击最后一个目标。
   最后一击之后，进度完成和隐藏关必须在同一轮同步发生，不能留一个可被打断的延时。 */
add({ name: '鼠标练习营2-最后一击直达隐藏关-种最后一轮', page: 'index.html', steps: [
  { label: '前五关已通，最后一关只剩最后一击', js: wrap(`
    const best = { point:10, hover:10, drag:10, select:10, cursor:10, window:9 };
    const cleared = { point:true, hover:true, drag:true, select:true, cursor:true };
    const stage = { window:{ round:10, stars:9 } };
    localStorage.setItem('mousecamp2.progress.v1', JSON.stringify({ v:1, best, cleared, stage, ts:Date.now() }));
    localStorage.removeItem('mousecamp2.finale.v1');
    return JSON.stringify({ seeded:true, finalRound:stage.window.round, stars:stage.window.stars });
  `) }
]});
add({ name: '鼠标练习营2-最后一击直达隐藏关-最后一击立即跳转', page: '鼠标练习营2.html', steps: [
  { label: '进入最后一轮并露出最后目标', js: wrap(`
    __$('#nav button[data-mode="window"]').click();
    await __wait(350);
    const wins = __$$('#play .win');
    const second = wins[wins.length - 1];
    second.style.left = '-14px'; second.style.top = '-14px';
    const bar = second.querySelector('.tbar');
    const r = bar.getBoundingClientRect();
    const x = r.left + r.width/2, y = r.top + r.height/2;
    __pd(bar, 'pointerdown', x, y);
    document.dispatchEvent(new PointerEvent('pointermove', { bubbles:true, cancelable:true,
      clientX:x+1, clientY:y+1, pointerId:7, pointerType:'mouse', isPrimary:true, button:0, buttons:1 }));
    document.dispatchEvent(new PointerEvent('pointerup', { bubbles:true, cancelable:true,
      clientX:x+1, clientY:y+1, pointerId:7, pointerType:'mouse', isPrimary:true, button:0, buttons:0 }));
    return JSON.stringify({ round:__$('#play').dataset.round, exposed:__$('#play .hid').classList.contains('found') });
  `) },
  { label: '真实鼠标最后一击后隐藏关已立即出现并落盘', nativeClicks:['#play .hid'], js: wrap(`
    const progress = JSON.parse(localStorage.getItem('mousecamp2.progress.v1') || 'null');
    return JSON.stringify({
      finaleShown:__$('#finale').classList.contains('show'),
      finalLevelCleared:!!(progress && progress.cleared && progress.cleared.window),
      finaleSaved:!!localStorage.getItem('mousecamp2.finale.v1')
    });
  `), shot:true }
]});

/* ============ 3d. 鼠标练习营2：结束页的得分/第几关存在本地，刷新还留在结束页 ============
   场景共用一个浏览器 profile，所以"种存档"放在 index.html 上做，
   下一页打开练习营2 就等价于学生刷新了一次。 */
const seedMouse2 = (expired) => wrap(`
  const best = {}, cleared = {};
  ['point','hover','drag','select','cursor','window'].forEach(id => { best[id] = 10; cleared[id] = true; });
  localStorage.setItem('mousecamp2.progress.v1', JSON.stringify({ v:1, best, cleared, stage:{}, ts: Date.now() }));
  localStorage.setItem('mousecamp2.finale.v1', JSON.stringify({
    v:1, ts: Date.now() - ${expired ? '40*60*1000' : '0'}, score:23, level:3
  }));
  return JSON.stringify({ progress: !!localStorage.getItem('mousecamp2.progress.v1'),
    finale: JSON.parse(localStorage.getItem('mousecamp2.finale.v1')) });
`);
add({ name: '鼠标练习营2-结束页存档-种新鲜存档', page: 'index.html', steps: [
  { label: '六关已通关 + 结束页存档 23 分第 3 关', js: seedMouse2(false) }
]});
add({ name: '鼠标练习营2-结束页存档-刷新还在结束页', page: '鼠标练习营2.html', wait: 7000, steps: [
  { label: '重新打开直接回到结束页，得分和第几关都接着算', js: wrap(`
      await __wait(1500);
      const saved = JSON.parse(localStorage.getItem('mousecamp2.finale.v1') || 'null');
      return JSON.stringify({
        finaleShown: __$('#finale').classList.contains('show'),
        score: __$('#epScore').textContent, level: __$('#epLevel').textContent,
        savedScore: saved && saved.score, savedLevel: saved && saved.level,
        fresh: !!saved && (Date.now() - saved.ts) < 60000
      });
    `), shot: true },
  { label: '点掉落物：分数往上走并立刻落盘', js: wrap(`
      const before = Number(__$('#epScore').textContent);
      const t0 = Date.now();
      while (Date.now() - t0 < 9000 && Number(__$('#epScore').textContent) === before) {
        const it = __$('#epArea .ep-item');
        if (it) { const r = it.getBoundingClientRect();
          __pd(it, 'pointerdown', r.left + r.width / 2, r.top + r.height / 2); }
        await __wait(250);
      }
      const saved = JSON.parse(localStorage.getItem('mousecamp2.finale.v1') || 'null');
      return JSON.stringify({ before, now: Number(__$('#epScore').textContent),
        savedScore: saved && saved.score, savedLevel: saved && saved.level,
        levelNow: Number(__$('#epLevel').textContent) });
    `) }
]});
add({ name: '鼠标练习营2-结束页存档-种过期存档', page: 'index.html', steps: [
  { label: '存档时间推到 40 分钟前（上一节课留下的）', js: seedMouse2(true) }
]});
add({ name: '鼠标练习营2-结束页存档-过期回关卡列表', page: '鼠标练习营2.html', steps: [
  { label: '过期存档不生效，落回关卡列表', js: wrap(`
      await __wait(2500);
      return JSON.stringify({
        finaleShown: __$('#finale').classList.contains('show'),
        cards: __$$('#play .lvcard').length,
        resetBtn: !!__$('#homeFoot .btn-mini')
      });
    `), shot: true }
]});
add({ name: '鼠标练习营2-结束页存档-预览不写存档', page: '鼠标练习营2.html?finale=1', wait: 7000, steps: [
  { label: '?finale=1 从 0 分开始，且不覆盖学生存档', js: wrap(`
      await __wait(1500);
      const saved = JSON.parse(localStorage.getItem('mousecamp2.finale.v1') || 'null');
      return JSON.stringify({
        finaleShown: __$('#finale').classList.contains('show'),
        score: __$('#epScore').textContent, level: __$('#epLevel').textContent,
        savedUntouched: !!saved && saved.score === 23 && saved.level === 3
      });
    `), shot: true }
]});

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

/* 反应力实验室只存"每关打完的成绩（星级/最好成绩）"，**不存关卡中途进度**：
   这一页每一关都是连续的小测，中途"接着上次"没有意义（老师明确要求去掉）。
   「前半」打完一关、再把另一关做一半就退出；「后半」是全新页面（等价于刷新），
   检查成绩还在、而做了一半的那一关是从头开始的。 */
add({
  name: '反应力-不存中途进度-清档',
  page: 'index.html',
  steps: [
    { label: '清掉前面场景留下的存档，从零开始', js: wrap(`
      localStorage.removeItem('mouseReactionLab.v1');
      localStorage.removeItem('mouseReactionLab.finale.v1');
      return JSON.stringify({ left: Object.keys(localStorage).filter(k => k.indexOf('mouseReactionLab') === 0) });
    `) }
  ]
});

add({
  name: '反应力-不存中途进度-前半',
  page: '鼠标反应力实验室.html',
  steps: [
    { label: '闪电反应打完一整局，留下星级', js: wrap(`${openMode('闪电反应')}
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
      const sheetStars = __$$('#overlay .s-stars i.on').length;
      const totalStars = __$('.total').textContent.trim();
      ${exitGame}
      const rec = JSON.parse(localStorage.getItem('mouseReactionLab.v1') || '{}');
      return JSON.stringify({ sheetStars, totalStars, savedReactionStars: (rec.reaction || {}).stars });
    `) },
    { label: '打地鼠只做一半就退出（这一半不该被存下来）', js: wrap(`${openMode('打地鼠')}
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
      const rec = JSON.parse(localStorage.getItem('mouseReactionLab.v1') || '{}');
      return JSON.stringify({ hits, hud,
        savedWhackStars: (rec.whack || {}).stars,
        savedWhackPlays: (rec.whack || {}).plays,
        stageKeyExists: localStorage.getItem('mouseReactionLab.stage.v1') !== null });
    `) }
  ]
});

add({
  name: '反应力-不存中途进度-后半',
  page: '鼠标反应力实验室.html',
  steps: [
    { label: '新页面：星级还在，首页没有「上次做到一半」，也没有中途存档', js: wrap(`
      await __wait(600);
      const cats = __$$('#homeGrid .mode .m-cat').map(e => e.textContent.trim());
      const rows = __$$('#homeGrid .mode').map(r => r.textContent.trim());
      const reactionRow = rows.filter(t => t.indexOf('闪电反应') === 0)[0] || '';
      return JSON.stringify({
        halfRows: cats.filter(t => t.indexOf('上次做到一半') >= 0).length,
        total: __$('.total').textContent.trim(),
        reactionStarsLit: (reactionRow.match(/★/g) || []).length,
        stageKeyExists: localStorage.getItem('mouseReactionLab.stage.v1') !== null });
    `), shot: true },
    { label: '做了一半的打地鼠：重进是从头开始，也没有「接着上次／重新开始」', js: wrap(`${openMode('打地鼠')}
      await __wait(900);
      const hud = __hud();
      const left = Number(String(hud[3] || '').replace('剩余', '').replace('s', '').trim());
      /* 用 innerText（不含页内 <script> 源码），只核对看得见的界面 */
      const ui = document.body.innerText;
      return JSON.stringify({ hud,
        freshFromZero: left > 29 && String(hud[0]) === '得分0',
        resumeUiGone: ui.indexOf('接着上次') < 0 && ui.indexOf('重新开始') < 0 &&
          !__$('#resumeChip') && !__$('#restartBtn'),
        playsCounted: (JSON.parse(localStorage.getItem('mouseReactionLab.v1') || '{}').whack || {}).plays });
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

/* ============ 7.5 4-1 课堂页（学生端 / 教师端） ============ */
/* 状态通道与提交都打到 qiuform.qiuzizhao.com，QA 全部拦截，不碰真实课堂数据 */
add({
  name: '4-1-学生端-登录到教室寻宝',
  page: '4.1数据宝藏在身边（学生端）.html',
  blockUrls: ['*qiuform.qiuzizhao.com*'],
  steps: [
    { label: '默认停在登录页', js: wrap(`
      await __wait(800);
      return JSON.stringify({
        view: document.querySelector('.view.active').dataset.route,
        avatars: document.querySelectorAll('#avatar-pick .av').length,
        rosterTip: !!document.querySelector('#roster-pick .roster-tip')
      });
    `), shot: true },
    { label: '所有班级都有测试号和三个备用号', js: wrap(`
      const sel=document.getElementById('inp-class'),result={},required=['测试','备用1','备用2','备用3'];
      ['41','410'].forEach(klass=>{
        sel.value=klass;sel.dispatchEvent(new Event('change'));
        const names=[...document.querySelectorAll('#roster-pick .rp')].map(el=>el.textContent);
        result[klass]=required.every(nm=>names.includes(nm));
      });
      sel.value='测试班';sel.dispatchEvent(new Event('change'));
      const testNames=[...document.querySelectorAll('#roster-pick .rp')].map(el=>el.textContent);
      document.querySelector('#roster-pick .rp').click();
      result['测试班']=required.every(nm=>testNames.includes(nm))&&document.getElementById('inp-name').value==='测试';
      if(!result['41']||!result['410']||!result['测试班'])throw new Error('班级缺少测试/备用号：'+JSON.stringify(result));
      return JSON.stringify(result);
    `) },
    { label: '选班级 → 点名字 → 开始探险 → 地图七关全锁', js: wrap(`
      const sel = document.getElementById('inp-class');
      sel.value = '41';
      sel.dispatchEvent(new Event('change'));
      await __wait(200);
      document.querySelector('#roster-pick .rp').click();
      document.getElementById('btn-start').click();
      await __wait(500);
      return JSON.stringify({
        view: document.querySelector('.view.active').dataset.route,
        stops: document.querySelectorAll('#map .stop').length,
        locked: document.querySelectorAll('#map .stop.locked').length,
        who: document.getElementById('whoname').textContent,
        plabel: document.getElementById('plabel').textContent
      });
    `), shot: true },
    { label: '老师开后 → 教室寻宝可进、背景图在', js: wrap(`
      state.open = {classroom:true,ledger:true,classify:true,self:true,guess:true,travel:true,quiz:true};
      buildMap();
      const locked = document.querySelectorAll('#map .stop.locked').length;
      document.querySelectorAll('#map .stop')[0].click();
      await __wait(400);
      const bg = getComputedStyle(document.querySelector('.stage')).backgroundImage;
      return JSON.stringify({
        lockedAfterOpen: locked,
        view: document.querySelector('.view.active').dataset.route,
        spots: document.querySelectorAll('.spot').length,
        bgIsClassroom: bg.indexOf('classroom') >= 0
      });
    `), shot: true },
    { label: '记录一个数据点（弹层可用）', js: wrap(`
      document.querySelectorAll('.spot')[4].click();
      await __wait(300);
      document.querySelectorAll('.wopt')[0].click();
      document.getElementById('m-ok').click();
      await __wait(300);
      return JSON.stringify({
        found: document.getElementById('found-n').textContent,
        savedInState: Object.keys(state.found).length,
        modalClosed: !document.getElementById('modal').classList.contains('show')
      });
    `), shot: true }
  ]
});
add({
  name: '4-1-教师端-看板与任务开关',
  page: '4.1数据宝藏在身边（教师端）.html',
  blockUrls: ['*qiuform.qiuzizhao.com*'],
  steps: [
    { label: '看板渲染：KPI / 登录名单 / 猜人面板', js: wrap(`
      await __wait(1500);
      return JSON.stringify({
        kpis: document.querySelectorAll('.kpi').length,
        loginBoard: document.getElementById('login-board').innerHTML.length > 0,
        loginKpi: document.getElementById('k-login').textContent,
        switches: document.querySelectorAll('#task-controls .tc-item').length,
        guessPanel: !!document.getElementById('guess-card') || !!document.querySelector('#guess .empty')
      });
    `), shot: true },
    { label: '点一次开关：写状态失败要回滚且不报错', js: wrap(`
      const item = document.querySelectorAll('#task-controls .tc-item')[0];
      const before = item.querySelector('.tc-state').textContent;
      item.click();
      await __wait(800);
      const after = document.querySelectorAll('#task-controls .tc-item')[0].querySelector('.tc-state').textContent;
      return JSON.stringify({before, after, reverted: before === after});
    `), shot: true }
  ]
});

/* ============ 7.6 4-1 修复回归：拖放、复验、必填、批量状态、轮次统计 ============ */
add({ name: '4-1-回归-学生端验证', page: '4.1数据宝藏在身边（学生端）.html', blockUrls: ['*qiuform.qiuzizhao.com*'], steps: [
  { label: '账本答案改动后提交必须重新验算', js: wrap(`
    window.fetch=async()=>({ok:true,status:200,json:async()=>({ok:true})});
    state.student='QA学生';state.klass='测试班';state.open={classroom:true,ledger:true,classify:true,self:true,guess:true,travel:true,quiz:true};
    buildMap();go('ledger');
    const inputs=[...document.querySelectorAll('input.ans')];[48,60,45].forEach((v,i)=>inputs[i].value=String(v));
    document.getElementById('btn-check-ledger').click();
    inputs[0].value='47';inputs[0].dispatchEvent(new Event('input',{bubbles:true}));
    const enabled=!document.getElementById('btn-save-ledger').disabled;
    if(enabled)throw new Error('答案改错后，上交按钮仍可用');
    return JSON.stringify({enabled,needsRecheck:true});
  `) },
  { label: '进入分类挑战准备原生拖放', js: wrap(`
    go('classify');window.__qaDropCount=0;
    document.getElementById('bins').addEventListener('drop',()=>window.__qaDropCount++);
    return JSON.stringify({chips:document.querySelectorAll('#pool-chips .chip').length});
  `) },
  { label: '分类数据块可直接拖进正确分类框', nativeDrags: [{from:'#chip-0',to:'.bin[data-cat="number"]'}], js: wrap(`
    const result={placed:state.cls.placed,score:state.cls.score,drops:window.__qaDropCount};
    if(result.placed!==1||result.score!==10||result.drops<1)throw new Error('分类拖放未生效：'+JSON.stringify(result));
    return JSON.stringify(result);
  `) },
  { label: '旅行推荐缺少数据时不能完成', js: wrap(`
    go('travel');document.querySelector('.travel-card').click();
    window.__qaTravelPosts=[];
    window.fetch=async(url,init)=>{if(String(init&&init.method||'GET').toUpperCase()==='POST')window.__qaTravelPosts.push(JSON.parse(init.body));return {ok:true,status:200,json:async()=>({ok:true})};};
    document.getElementById('btn-save-travel').click();await __wait(30);
    const result={done:state.done.travel,posts:window.__qaTravelPosts.length,missing:['t-alt','t-temp','t-dist','t-fact'].filter(id=>!document.getElementById(id).value.trim())};
    if(result.done||result.posts)throw new Error('空数据旅行推荐被接受：'+JSON.stringify(result));
    return JSON.stringify(result);
  `) }
]});
add({ name: '4-1-回归-教师端统计与批量操作', page: '4.1数据宝藏在身边（教师端）.html', blockUrls: ['*qiuform.qiuzizhao.com*'], steps: [
  { label: '教师端名单含测试号和三个备用号', js: wrap(`
    const names=['测试','备用1','备用2','备用3'],result={41:names.every(n=>ROSTER['41'].filter(x=>x===n).length===1),410:names.every(n=>ROSTER['410'].filter(x=>x===n).length===1)};
    if(!result['41']||!result['410'])throw new Error('教师端测试/备用号名单不一致：'+JSON.stringify(result));
    return JSON.stringify(result);
  `) },
  { label: '空数据变为有数据后清除统计图提示', js: wrap(`
    const ids=['chart-height','chart-subject','chart-score'];
    const titleOf=id=>{const value=charts[id].getOption().title;return Array.isArray(value)?value[0]:value;};
    render([]);
    const emptyTitles=ids.map(id=>titleOf(id));
    if(emptyTitles.some(t=>!t||t.text!=='暂无数据'||t.show===false))throw new Error('空图状态没有显示暂无数据：'+JSON.stringify(emptyTitles));
    render([
      {_id:81,type:'self_portrait',student:'图表回归学生',klass:'41',height:'145',fav_subject:'语文'},
      {_id:82,type:'classify_game',student:'图表回归学生',klass:'41',score:80,total:11}
    ]);
    const populated=ids.map(id=>({id,title:titleOf(id),series:charts[id].getOption().series}));
    const stuck=populated.filter(x=>!x.title||x.title.show!==false);
    if(stuck.length||populated.some(x=>!x.series||!x.series.length))throw new Error('有数据后暂无数据标题仍可见或图表未更新：'+JSON.stringify(populated));
    document.getElementById('chart-height').scrollIntoView({block:'start'});
    return JSON.stringify({emptyShown:true,staleTitlesHidden:stuck.length===0,charts:ids});
  `), shot:true },
  { label: '放大展示当前卡片且维持答案隐藏', js: wrap(`
    guessPool=[{_id:99,student:'放大测试对象',avatar:'🐳',age:'10',height:'145',weight:'56',birth:'9-10',fav_color:'黄色',fav_subject:'语文',fav_animal:'小猫',hobby:'游泳'}];
    guessIdx=0;answerRevealed=false;pickGuess();
    const trigger=document.getElementById('btn-guess-zoom');trigger.click();
    const zoom=document.getElementById('guess-zoom'),content=document.getElementById('guess-zoom-content');
    const actions=document.getElementById('guess-zoom-actions');
    const dialog=zoom.querySelector('.guess-zoom-dialog').getBoundingClientRect();
    const controls=['btn-guess','btn-broadcast','btn-reveal','btn-lottery'].every(id=>{
      const button=document.getElementById(id),r=button.getBoundingClientRect();
      return actions.contains(button)&&document.querySelectorAll('#'+id).length===1&&r.height>0&&r.top>=dialog.top&&r.bottom<=Math.min(dialog.bottom,window.innerHeight);
    });
    const opened=!zoom.hidden&&!!content.querySelector('.card-mini')&&content.querySelector('.name').textContent==='神秘同学'&&document.body.style.overflow==='hidden'&&controls;
    if(!opened)throw new Error('放大展示未打开或剧透答案');
    return JSON.stringify({opened,controlsVisible:controls,hiddenAnswer:content.querySelector('.name').textContent==='神秘同学',cardScale:getComputedStyle(content.querySelector('.card-mini')).padding});
  `), shot:true },
  { label: '放大窗口内揭晓收起答案并换一位同学', js: wrap(`
    dataCache={at:Date.now(),subs:guessPool.slice()};localTcUntil=Date.now()+10000;
    const content=document.getElementById('guess-zoom-content'),reveal=document.getElementById('btn-reveal');
    reveal.click();
    if(content.querySelector('.name').textContent!=='放大测试对象'||!reveal.textContent.includes('收起答案'))throw new Error('放大窗口未揭晓答案');
    reveal.click();
    if(content.querySelector('.name').textContent!=='神秘同学'||!reveal.textContent.includes('揭晓答案'))throw new Error('放大窗口未收起答案');
    guessPool=[{_id:100,type:'self_portrait',klass:'41',student:'换人测试对象',avatar:'🐼',height:'150'}];
    dataCache={at:Date.now(),subs:guessPool.slice()};
    document.getElementById('btn-guess').click();
    if(!content.textContent.includes('150cm')||content.querySelector('.name').textContent!=='神秘同学'||document.getElementById('guess-zoom').hidden)throw new Error('放大窗口换人未更新卡片');
    return JSON.stringify({reveal:true,hide:true,switch:true});
  `) },
  { label: '放大展示支持关闭按钮和 Esc', js: wrap(`
    const trigger=document.getElementById('btn-guess-zoom'),zoom=document.getElementById('guess-zoom');
    document.getElementById('guess-zoom-close').click();
    trigger.click();window.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}));
    const closed=zoom.hidden&&document.body.style.overflow!== 'hidden'&&document.getElementById('guess-actions-home').contains(document.getElementById('guess-actions'));
    if(!closed)throw new Error('放大展示不能关闭');
    const actions=document.getElementById('guess-actions'),panel=actions.closest('.panel').getBoundingClientRect();
    if(Array.from(actions.querySelectorAll('button')).some(b=>{const r=b.getBoundingClientRect();return r.left<panel.left||r.right>panel.right;}))throw new Error('新增抽签按钮后普通卡片的操作栏溢出');
    return JSON.stringify({closed});
  `) },
  { label: '全部班级按轮次时间戳统计猜人结果', js: wrap(`
    await __wait(900);
    const at=localNow();selectedClass='__all__';stateMap={};localTcUntil=Date.now()+10000;
    dataCache={at:Date.now(),subs:[
      {_id:1,type:'self_portrait',student:'神秘学生',klass:'41',_at:at,age:'10',height:'140',fav_color:'蓝色',fav_subject:'数学',fav_animal:'熊猫',hobby:['画画'],avatar:'🐼'},
      {_id:2,type:'guess_round',klass:'__all__',_at:at,at,target_name:'神秘学生'},
      {_id:3,type:'guess_submit',student:'参与学生',klass:'41',_at:at,round_id:at,wrong_count:2}
    ]};
    renderAll();
    const stats=document.getElementById('guess-stats').textContent;
    if(!stats.includes('已猜对 1 人')||!stats.includes('全班猜错 2 次'))throw new Error('全部班级猜人统计未匹配时间戳：'+stats);
    return JSON.stringify({stats});
  `) },
  { label: '全部班级任务开关准确报告部分失败班级', js: wrap(`
    window.__qaWrites=[];
    window.fetch=async(url,init)=>{
      const method=String(init&&init.method||'GET').toUpperCase(),u=String(url);
      if(method==='PUT'){
        const key=decodeURIComponent(u.substring(u.indexOf('/state/')+7).split('?')[0]);
        const ok=key.endsWith(':41');window.__qaWrites.push({key,ok});return {ok,status:ok?200:503,json:async()=>({})};
      }
      return {ok:true,status:200,json:async()=>({ok:true})};
    };
    selectedClass='__all__';taskOpen={classroom:false,ledger:false,classify:false,self:false,guess:false,travel:false,quiz:false};renderTaskControls();
    document.querySelector('#task-controls .tc-item').click();await __wait(50);
    const taskToast=document.getElementById('_toast').textContent;
    const taskMissing=!taskToast.includes('四(10)班')||!taskToast.includes('测试班');
    window.__qaWrites=[];document.getElementById('btn-guess-zoom').click();
    if(!document.getElementById('guess-zoom-actions').contains(document.getElementById('btn-broadcast')))throw new Error('广播按钮未进入放大窗口');
    document.getElementById('btn-broadcast').click();await __wait(50);
    const roundToast=document.getElementById('_toast').textContent;
    const roundMissing=!roundToast.includes('四(10)班')||!roundToast.includes('测试班');
    if(Number(document.getElementById('_toast').style.zIndex)<=1000)throw new Error('广播结果被放大窗口遮住');
    document.getElementById('guess-zoom-close').click();
    if(taskMissing||roundMissing)throw new Error('部分失败没有准确报告：'+JSON.stringify({taskToast,roundToast,taskMissing,roundMissing}));
    return JSON.stringify({taskToast,roundToast,writes:window.__qaWrites});
  `) }
]});

/* ============ 8. 多分辨率不溢出 ============ */
add({ name:'4-1-抽签-当前班级已登录学生',page:'4.1数据宝藏在身边（教师端）.html',blockUrls:['*qiuform.qiuzizhao.com*'],steps:[
  {label:'放大窗口内抽出三位本班已登录学生且不重复',js:wrap(`
    selectedClass='41';stateMap={};dataCache={at:Date.now(),subs:[]};localTcUntil=Date.now()+10000;
    window.__qaLotteryEligible=ROSTER['41'].slice(0,5);
    const at=localNow();
    window.__qaLotteryEligible.forEach((name,i)=>{stateMap['login:41:'+name]={updated_at:i===4?new Date(Date.now()-5*60000).toISOString():at};});
    stateMap['hb:41:'+ROSTER['41'][0]]={updated_at:at};
    stateMap['login:41:'+ROSTER['41'][5]]={updated_at:new Date(Date.now()-TASK_TTL-1000).toISOString()};
    stateMap['login:410:'+ROSTER['41'][6]]={updated_at:at};
    stateMap['login:41:不在名单的名字']={updated_at:at};
    guessPool=[{_id:101,student:'抽签卡片对象',height:'145'}];pickGuess();
    document.getElementById('btn-guess-zoom').click();document.getElementById('btn-lottery').click();
    const modal=document.getElementById('lottery-window');
    if(modal.hidden||lotteryCandidates('41').length!==5)throw new Error('抽签名单混入未登录、过期或别班学生');
    for(let i=0;i<20;i++){
      document.getElementById('lottery-draw').click();
      const names=Array.from(modal.querySelectorAll('.lottery-name')).map(el=>el.textContent);
      if(names.length!==3||new Set(names).size!==3||names.some(n=>!window.__qaLotteryEligible.includes(n)))throw new Error('抽签结果不满足本班已登录且三人不重复：'+JSON.stringify(names));
    }
    const button=document.getElementById('lottery-draw').getBoundingClientRect();
    if(button.bottom>window.innerHeight||button.top<0)throw new Error('抽签按钮不在可视区');
    return JSON.stringify({eligible:5,draws:20,names:Array.from(modal.querySelectorAll('.lottery-name')).map(el=>el.textContent)});
  `),shot:true},
  {label:'Esc 只关闭抽签窗口并保留放大卡片',js:wrap(`
    window.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}));
    if(!lotteryWindow.hidden||guessZoom.hidden||document.body.style.overflow!=='hidden')throw new Error('关闭抽签时误关放大卡片或解除滚动锁定');
    document.getElementById('guess-zoom-close').click();
    if(document.body.style.overflow==='hidden')throw new Error('关闭窗口后滚动锁定未解除');
    return JSON.stringify({lotteryClosed:true,zoomPreserved:true});
  `)},
  {label:'人数不足三位及无人登录时不制造名字',js:wrap(`
    stateMap={};dataCache={at:Date.now(),subs:[]};
    ROSTER['41'].slice(0,2).forEach(name=>{stateMap['login:41:'+name]={updated_at:localNow()};});
    document.getElementById('btn-lottery').click();document.getElementById('lottery-draw').click();
    if(document.querySelectorAll('#lottery-results .lottery-name').length!==2||!document.getElementById('lottery-status').textContent.includes('不足三位'))throw new Error('不足三位处理错误');
    stateMap={};document.getElementById('lottery-draw').click();
    if(document.querySelectorAll('#lottery-results .lottery-name').length||!document.getElementById('lottery-draw').disabled||!document.getElementById('lottery-status').textContent.includes('没有已登录'))throw new Error('无人登录时仍显示中奖学生');
    document.getElementById('lottery-close').click();
    return JSON.stringify({twoStudents:true,noStudents:true});
  `)},
  {label:'旧版登录记录及全部视图仍按单个班级抽签',js:wrap(`
    stateMap={};selectedClass='__all__';
    dataCache={at:Date.now(),subs:[
      {type:'self_portrait',klass:'41',student:ROSTER['41'][0],_at:localNow()},
      {type:'classify_game',klass:'410',student:ROSTER['410'][0],_at:localNow()},
      {type:'classify_game',klass:'41',student:ROSTER['41'][1],_at:new Date(Date.now()-TASK_TTL-1000).toISOString()}
    ]};
    document.getElementById('btn-lottery').click();
    if(lotteryClassSelect.hidden)throw new Error('全部班级抽签没有班级选择');
    lotteryClassSelect.value='410';lotteryClassSelect.dispatchEvent(new Event('change'));
    document.getElementById('lottery-draw').click();
    const names=Array.from(document.querySelectorAll('#lottery-results .lottery-name')).map(el=>el.textContent);
    if(names.length!==1||names[0]!==ROSTER['410'][0])throw new Error('切班后抽签名单没有隔离：'+JSON.stringify(names));
    document.getElementById('lottery-close').click();
    return JSON.stringify({classIsolated:true,legacyLogin:true});
  `)}
]});

for (const [w, h] of [[1024, 768], [1920, 1080]]) {
  for (const page of ['index.html', '键盘练习营.html', '鼠标练习营.html', '鼠标练习营2.html', '鼠标反应力实验室.html', '数据自画像-猜猜我是谁.html', '数据自画像-教师端看板.html', '4.1数据宝藏在身边（学生端）.html', '4.1数据宝藏在身边（教师端）.html']) {
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

/* ============ 11. 鼠标练习营4（太空补给站）：一条任务线 + 飞船发射 ============
   清档、任务、预览和续关场景共用一个浏览器 profile。 */
const k4Helpers = `
  const __k4key = k => document.dispatchEvent(new KeyboardEvent('keydown', {
    key: k, ctrlKey: true, bubbles: true, cancelable: true }));
  const __k4up = k => document.dispatchEvent(new KeyboardEvent('keyup', {
    key: k, ctrlKey: true, bubbles: true, cancelable: true }));
  const __k4click = s => { const el = __$(s); if (el) el.click(); return !!el; };
  const __k4right = s => { const el = __$(s); if (!el) return false; const r = el.getBoundingClientRect();
    el.dispatchEvent(new MouseEvent('contextmenu', {bubbles:true,cancelable:true,button:2,clientX:r.left+18,clientY:r.top+18})); return true; };
  const __k4menu = (s,act) => { __k4right(s); const b=__$('#mmenu button[data-act="'+act+'"]');
    if(!b) throw new Error('右键菜单缺少 '+act); b.click(); };
  const __k4deliver = async (id, key) => {
    __k4click('#cargo[data-id="' + id + '"]'); __k4key(key);
    __k4click('#port'); __k4key('v'); await __wait(120);
  };
`;

add({ name: '鼠标练习营4-太空补给清档', page: 'index.html', steps: [
  { label: '清除新版进度并种下旧版已通关记录', js: wrap(`
    localStorage.removeItem('mousecamp4.progress.v2');
    localStorage.setItem('mousecamp4.progress.v1',JSON.stringify({v:1,cleared:{s1:true,s2:true,s3:true},ts:Date.now()}));
    return JSON.stringify({ cleared: !localStorage.getItem('mousecamp4.progress.v2'),oldSaved:!!localStorage.getItem('mousecamp4.progress.v1') });
  `) }
]});

add({ name: '鼠标练习营4-太空补给任务线', page: '鼠标练习营4.html', steps: [
  { label: '开场聚焦一张订单、一个货舱和一个投递口', js: wrap(k4Helpers + `
    const result = {title:__$('#missionTitle')&&__$('#missionTitle').textContent.trim(),
      cargo:!!__$('#cargo[data-id="signal"]'),port:!!__$('#port'),oldNav:!!__$('#nav')};
    if(!result.cargo||!result.port||result.oldNav||!result.title.includes('右键')||!__$('#hintText').textContent.includes('鼠标右键')||__$('#finale').classList.contains('show'))
      throw new Error('主界面没有聚焦到一个补给任务：'+JSON.stringify(result));
    return JSON.stringify(result);
  `), shot:true },
  { label: '真实鼠标右键打开复制菜单', nativeClicks:[{selector:'#cargo[data-id="signal"]',button:'right'}], js: wrap(`
    const result={menuOpen:!__$('#mmenu').hidden,copy:!!__$('#mmenu button[data-act="copy"]')};
    if(!result.menuOpen||!result.copy)throw new Error('真实右键没有打开复制菜单：'+JSON.stringify(result));
    return JSON.stringify(result);
  `), shot:true },
  { label: '快捷键不能跳过右键复制和粘贴', js: wrap(k4Helpers + `
    __k4click('#cargo[data-id="signal"]'); __k4key('c');
    const keyboardBlocked=!window.__mc4.state.clip;
    __k4right('#cargo[data-id="signal"]'); await __wait(120);
    const menuOpen=!__$('#mmenu').hidden;
    __k4click('#mmenu button[data-act="copy"]'); __k4click('#port'); __k4key('v');
    const pasteBlocked=__$$('#deliverySlots .delivery-slot.is-filled').length===0;
    const result={menuOpen,keyboardBlocked,pasteBlocked,clipReady:!!window.__mc4.state.clip};
    if(!menuOpen||!keyboardBlocked||!pasteBlocked||!result.clipReady)
      throw new Error('键盘操作跳过了右键任务：'+JSON.stringify(result));
    return JSON.stringify(result);
  `) },
  { label: '真实鼠标右键打开粘贴菜单', nativeClicks:[{selector:'#port',button:'right'}], js: wrap(`
    const result={menuOpen:!__$('#mmenu').hidden,paste:!!__$('#mmenu button[data-act="paste"]')};
    if(!result.menuOpen||!result.paste)throw new Error('真实右键没有打开粘贴菜单：'+JSON.stringify(result));
    return JSON.stringify(result);
  `), shot:true },
  { label: '求救文字右键粘贴后原件留下', js: wrap(k4Helpers + `
    __k4click('#mmenu button[data-act="paste"]'); await __wait(150);
    const delivered=__$$('#deliverySlots .delivery-slot.is-filled').length;
    const sourceStays=!!__$('#cargo[data-id="signal"]');
    if(window.__mc4.state.index!==0||__$$('#deliverySlots .delivery-slot').length!==5)throw new Error('第一轮不能直接过关');
    for(let i=1;i<5;i++){__k4menu('#cargo[data-id="signal"]','copy');__k4menu('#port','paste');await __wait(100);}
    await __wait(800);
    const result={delivered,sourceStays,next:__$('#missionTitle').textContent.trim()};
    if(result.delivered!==1||!result.sourceStays||!result.next.includes('照片'))
      throw new Error('复制求救文字没有正确进入下一单：'+JSON.stringify(result));
    return JSON.stringify(result);
  `), shot:true },
  { label: '同一张照片复制五次，每次都能重新装进口袋', js: wrap(k4Helpers + `
    __k4right('#cargo[data-id="photo"]'); const menuBlocked=__$('#mmenu').hidden;
    await __k4deliver('photo','c'); const sourceStays=!!__$('#cargo[data-id="photo"]');
    const firstDelivered=__$$('#deliverySlots .delivery-slot.is-filled').length;
    for(let i=1;i<5;i++){await __k4deliver('photo','c');if(i<4&&window.__mc4.state.index!==1)throw new Error('照片不足五轮不能过关');}
    const delivered=__$$('#deliverySlots .delivery-slot.is-filled').length;
    await __wait(800);
    const result={menuBlocked,sourceStays,firstDelivered,delivered,next:__$('#missionTitle').textContent.trim()};
    if(!menuBlocked||!sourceStays||result.firstDelivered!==1||result.delivered!==5||!result.next.includes('电池'))
      throw new Error('照片不能复制五份后进入电池任务：'+JSON.stringify(result));
    return JSON.stringify(result);
  `), shot:true },
  { label: '剪切电池后原件离开货舱，三单完成并锁定在发射页', js: wrap(k4Helpers + `
    __k4click('#cargo[data-id="battery"]'); __k4key('x');
    const keyboardBlocked=!window.__mc4.state.clip;
    __k4menu('#cargo[data-id="battery"]','cut'); __k4click('#port'); __k4key('v');
    const pasteBlocked=__$$('#deliverySlots .delivery-slot.is-filled').length===0;
    __k4menu('#port','paste');await __wait(100);
    if(__$('#cargo[data-id="battery"]')||window.__mc4.state.index!==2||__$('#finale').classList.contains('show'))throw new Error('电池没有搬走或提前结束');
    await __wait(650);
    for(let i=1;i<5;i++){__k4menu('#cargo[data-id="battery"]','cut');__k4menu('#port','paste');await __wait(750);}
    await __wait(200);
    const path0=location.pathname+location.search; history.back(); await __wait(350);
    const saved=JSON.parse(localStorage.getItem('mousecamp4.progress.v2')||'null');
    const result={keyboardBlocked,pasteBlocked,finale:__$('#finale').classList.contains('show'),
      sourceGone:!__$('#cargo[data-id="battery"]'),done:__$$('.route-step.done').length,
      saved:!!(saved&&saved.cleared&&saved.cleared.s1&&saved.cleared.s2&&saved.cleared.s3),
      stayed:location.pathname+location.search===path0,
      covers:__$('#finale').contains(document.elementFromPoint(10,10))};
    if(!result.keyboardBlocked||!result.pasteBlocked||!result.finale||!result.sourceGone||result.done!==3||!result.saved||!result.stayed||!result.covers)
      throw new Error('剪切、进度保存或发射页失败：'+JSON.stringify(result));
    return JSON.stringify(result);
  `), shot:true }
]});

add({ name:'鼠标练习营4-大投递口种档',page:'index.html',steps:[
  { label:'进入照片任务以核对飞船主体可点',js:wrap(`
    localStorage.setItem('mousecamp4.progress.v2',JSON.stringify({v:2,cleared:{s1:true},ts:Date.now()}));
    return JSON.stringify({seeded:true});
  `) }
]});
add({ name:'鼠标练习营4-大投递口',page:'鼠标练习营4.html',steps:[
  { label:'投递口覆盖飞船主体和货物槽，而非底部小按钮',js:wrap(k4Helpers + `
    __k4click('#cargo[data-id="photo"]');__k4key('c');
    const port=__$('#port').getBoundingClientRect(),ship=__$('#port .ship-art').getBoundingClientRect();
    const result={wide:port.width>190,tall:port.height>200,containsShip:__$('#port').contains(__$('.ship-art')),
      shipInside:ship.left>=port.left&&ship.right<=port.right&&ship.top>=port.top&&ship.bottom<=port.bottom};
    if(!result.wide||!result.tall||!result.containsShip||!result.shipInside)
      throw new Error('投递口仍然太小或没有包住飞船：'+JSON.stringify(result));
    return JSON.stringify(result);
  `),shot:true },
  { label:'真实鼠标点击飞船图就能选中投递口并粘贴',nativeClicks:[{selector:'#port .ship-art',button:'left'}],js:wrap(k4Helpers + `
    const selected=window.__mc4.state.targetSelected;
    __k4key('v');
    const result={selected,delivered:__$$('#deliverySlots .delivery-slot.is-filled').length};
    if(!result.selected||result.delivered!==1)throw new Error('点飞船主体未能选中投递口：'+JSON.stringify(result));
    return JSON.stringify(result);
  `),shot:true }
]});

add({ name: '鼠标练习营4-预览清档', page: 'index.html', steps: [
  { label: '清档后检查预览模式不写入进度', js: wrap(`
    localStorage.removeItem('mousecamp4.progress.v2');
    return JSON.stringify({ cleared: !localStorage.getItem('mousecamp4.progress.v2') });
  `) }
]});
add({ name: '鼠标练习营4-发射页预览', page: '鼠标练习营4.html?finale=1', wait:1800, steps: [
  { label: '?finale=1 展示完整发射庆祝且不写档', js: wrap(`
    const result={shown:__$('#finale').classList.contains('show'),
      title:__$('#finale h2').textContent.trim(),done:__$$('.route-step.done').length,
      hiddenEntry:!!__$('#startSecret'),noSave:!localStorage.getItem('mousecamp4.progress.v2')};
    if(!result.shown||!result.title.includes('发射')||result.done!==3||!result.hiddenEntry||!result.noSave)
      throw new Error('发射页预览状态错误：'+JSON.stringify(result));
    return JSON.stringify(result);
  `), shot:true }
]});

add({ name:'鼠标练习营4-隐藏关卡',page:'鼠标练习营4.html?finale=1',steps:[
  { label:'飞船在下方跟随鼠标，三类目标从上方下落',js:wrap(k4Helpers + `
    __k4click('#startSecret');
    const b=window.__mc4.battle,r=__$('#secretArena').getBoundingClientRect(),firstY=b.enemies[0].y;
    __$('#secretArena').dispatchEvent(new PointerEvent('pointermove',{bubbles:true,clientX:r.left+r.width*.3,clientY:r.top+r.height*.82}));await __wait(350);
    const ship=__$('#secretShip').getBoundingClientRect();
    const result={threeTypes:new Set(b.enemies.map(e=>e.type)).size===3,mouse:Math.abs(b.x-.3)<.02,bottom:ship.top>r.top+r.height*.6,falling:b.enemies[0].y>firstY};
    if(Object.values(result).some(v=>!v))throw new Error('三弹种射击场没有正确运行：'+JSON.stringify(result));
    return JSON.stringify(result);
  `),shot:true },
  { label:'按住连发，松键/松Ctrl/失焦停火，弹种必须匹配',nativeClicks:[{selector:'#secretArena',button:'left'}],js:wrap(k4Helpers + `
    const b=window.__mc4.battle,r=__$('#secretArena').getBoundingClientRect();
    const aim=x=>__$('#secretArena').dispatchEvent(new PointerEvent('pointermove',{bubbles:true,clientX:r.left+r.width*x,clientY:r.top+r.height*.84}));
    const nativeMouse=Math.abs(b.y-.65)<.02;b.spawnClock=100000;aim(.5);
    const asteroid=b.enemies.find(e=>e.type==='asteroid');
    __k4key('v');const once=b.fired;
    for(let i=0;i<12;i++)document.dispatchEvent(new KeyboardEvent('keydown',{key:'v',ctrlKey:true,repeat:true,bubbles:true,cancelable:true}));
    const repeatSafe=b.fired===once;await __wait(380);
    const autoFire=b.fired>=once+2,wrongBlocked=b.score===0&&b.enemies.includes(asteroid);
    __k4up('v');const stoppedAt=b.fired;await __wait(250);const releaseStops=b.fired===stoppedAt;
    b.enemies.forEach(e=>{e.x=.05;});__k4key('c');__k4up('Control');const controlAt=b.fired;await __wait(200);const ctrlStops=b.fired===controlAt;
    __k4key('v');window.dispatchEvent(new Event('blur'));const blurAt=b.fired;await __wait(200);const blurStops=b.fired===blurAt;
    const expected=[['asteroid','c',1],['ufo','v',3],['barrier','x',6]];
    for(const [type,key,score] of expected){
      b.enemies.forEach(e=>{e.x=.05;});const target=b.enemies.find(e=>e.type===type);target.x=.5;target.y=.5;
      __k4key(key);await __wait(180);__k4up(key);await __wait(180);
      if(b.score!==score)throw new Error(type+' 没有被对应飞弹击毁：'+b.score);
    }
    const result={nativeMouse,repeatSafe,autoFire,wrongBlocked,releaseStops,ctrlStops,blurStops,threeMissiles:true,score:b.score};
    if(Object.values(result).some(v=>v===false))throw new Error('连发或弹种规则错误：'+JSON.stringify(result));
    return JSON.stringify(result);
  `),shot:true },
  { label:'无尽升级、碰撞扣分不降关、恢复分数后再升级',js:wrap(k4Helpers + `
    const b=window.__mc4.battle,oldSpeed=b.speed,oldGap=b.gap;b.spawnClock=0;await __wait(120);const continuous=b.spawned>3;
    const shoot=async()=>{
      b.spawnClock=0;await __wait(80);b.enemies.forEach(e=>{e.x=.05;});
      const goal=b.enemies[0];goal.x=b.x;goal.y=b.y-.2;goal.type='asteroid';goal.weapon='c';
      __k4key('c');await __wait(60);__k4up('c');await __wait(250);
    };
    for(let i=0;i<8&&b.score<10;i++)await shoot();
    const result={continuous,score:b.score,level:b.level,faster:b.speed>oldSpeed,denser:b.gap<oldGap,playing:__$('#finale').classList.contains('battle'),noSave:!localStorage.getItem('mousecamp4.progress.v2')};
    if(!result.continuous||result.score<10||result.level<2||!result.faster||!result.denser||!result.playing||!result.noSave)throw new Error('无尽升级错误：'+JSON.stringify(result));
    if(!b.enemies.length){b.spawnClock=0;await __wait(80);}const score=b.score;b.enemies.forEach(e=>{e.y=1.2;});await __wait(100);
    if(b.score!==score||!b.escaped)throw new Error('漏过目标不应扣分');
    b.score=10;const reachedLevel=b.level,retainedSpeed=b.speed;
    b.spawnClock=0;await __wait(80);let obstacle=b.enemies[0];obstacle.x=b.x;obstacle.y=b.y;await __wait(60);
    if(b.score!==9||b.level!==reachedLevel||b.speed!==retainedSpeed)throw new Error('碰撞应扣分不降关');
    b.score=0;b.spawnClock=0;await __wait(80);obstacle=b.enemies[0];obstacle.x=b.x;obstacle.y=b.y;await __wait(60);
    if(b.score!==0||b.level!==reachedLevel)throw new Error('零分碰撞不能变负分或降关');
    b.level=3;b.score=28;await shoot();const speedAt3=b.speed;
    if(b.score!==29||b.level!==3)throw new Error('29 分仍应保持第 3 关');
    await shoot();if(b.score!==30||b.level!==4||Math.abs(b.speed-speedAt3-.018)>.00001)throw new Error('30 分才应升级到第 4 关并加速');
    result.collisionMinusOne=true;result.levelRetained=true;result.level4At30=true;return JSON.stringify(result);
  `),shot:true }
]});
add({ name: '鼠标练习营4-续关种档', page:'index.html', steps:[
  { label:'种下前两单已经完成的进度', js:wrap(`
    localStorage.setItem('mousecamp4.progress.v2',JSON.stringify({v:2,cleared:{s1:true,s2:true},rounds:{s3:2},ts:Date.now()}));
    return JSON.stringify({seeded:true});
  `) }
]});
add({ name:'鼠标练习营4-刷新接第三单',page:'鼠标练习营4.html',steps:[
  { label:'新页面从电池任务继续，发射页仍未开放',js:wrap(`
    await __wait(450);
    const result={title:__$('#missionTitle').textContent.trim(),done:__$$('.route-step.done').length,
      finale:__$('#finale').classList.contains('show'),rounds:window.__mc4.state.delivered,counter:__$('#missionCounter').textContent};
    if(!result.title.includes('电池')||result.done!==2||result.finale||result.rounds!==2||!result.counter.includes('3 / 5'))
      throw new Error('刷新后没有从第三单继续：'+JSON.stringify(result));
    return JSON.stringify(result);
  `),shot:true }
]});

add({ name:'鼠标练习营4-小屏清档',page:'index.html',steps:[
  { label:'清掉完成进度后再打开任务页',js:wrap(`
    localStorage.removeItem('mousecamp4.progress.v2');
    return JSON.stringify({cleared:!localStorage.getItem('mousecamp4.progress.v2')});
  `) }
]});
add({ name:'鼠标练习营4-1024 小屏',page:'鼠标练习营4.html',viewport:[1024,768],steps:[
  { label:'1024×768 任务布局没有溢出',js:wrap(`
    const r=__$('#station').getBoundingClientRect(),c=__$('#cargo').getBoundingClientRect(),p=__$('#port').getBoundingClientRect();
    const result={overflowX:document.documentElement.scrollWidth>innerWidth+1,
      fits:r.bottom<=innerHeight+1&&c.right<=innerWidth+1,
      port:p.height>200&&p.bottom<=innerHeight+1&&p.right<=innerWidth+1};
    if(result.overflowX||!result.fits||!result.port)throw new Error('小屏投递口溢出：'+JSON.stringify(result));
    return JSON.stringify(result);
  `),shot:true }
]});
add({ name:'鼠标练习营4-发射页-1024',page:'鼠标练习营4.html?finale=1',viewport:[1024,768],wait:1800,steps:[
  { label:'1024×768 发射页铺满屏幕并锁住历史后退',js:wrap(`
    const r=__$('#finale').getBoundingClientRect(),p=location.pathname+location.search;
    history.back(); await __wait(350);
    return JSON.stringify({overflowX:document.documentElement.scrollWidth>innerWidth+1,
      fits:r.width>=innerWidth&&r.height>=innerHeight,
      covers:__$('#finale').contains(document.elementFromPoint(10,10)),
      stayed:location.pathname+location.search===p});
  `),shot:true }
]});

add({ name:'鼠标练习营4-隐藏关存档种档',page:'index.html',steps:[
  { label:'已完成三单的旧版 v2 存档也能解锁隐藏关',js:wrap(`
    localStorage.setItem('mousecamp4.progress.v2',JSON.stringify({v:2,cleared:{s1:true,s2:true,s3:true},secretScore:9,secretLevel:3,ts:Date.now()}));
    return JSON.stringify({seeded:true});
  `) }
]});
add({ name:'鼠标练习营4-隐藏关存档得分',page:'鼠标练习营4.html',steps:[
  { label:'命中目标后写入无尽关得分',js:wrap(k4Helpers + `
    const unlocked=__$('#finale').classList.contains('show')&&!!__$('#startSecret');
    __k4click('#startSecret');
    __k4key('c');await __wait(60);__k4up('c');await __wait(600);
    const saved=JSON.parse(localStorage.getItem('mousecamp4.progress.v2')||'null');
    const result={unlocked,playing:__$('#finale').classList.contains('battle'),score:window.__mc4.battle.score,
      saved:!!(saved&&saved.secretScore===10&&saved.secretLevel===3)};
    if(!result.unlocked||!result.playing||result.score!==10||!result.saved)throw new Error('隐藏关没有正确存档：'+JSON.stringify(result));
    const b=window.__mc4.battle,obstacle=b.enemies[0];obstacle.x=b.x;obstacle.y=b.y;await __wait(60);
    const collisionSave=JSON.parse(localStorage.getItem('mousecamp4.progress.v2')||'null');
    result.collisionSaved=!!(collisionSave&&collisionSave.secretScore===9&&collisionSave.secretLevel===3);
    if(!result.collisionSaved)throw new Error('碰撞后没有保存扣分和原关卡');
    return JSON.stringify(result);
  `) }
]});
add({ name:'鼠标练习营4-隐藏关存档刷新',page:'鼠标练习营4.html',steps:[
  { label:'刷新后得分保留，仍可从发射页续玩',js:wrap(k4Helpers + `
    const launch=__$('#finale').classList.contains('show'),entry=__$('#startSecret').textContent.includes('9 分');
    __k4click('#startSecret');
    const result={launch,entry,score:window.__mc4.battle.score,level:window.__mc4.battle.level};
    if(!result.launch||!result.entry||result.score!==9||result.level!==3)throw new Error('隐藏关刷新状态错误：'+JSON.stringify(result));
    return JSON.stringify(result);
  `) }
]});
add({ name:'鼠标练习营4-隐藏关-1024',page:'鼠标练习营4.html?finale=1',viewport:[1024,768],steps:[
  { label:'1024×768 战斗区、提示栏和目标完整可见',js:wrap(k4Helpers + `
    __k4click('#startSecret');
    const arena=__$('#secretArena').getBoundingClientRect(),hint=__$('.secret-dialogue').getBoundingClientRect(),target=__$('#secretShip').getBoundingClientRect();
    const result={overflowX:document.documentElement.scrollWidth>innerWidth+1,
      arena:arena.top>=0&&arena.bottom<=innerHeight,target:target.left>=arena.left&&target.right<=arena.right,
      dialogue:hint.top>=0&&hint.bottom<=innerHeight};
    if(result.overflowX||!result.arena||!result.target||!result.dialogue)
      throw new Error('隐藏关小屏布局溢出：'+JSON.stringify(result));
    return JSON.stringify(result);
  `),shot:true }
]});

/* ================= CDP 驱动 ================= */
add({
  name: '鼠标练习营3-语文后音乐',
  page: '鼠标练习营3.html',
  steps: [
    { label: '进入第五次练习', nativeClicks: ['#nav button[data-mode="home"]'], js: wrap(`
      window.__mt.goto(0, 4);
      return JSON.stringify({ round: window.__mt.round(), step: window.__mt.state.seqStep });
    `) },
    { label: '真实鼠标轻微移动后点击语文作业', nativeClicks: [{selector:'#play .micon[data-id="cn"]', jitter:8}], js: wrap(`
      return JSON.stringify({ selected: window.__mt.state.sel, step: window.__mt.state.seqStep });
    `), shot: true },
    { label: '真实鼠标点击音乐后过关', nativeClicks: ['#play .micon[data-id="music"]'], js: wrap(`
      const result = { selected: window.__mt.state.sel, step: window.__mt.state.seqStep,
        done: window.__mt.state.done, round: window.__mt.round() };
      if (!result.done) throw new Error('先点语文作业、再点音乐后仍未过关：' + JSON.stringify(result));
      return JSON.stringify(result);
    `), shot: true },
    { label: '进入拖动图标练习', js: wrap(`
      window.__mt.goto(3, 0);
      return JSON.stringify({ level: window.__mt.level(), round: window.__mt.round() });
    `) },
    { label: '真实鼠标分多段拖动音乐后过关', nativeDrags: [{from:'#play .micon[data-id="music"]',to:'#play .slot-cell:nth-child(13)'}], js: wrap(`
      const result = { done: window.__mt.state.done, position: window.__mt.state.icons[0].col + ',' + window.__mt.state.icons[0].row };
      if (!result.done) throw new Error('拖动第5列第2行后仍未过关：' + JSON.stringify(result));
      return JSON.stringify(result);
    `), shot: true }
  ]
});
add({
  name: '鼠标练习营3-拖动图标-同列任意行',
  page: '鼠标练习营3.html',
  steps: [
    { label: '同列的第1、2、4行可以通关，但仍限定第1列', js: wrap(`
      window.__mt.goto(3, 5);
      const goal = window.__mt.levels[3].rounds[5].goal;
      window.__mt.state.icons.forEach((ic, i) => { ic.col = 1; ic.row = i; });
      const acceptedOtherColumn = window.__mt.goalMet(goal);
      if (acceptedOtherColumn) throw new Error('摆在第2列也被错误判为通关');
      window.__mt.goto(3, 5);
      window.__mt.state.icons.forEach((ic, i) => { ic.col = 0; ic.row = [0, 1, 3][i]; });
      const acceptedNonconsecutiveRows = window.__mt.goalMet(goal);
      if (!acceptedNonconsecutiveRows) throw new Error('第1、2、4行同在第1列仍未通过同列判定');
      const pc = __$('#play .micon[data-id="pc"]'), point = __center(pc);
      __pd(pc, 'pointerdown', point[0], point[1]);
      __pd(document, 'pointerup', point[0], point[1]);
      const byId = id => window.__mt.state.icons.find(ic => ic.id === id);
      const result = { done: window.__mt.state.done,
        acceptedOtherColumn, acceptedNonconsecutiveRows,
        positions: ['pc','bin','paint'].map(id => [byId(id).col, byId(id).row]) };
      if (!result.done || !result.acceptedNonconsecutiveRows || JSON.stringify(result.positions) !== '[[0,0],[0,1],[0,3]]')
        throw new Error('第1、2、4行同在第1列时未通关：' + JSON.stringify(result));
      return JSON.stringify(result);
    `) }
  ]
});
add({ name: '鼠标练习营3-进度存档-清档', page: 'index.html', steps: [
  { label: '清掉此前的练习营3进度', js: wrap(`
    localStorage.removeItem('mousecamp3.progress.v1');
    return JSON.stringify({ cleared: !localStorage.getItem('mousecamp3.progress.v1') });
  `) }
]});
add({ name: '鼠标练习营3-进度存档-前半', page: '鼠标练习营3.html', steps: [
  { label: '完成第一课第一轮并写入进度', js: wrap(`
    __$('#nav button[data-mode="l1"]').click();
    __$('#play .micon[data-id="pc"]').click();
    await __wait(1350);
    const saved = JSON.parse(localStorage.getItem('mousecamp3.progress.v1') || 'null');
    if (!saved || !saved.stage || !saved.stage.l1 || saved.stage.l1.round !== 1 || saved.stage.l1.stars !== 1)
      throw new Error('第一轮没有正确存档：' + JSON.stringify(saved));
    return JSON.stringify({ saved: saved.stage.l1, best: saved.best.l1 });
  `) }
]});
add({ name: '鼠标练习营3-进度存档-后半', page: '鼠标练习营3.html', steps: [
  { label: '新页面显示已有星数并从第二轮接着练', js: wrap(`
    const home = __$('#play .home-card[data-mode="l1"]').textContent;
    __$('#nav button[data-mode="l1"]').click();
    const result = { home, round: window.__mt.round(), stars: window.__mt.stars(),
      total: window.__mt.total(), prompt: __$('#bubble').textContent };
    if (result.round !== 1 || result.stars !== 1 || !home.includes('1 / 6'))
      throw new Error('刷新后没有接着练：' + JSON.stringify(result));
    return JSON.stringify(result);
  `), shot: true }
]});
add({ name: '鼠标练习营3-进度存档-预览不写档', page: '鼠标练习营3.html?finale=1', steps: [
  { label: '预览通关页不覆盖原进度', js: wrap(`
    const saved = JSON.parse(localStorage.getItem('mousecamp3.progress.v1') || 'null');
    const result = { finale: __$('#finale').classList.contains('show'), saved: saved && saved.stage && saved.stage.l1 };
    if (!result.finale || !result.saved || result.saved.round !== 1)
      throw new Error('预览污染了进度：' + JSON.stringify(result));
    return JSON.stringify(result);
  `) }
]});
add({ name: '鼠标练习营3-通关存档-种进度', page: 'index.html', steps: [
  { label: '准备第一课最后一轮的真实存档', js: wrap(`
    localStorage.setItem('mousecamp3.progress.v1', JSON.stringify({
      v:1, best:{l1:5}, cleared:{}, stage:{l1:{round:5,stars:5}}, ts:Date.now()
    }));
    return JSON.stringify({ seeded:true });
  `) }
]});
add({ name: '鼠标练习营3-通关存档-完成', page: '鼠标练习营3.html', steps: [
  { label: '从第六轮接着做，完成后立即标记通关', js: wrap(`
    __$('#nav button[data-mode="l1"]').click();
    const started = {round:window.__mt.round(),stars:window.__mt.stars()};
    for(const id of ['pc','bin','paint']) __$('#play .micon[data-id="'+id+'"]').click();
    const saved = JSON.parse(localStorage.getItem('mousecamp3.progress.v1') || 'null');
    if(started.round !== 5 || started.stars !== 5 || !saved || !saved.cleared.l1 || saved.best.l1 !== 6 || saved.stage.l1)
      throw new Error('最后一轮未正确通关落盘：' + JSON.stringify({started,saved}));
    return JSON.stringify({started,cleared:saved.cleared.l1,best:saved.best.l1,stage:saved.stage.l1||null});
  `) }
]});
add({ name: '鼠标练习营3-通关存档-新页面', page: '鼠标练习营3.html', steps: [
  { label: '刷新后已完成标记和总星数保留', js: wrap(`
    const card = __$('#play .home-card[data-mode="l1"]');
    const result = {done:card.classList.contains('done'),stars:__$('#starNum').textContent.trim(),text:card.textContent};
    if (!result.done || result.stars !== '6') throw new Error('通关成绩未恢复：' + JSON.stringify(result));
    return JSON.stringify(result);
  `) }
]});
add({ name: '鼠标练习营3-通关存档-清空', page: '鼠标练习营3.html', steps: [
  { label: '确认清空后成绩归零', js: wrap(`
    window.confirm = () => true;
    __$('#play .home-actions button:last-child').click();
    const result = {save:localStorage.getItem('mousecamp3.progress.v1'),
      stars:__$('#starNum').textContent.trim(),done:__$('#play .home-card[data-mode="l1"]').classList.contains('done')};
    if (result.save || result.stars !== '0' || result.done) throw new Error('清空失败：' + JSON.stringify(result));
    return JSON.stringify(result);
  `) }
]});
add({ name: '鼠标练习营3-全通后入口-种进度', page: 'index.html', steps: [
  { label: '八课全部通关', js: wrap(`
    const cleared={}, best={};
    for(let i=1;i<=8;i++){ cleared['l'+i]=true; best['l'+i]=6; }
    localStorage.setItem('mousecamp3.progress.v1',JSON.stringify({v:1,best,cleared,stage:{},ts:Date.now()}));
    return JSON.stringify({seeded:true});
  `) }
]});
add({ name: '鼠标练习营3-全通后入口-验证', page: '鼠标练习营3.html', steps: [
  { label: '刷新后从首页进入通关页', js: wrap(`
    const btn=__$('#play .home-finale');
    const total=__$('#starNum').textContent.trim();
    if(!btn) throw new Error('全通后缺少通关页入口');
    btn.click();
    const result={total,finale:__$('#finale').classList.contains('show')};
    if(!result.finale) throw new Error('通关页入口无效：'+JSON.stringify(result));
    return JSON.stringify(result);
  `) }
]});
add({ name: '鼠标练习营3-界面修正', page: '鼠标练习营3.html', steps: [
  { label: '右键后选择显示设置即过关', js: wrap(`
    window.__mt.goto(2, 3);
    const tip = __$('#bubble').textContent;
    __$('#play .stage').dispatchEvent(new MouseEvent('contextmenu', {bubbles:true,cancelable:true,button:2,clientX:450,clientY:430}));
    __$('#play .mi[data-label="显示设置"]').click();
    const result={tip,done:window.__mt.state.done,flag:window.__mt.state.flags.displaySettings};
    if(!result.done || !result.flag || !tip.includes('点「显示设置」') || tip.includes('变亮'))
      throw new Error('显示设置题目仍不明确：'+JSON.stringify(result));
    return JSON.stringify(result);
  `) },
  { label: '摆窗口第二次只提示最小化按钮', js: wrap(`
    window.__mt.goto(5, 1);
    await __wait(380);
    const tags=__$$('#play .tag-here');
    const result={tags:tags.map(x=>x.textContent),target:!!__$('#play .wb.min.hintring'),done:window.__mt.state.done};
    if(result.tags.length!==1 || !result.target || result.tags[0]!=='点「—」' || result.done)
      throw new Error('最小化提示错误：'+JSON.stringify(result));
    return JSON.stringify(result);
  `), shot:true },
  { label: '最小化后提示任务栏照片，点回来完成', js: wrap(`
    __$('#play .mwin .wb.min').click();
    const tags=__$$('#play .tag-here');
    const result={tags:tags.map(x=>x.textContent),target:!!__$('#play .mtask .mtbtn[data-win="win-photo"].hintring')};
    if(result.tags.length!==1 || result.tags[0]!=='点任务栏「照片」' || !result.target)
      throw new Error('任务栏提示错误：'+JSON.stringify(result));
    __$('#play .mtask .mtbtn[data-win="win-photo"]').click();
    if(!window.__mt.state.done) throw new Error('从任务栏点回来后未过关');
    return JSON.stringify({result,done:window.__mt.state.done});
  `) },
  { label: '摆窗口第五次停在第五次，待学生主动点照片窗口', js: wrap(`
    window.__mt.goto(5, 4);
    await __wait(400);
    const before={round:window.__mt.round(),done:window.__mt.state.done,active:window.__mt.state.active};
    if(before.round!==4 || before.done || before.active!=='win-essay')
      throw new Error('第五次被自动跳过：'+JSON.stringify(before));
    __$('#play .mwin[data-win="win-photo"] .wbody').dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,pointerId:5,button:0}));
    const after={done:window.__mt.state.done,active:window.__mt.state.active};
    if(!after.done || after.active!=='win-photo') throw new Error('主动点照片没有过关：'+JSON.stringify(after));
    await __wait(1300);
    const next={round:window.__mt.round(),prompt:__$('#bubble').textContent};
    if(next.round!==5 || !next.prompt.includes('两个窗口都最小化'))
      throw new Error('第五次后未正确进入第六次：'+JSON.stringify(next));
    return JSON.stringify({before,after,next});
  `), shot:true },
  { label: '窗口贴边第一次只提示按住标题栏拖', js: wrap(`
    window.__mt.goto(6, 0);
    await __wait(380);
    const tags=__$$('#play .tag-here');
    const result={tags:tags.map(x=>x.textContent),target:!!__$('#play .mwin .tbar.hintring'),done:window.__mt.state.done};
    if(result.tags.length!==1 || !result.target || result.tags[0]!=='按住标题栏拖' || result.done)
      throw new Error('贴边提示错误：'+JSON.stringify(result));
    return JSON.stringify(result);
  `), shot:true }
]});
const userDir = join(tmpdir(), 'cdp-qa-' + Date.now());
add({name:'鼠标练习营4-自由切关种档',page:'index.html',steps:[
  {label:'准备各关不同轮数',js:wrap(`localStorage.setItem('mousecamp4.progress.v2',JSON.stringify({v:2,cleared:{},rounds:{s1:4,s2:1,s3:0},ts:Date.now()}));return 'ok';`)}
]});
add({name:'鼠标练习营4-自由切关',page:'鼠标练习营4.html',steps:[
  {label:'未完成即可切换，轮数保留，口袋不串关',nativeClicks:[{selector:'#routeSteps button[data-task="2"]',button:'left'}],js:wrap(k4Helpers+`
    if(window.__mc4.state.index!==2)throw new Error('真实点击不能切换到第三关');
    const nav=i=>__k4click('#routeSteps button[data-task="'+i+'"]');
    nav(2);if(window.__mc4.state.index!==2)throw new Error('不能直接进入第三关');
    nav(1);if(window.__mc4.state.delivered!==1)throw new Error('第二关轮数丢失');
    __k4click('#cargo');__k4key('c');nav(2);
    if(window.__mc4.state.clip)throw new Error('口袋货物跨关');
    __k4menu('#cargo','cut');__k4menu('#port','paste');nav(1);await __wait(800);
    if(window.__mc4.state.index!==1||!__$('#cargo[data-id="photo"]'))throw new Error('旧回调干扰切关');
    nav(2);if(window.__mc4.state.delivered!==1||!__$('#cargo'))throw new Error('第三关无法续练');
    return JSON.stringify({switchable:true,roundsKept:true,pocketReset:true});
  `)},
  {label:'先完成第三关不提前发射，手动切换不被自动切关覆盖',js:wrap(k4Helpers+`
    for(let i=1;i<5;i++){__k4menu('#cargo','cut');__k4menu('#port','paste');if(i<4)await __wait(700);}
    __k4click('#routeSteps button[data-task="1"]');await __wait(900);
    if(window.__mc4.state.index!==1||__$('#finale').classList.contains('show'))throw new Error('提前发射或覆盖手动切关');
    __k4click('#routeSteps button[data-task="0"]');
    __k4menu('#cargo','copy');__k4menu('#port','paste');
    __k4click('#routeSteps button[data-task="1"]');await __wait(900);
    __k4click('#routeSteps button[data-task="0"]');
    if(!window.__mc4.state.completed||window.__mc4.state.delivered!==5)throw new Error('已完成关卡没有显示完成状态');
    __k4click('#routeSteps button[data-task="1"]');
    for(let i=1;i<5;i++)await __k4deliver('photo','c');await __wait(900);
    if(!__$('#finale').classList.contains('show')||!window.__mc4.save.cleared.s3)throw new Error('乱序完成三关后没有解锁');
    return JSON.stringify({outOfOrder:true,manualSwitchKept:true,completeState:true,finale:true});
  `)}
]});

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
    for (const clickSpec of st.nativeClicks || []) {
      const selector = typeof clickSpec === 'string' ? clickSpec : clickSpec.selector;
      const jitter = typeof clickSpec === 'string' ? 0 : clickSpec.jitter || 0;
      const button = typeof clickSpec === 'string' ? 'left' : clickSpec.button || 'left';
      const buttons = button === 'right' ? 2 : 1;
      const point = JSON.parse(await evalIn(s, `(() => {
        const r = document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect();
        return JSON.stringify({x:r.left+r.width/2,y:r.top+r.height/2});
      })()`));
      await s('Input.dispatchMouseEvent', { type: 'mouseMoved', x: point.x, y: point.y });
      await s('Input.dispatchMouseEvent', { type: 'mousePressed', x: point.x, y: point.y, button, buttons, clickCount: 1 });
      if (jitter) await s('Input.dispatchMouseEvent', { type: 'mouseMoved', x: point.x + jitter, y: point.y, button, buttons });
      await s('Input.dispatchMouseEvent', { type: 'mouseReleased', x: point.x + jitter, y: point.y, button, buttons: 0, clickCount: 1 });
    }
    for (const dragSpec of st.nativeDrags || []) {
      const getPoint = async selector => JSON.parse(await evalIn(s, `(() => {
        const el = document.querySelector(${JSON.stringify(selector)});
        const r = el.getBoundingClientRect();
        if (el.classList.contains('slot-cell') && !r.width) {
          const p = el.closest('.stage').getBoundingClientRect();
          return JSON.stringify({x:p.left+parseFloat(el.style.left)+parseFloat(el.style.width)/2,
            y:p.top+parseFloat(el.style.top)+parseFloat(el.style.height)/2});
        }
        return JSON.stringify({x:r.left+r.width/2,y:r.top+r.height/2});
      })()`));
      const from = await getPoint(dragSpec.from), to = await getPoint(dragSpec.to);
      await s('Input.dispatchMouseEvent', { type: 'mouseMoved', x: from.x, y: from.y });
      await s('Input.dispatchMouseEvent', { type: 'mousePressed', x: from.x, y: from.y, button: 'left', buttons: 1, clickCount: 1 });
      for (let j = 1; j <= 20; j++) {
        await s('Input.dispatchMouseEvent', { type: 'mouseMoved', x: from.x + (to.x-from.x)*j/20,
          y: from.y + (to.y-from.y)*j/20, button: 'left', buttons: 1 });
      }
      await s('Input.dispatchMouseEvent', { type: 'mouseReleased', x: to.x, y: to.y, button: 'left', buttons: 0, clickCount: 1 });
    }
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
