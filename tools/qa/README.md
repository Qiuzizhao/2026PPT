# 课件自检工具

改完课件后跑一遍，代替肉眼看一遍"能不能用、长得对不对"。
依赖：本机装了 Chrome（默认路径 `C:\Program Files\Google\Chrome\Application\chrome.exe`，
可用环境变量 `CHROME` 指定）、Node 18+、Python 3。

## 1. 起本地服务器

```powershell
cd <仓库根目录>
python -m http.server 8765
```

## 2. 功能自检（真实浏览器驱动）

```powershell
node tools/qa/qa.mjs http://127.0.0.1:8765/ .qa-out
node tools/qa/qa.mjs http://127.0.0.1:8765/ .qa-out 键盘      # 只跑名字含"键盘"的场景
```

覆盖：目录页链接、键盘练习营三关全通+通关大奖、鼠标练习营五关全通+通关大奖
（含通关页「无尽点点乐」的加分/升关/掉落加速/持续刷新，并断言连击、最高分两块牌子不存在）、
反应力实验室八个关卡逐个操作、八关全满后的「通关闭幕」（`?finale=1` 直达能加分/升关/
掉落加速/页面锁死，以及先种七关三星存档再真打完第八关的端到端：结算卡只留
「进入通关庆典」一个按钮、按钮不被挤出可视区、预览那次不写存档）、
进度存档（练一半退出 → 新页面标出「上次做到一半」→ 进关卡接着做、能「重新开始」；
在庆典里攒分 → 新页面直接回到庆典、分数接着算）、
防误触兜底（history 哨兵、右键被拦下但事件照常冒泡）、
3D 探索馆滚动/旋转/零件卡片/配色/拆解、
数据自画像填写→预览→提交（上传到 quickform 的请求会被拦截，不会污染真实数据）、
教师端看板加载/详情/筛选，以及 1024×768 与 1920×1080 下的横向溢出检查。

输出：每个场景一行 JSON（含每步返回值与页面报错），截图与 `report.json` 在输出目录。

## 3. 视觉巡检（截图）

```powershell
node tools/qa/shots.mjs http://127.0.0.1:8765/ .qa-shots
node tools/qa/shots.mjs http://127.0.0.1:8765/ .qa-shots 通关页   # 只截名字含"通关页"的
```

把每个游戏/分镜的真实运行画面截一张（25 张），用来核对视觉效果。

## 4. 老内核模拟

```powershell
python tools/qa/sim-old-edge.py      # 生成 _oldsim/ 目录
node tools/qa/qa.mjs http://127.0.0.1:8765/_oldsim/ .qa-old
```

模拟页会删掉老浏览器不认识的声明（`clamp()`/`min()`/`max()`/`aspect-ratio`/
`backdrop-filter`/`:focus-visible`）、去掉 import map，并强制挂上 `no-flexgap`，
用来验证兼容层的回退路径。3D 页面此时应该走 `jsdelivr`（看 `window.__threeSource`）。
