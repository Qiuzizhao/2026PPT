# 课堂网页 · 项目约定

## 页面结构（重要）

- `index.html` 是**独立**的索引 / 目录页，只负责列出课件入口。
- 六个课件页（键盘练习营、鼠标练习营、鼠标3D探索馆、鼠标反应力实验室、
  数据自画像-猜猜我是谁、数据自画像-教师端看板）都是**各自独立的入口**，
  学生和老师直接从 URL 或快捷方式打开，不经过目录页。
- **不要**在任何课件页里加「返回目录」「返回首页」之类的链接或按钮，
  也不要让课件页跳回 `index.html`。课件页之间同样互不跳转。
- 课件页内部的关卡切换（例如鼠标反应力实验室的「← 返回」）只切换页内状态，
  不产生浏览器历史记录，不受此条约束。

## 目标环境

- 学生用 Edge 打开，电脑操作不熟练，容易误触。
- 优先考虑误触防护：右键拖动手势、误按后退、误关闭标签页。
- 页面以「进去了就留在里面练」为设计前提，不需要提供离开当前页的路径。

## 防误触兜底（每个课件页都必须有）

每个课件页的 `<head>` 里都带一段「防误触兜底」脚本，位置固定在
`</style>` 之后、`</head>` 之前。它由两个机制组成，**两个都必须有**：

1. **右键菜单拦截** —— 学生乱按右键时，不再弹出系统菜单挡住画面。
2. **history 哨兵防误退** —— 学生的右键拖动手势和误按后退键，都不能把页面带走。

### 五条红线（先看这里）

- 任何地方都**绝不调用 `stopPropagation()` / `stopImmediatePropagation()`**。
- **输入框放行**，保留原生右键菜单。
- 哨兵放在 `<head>` 里尽早执行，`file://` 直接跳过。
- **`index.html` 不加这套**，它是入口页，要能点走。
- **新增课件页时整段照抄**，不要各写各的。

---

### 一、右键菜单拦截

#### 要解决的问题

鼠标不熟练的学生会到处乱按右键，弹出浏览器的系统右键菜单盖住练习画面；弹出之后
他们往往不知道怎么关掉，就卡在那里了。所以全站取消系统右键菜单。

#### 写法

```js
document.addEventListener('contextmenu', function (e) {
  if (keepNative(e.target)) return;
  e.preventDefault();
}, true);
```

三个细节，每个都有原因，**改任何一个都会坏**：

**1. 监听挂在 `document` 上，并且用捕获阶段（第三个参数 `true`）。**
挂在 `document` 才能覆盖页面上所有元素；用捕获阶段是因为捕获先于目标元素自己
的监听器执行，页内无论哪一层出现过 `stopPropagation`，这一层都已经被跑到了。

**2. 只调 `preventDefault()`，绝不调 `stopPropagation()`。**
`preventDefault()` 取消的只是"弹出系统菜单"这一个默认动作，事件本身继续按原路传播，
页内自己的右键逻辑照常收到。如果改成 `stopPropagation()`，事件会在捕获阶段就被掐死，
元素上的监听器永远收不到——鼠标练习营的右键练习（气球上的 `contextmenu`）和菜单练习
会当场失效。**这是整个方案里唯一一处"代码看着都对、坏掉了却很难发现"的写法**：
页面照样能打开、能玩，只有那两个练习悄无声息地不响应了。

**3. 输入框放行，用 `closest()` 判断。**
数据自画像那两页有年龄、身高、爱好等填写项，学生要用右键粘贴，必须保留原生菜单。
判断要用
`el.closest('input, textarea, [contenteditable]:not([contenteditable="false"])')`，
不要用 `el.tagName` 判断——`contenteditable` 区域里点到的可能是嵌套的子元素。

#### 拦不住什么

拦不住 Edge 的右键拖动手势：手势在浏览器进程里处理，网页 JS 根本收不到事件。
这一条只解决"菜单挡住画面"，防误退靠下面的哨兵，根治靠关掉 Edge 鼠标手势。

#### 怎么验证

- 在页面普通区域（标题、对话气泡、空白处）点右键：**不应该**出现系统菜单。
- 鼠标练习营进"右键"关卡，对着气球点右键：**应该**照常计分（`#starNum` 增长，
  HUD 进度 `1 / 10`）。
- 鼠标练习营进"选菜单"关卡，在区域里点右键：**应该**弹出页内自定义菜单（6 项）。
- 数据自画像在年龄输入框上点右键：**应该**弹出原生菜单（能粘贴）。

---

### 二、history 哨兵防误退

#### 要解决的问题

Edge 从 137 起默认开启鼠标手势，其中**右键按住向左拖动＝后退**。学生右键点偏了、
按住鼠标一划，页面就直接退回上一个网址，看起来就是"网页没了"。误按后退键同理。

#### 原理

加载时用 `pushState` 往历史里压两条指向当前网址的记录，当前停在最顶上那条。
学生触发后退时，浏览器只是从新记录退回旧记录——这属于**同一个文档内部的历史穿梭**，
页面不会被卸载；`popstate` 一响，我们立刻再压一条，于是又回到顶上。反复退、连着猛退
都出不去，前进同理。

```js
if (location.protocol === 'file:') return;      /* file:// 下浏览器禁止 pushState */
function guard() {
  try { history.pushState({ mtSentinel: 1 }, '', location.href); } catch (e) {}
}
guard(); guard();
window.addEventListener('popstate', guard);
```

#### 为什么这么写

**放在 `<head>` 里尽早执行。** 越早压哨兵，学生越没有机会在"还没上锁"的时间窗口里
触发后退。所以这段脚本放在 `</head>` 之前，而不是等 DOM 加载完再跑。

**压两层。** 第二层是缓冲，真正兜住的是 `popstate` 里的重压——只要页面还活着，
每一次后退都会被立刻顶回去。

**`file://` 必须跳过。** 浏览器禁止在 file 协议下调用 `pushState`，会抛
`SecurityError`。先用 `location.protocol` 判断后返回，外面的 `try/catch` 再兜一层，
保证在不支持的环境里最坏也只是失去兜底，不会让页面脚本报错。

**它不碰任何页面事件。** 所以页内所有玩法都不受影响（包括鼠标练习营的右键练习）。
代价是它也管不了「关闭标签页」和「刷新」这两类手势——页面一旦被关掉或重新加载，
JS 就已经不在了，那只能靠关掉浏览器手势来解决。

#### 副作用（必须记住）

这个标签页的**浏览器后退键和前进键会彻底失效**。这是设计目标而不是 bug：课件页是
各自独立的入口，本来就不需要回目录。如果将来真有某个页面需要"返回上一页"，必须先
改掉这里的哨兵，不能指望浏览器后退键。

#### 怎么验证

在页面控制台里依次执行，每一次 `location.pathname` 都应该**不变**：

```
history.back()      // 模拟手势后退
history.forward()   // 前进
history.go(-6)      // 连着猛退
```

只看网址还不够——要证明页面**没有被卸载重载**：先在页面上打个标记
`window.__probe = 'kept'`，再执行后退，之后标记还在，才说明页面压根没重载过
（如果真的重载了，这个变量会被抹掉）。

Edge 的右键拖动手势本身**无法用自动化验证**（无头 Edge 不跑手势识别器；对照实验里，
连没有任何防护的页面都不会被手势带走）。这一项必须人工在真实 Edge 里右键按住向左
拖一下，确认页面留在原地。

---

### 三、拖拽拦截（可选）

脚本里还有一行 `dragstart` 拦截，取消的是浏览器"原生拖拽"——学生按住文字、图片、
链接往外拖时会触发（拖到桌面变成存文件、拖到地址栏变成搜索）。它不是本方案的必需项，
与右键和防误退相互独立，去掉也不影响另外两个机制。

它和页内玩法不冲突：反应力实验室的"拖拽归位"、3D 探索馆的旋转都走
`pointerdown` / `pointermove`（指针事件），跟 HTML5 拖拽是两条独立的路；全项目没有
任何地方用到 `draggable` 或 `drop`。实测拖拽归位仍然正常（4 球 → 3 球，同色框填充，
HUD 显示"已完成 1 / 4"）。

### 脚本原文（新增课件页整段照抄）

```html
<script>
/* ===== 防误触兜底 =====
   1) 右键菜单：学生鼠标不熟练，乱按时很容易弹出系统右键菜单挡住画面。
      这里全局取消默认菜单，但只调 preventDefault、绝不 stopPropagation，
      页内自己监听 contextmenu 的功能照常收到事件。输入框除外，要用右键粘贴。
   2) 拖拽：防止图片/文字被拖出页面。拖拽练习走 pointer 事件，不受影响。
   3) 防误退：Edge 的鼠标手势（右键按住向左拖动）和误按后退键都会触发浏览器
      后退，把学生从练习页带走。压两层 history 哨兵，任何后退/前进都只会落回
      本页，popstate 一响立刻再压一层，页面始终留在原地。
   本页不使用 hash / history 导航，以上都不影响页内功能。 */
(function () {
  /* 输入框里保留原生右键菜单，方便右键粘贴 */
  function keepNative(el) {
    return !!(el && el.closest &&
      el.closest('input, textarea, [contenteditable]:not([contenteditable="false"])'));
  }
  document.addEventListener('contextmenu', function (e) {
    if (keepNative(e.target)) return;
    e.preventDefault();                    /* 只取消默认菜单，不阻断页内逻辑 */
  }, true);
  document.addEventListener('dragstart', function (e) {
    if (keepNative(e.target)) return;
    e.preventDefault();
  }, true);

  /* 防误退 */
  if (location.protocol === 'file:') return;      /* file:// 下浏览器禁止 pushState */
  function guard() {
    try { history.pushState({ mtSentinel: 1 }, '', location.href); } catch (e) {}
  }
  try {
    guard(); guard();
    window.addEventListener('popstate', guard);
  } catch (e) {}
})();
</script>
```

### 改完必须这样验证

起一个本地服务器（`python -m http.server 8765`），用 Edge 打开课件页实测，
不要只做代码审查。两个机制各自的验证清单见上文对应小节，另外整体回归要确认：

- 六个页面都能正常载入，控制台零报错。
- 鼠标练习营的两个右键关卡照常计分、照常弹菜单。
- 数据自画像的输入框右键菜单仍在。
- 六个页面的 `history.back()` 之后都留在原地，且页面没有重载。

#### 背景

手势在浏览器层处理，网页 JS 拦不住手势本身。页面里这套只是兜底，根治要在学生机上
关闭 Edge 鼠标手势（策略 `MouseGestureEnabled=0`）。

## 老浏览器兼容层（Edge 79+ / 老内核）

### 要解决的问题

学生机上的 Edge 有的是 2020 年前后的老版本，还有的停在 Windows 10 自带的
EdgeHTML 内核。这些浏览器认不出下面这些写法，而且是**整条声明作废**，不是"降级显示"，
所以同一份代码在新电脑上正常、在老电脑上会整页塌掉：

| 写法 | 需要 | 老内核的表现 |
| --- | --- | --- |
| `inset:0` | Edge 87+ | 元素没有四边定位，弹窗/舞台塌成内容大小 |
| `clamp()` / `min()` / `max()` | Edge 79+ | 整条声明被丢弃，字号内边距回落到默认值 |
| flex 容器的 `gap` | Edge 84+ | 间距全部消失，按钮挤成一团 |
| `aspect-ratio` | Edge 88+ | 元素高度变 0，直接看不见 |
| `import map` + 模块顶层 `await` | Edge 89+ | 3D 页面整段脚本不执行 |

### 四条写法约定

1. **不要用 `inset`。** 一律写 `top/right/bottom/left` 四边。
2. **`clamp()` / `min()` / `max()` 必须在前面补一条静态回退声明**，例如
   `font-size:26px;font-size:clamp(18px,4.2vw,26px);`。回退值取上限（教室机器
   都是桌面宽度，取上限最接近实际效果）。`width/height` 上的 `min(A,B)` 写成
   `width:A;max-width:B;`，比静态值更准。
3. **flex 容器的 `gap` 要配一条 `html.no-flexgap` 回退规则**，跟着原规则写在后面：
   `html.no-flexgap .toolbar > *:not(:last-child){margin-right:16px}`。
   用 `margin-right`（而不是 `margin-left`）是因为页内多处用 `margin-left:auto`
   做右对齐，加 `margin-left` 会把它盖掉、标题栏会错位。
   **grid 容器的 `gap` 不要动**，老内核本来就支持 grid gap。
4. **不要用 `aspect-ratio`。** 用 `height:0;padding-bottom:百分比` 代替，
   百分比按"宽度 × 比例"算（例：`width:52%` + `1/1.05` → `padding-bottom:54.6%`）。

### 能力探测脚本（每个页面 `<head>` 里都要有）

flex gap 没法用 `CSS.supports('gap')` 判断——`gap` 从 Chrome 66 起就是 grid-gap 的
别名，老版本会误报"支持"。所以用真实布局量一次宽度，量出来没有间距才给
`<html>` 挂 `no-flexgap`。脚本放在 `<head>` 末尾（`</head>` 之前），只加类名，
不碰任何页面事件，**不是**防误触那套的一部分。

### 3D 探索馆的引擎加载

那个页面原来是 `<script type="module">` + `import map`，两个都要 Edge 89+。
现在改成普通脚本 + 动态 `import()`，按顺序试三个来源，第一个成功就用它：

1. `importmap`（裸模块名 `three`）—— 新版浏览器仍走原来的 unpkg 线路；
2. jsDelivr 的 `+esm` 构建 —— 它会把 addons 里的 `three` 重写成同一个 CDN 地址，
   不会出现两份 three 实例；
3. esm.sh 的 `?target=es2019` 构建 —— 兜底。

三个都连不上才显示"3D 场景没能启动"。`window.__threeSource` 会记录实际用的是哪一个，
排查时先看这个值。**不要**把 3D 页面改回模块 + import map。

### 改完必须这样验证

起本地服务器（`python -m http.server 8765`），两种页面各跑一遍：

1. **正常页面**：七个页面都能载入、控制台零报错、无横向溢出；3D 页面
   `window.__threeSource` 应该是 `importmap`、`window.__mouseReady` 为 true。
2. **老内核模拟**：把页面复制一份，删掉 `clamp()/min()/max()`、`aspect-ratio`、
   `backdrop-filter` 这些声明，并强制给 `<html>` 挂上 `no-flexgap`，再用无头
   浏览器截图，跟正常页面对比应该只有细微差别（此时 3D 页面的
   `window.__threeSource` 应该是 `jsdelivr`，说明回退链路通）。
3. **防误触回归**：鼠标练习营右键关卡照常计分、选菜单关卡照常弹 6 项菜单、
   数据自画像输入框右键不被拦截、其余页面 `history.back()` 后留在原地。

## 部署

- 服务器连接信息见全局 AGENTS.md。
