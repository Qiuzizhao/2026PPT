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
`</style>` 之后、`</head>` 之前。它做三件事：

1. **右键菜单**：在 `document` 捕获阶段拦 `contextmenu`，取消系统菜单。
2. **拖拽**：同样方式拦 `dragstart`，防止图片文字被拖出页面。
3. **防误退**：`pushState` 压两层 history 哨兵，`popstate` 一响立刻再压一层，
   于是 Edge 的右键拖动手势和误按后退键都无法把页面带走。

### 硬性规则

- **绝不调用 `stopPropagation()` 或 `stopImmediatePropagation()`**。鼠标练习营的
  右键练习（气球上的 `contextmenu`）和菜单练习靠事件冒泡送达，全局掐断会让这两个
  练习当场失效。这一点是整个方案里最容易写错的地方。
- **输入框放行**：`input` / `textarea` / `contenteditable` 上保留原生右键菜单，
  数据自画像那两页需要右键粘贴。
- **`file://` 直接跳过哨兵**：浏览器禁止在 file 协议下 `pushState`，先判断
  `location.protocol`，不要让脚本抛错。
- **`index.html` 不加这套**：它是入口页，要能点走。
- **新增课件页时整段照抄**，不要各写各的。

### 脚本原文

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

起一个本地服务器（`python -m http.server 8765`），用 Edge 打开课件页实测，不要只做代码审查：

- 普通区域点右键：不应出现系统右键菜单。
- 鼠标练习营：右键点气球仍能计分（`#starNum` 增长），菜单练习仍能弹出 6 项自定义菜单。
- 数据自画像：输入框上点右键仍能弹出原生菜单。
- 防误退：执行 `history.back()` 后 `location.pathname` 不变，且页面没有重新加载
  （先在页面上打一个临时变量，重载会把它抹掉）。

Edge 的右键拖动手势本身**无法用自动化验证**（无头 Edge 不跑手势识别器，对照实验
里没有任何防护的页面也不会被带走），这一项必须人工在真实 Edge 里测。

### 背景

手势在浏览器层处理，网页 JS 拦不住手势本身。页面里这套只是兜底，根治要在学生机上
关闭 Edge 鼠标手势（策略 `MouseGestureEnabled=0`）。

## 部署

- 服务器连接信息见全局 AGENTS.md。
