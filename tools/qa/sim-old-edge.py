"""生成「老内核模拟页」：把新版浏览器才认识的声明整段删掉，并强制挂上 no-flexgap。
用来在没有老浏览器的机器上复核兼容层（老内核会整条忽略这些声明，删掉等价）。
"""
import os
import re

FILES = [
    "index.html",
    "数据自画像-教师端看板.html",
    "数据自画像-猜猜我是谁.html",
    "键盘练习营.html",
    "鼠标3D探索馆.html",
    "鼠标反应力实验室.html",
    "鼠标练习营.html",
]
OUT = "_oldsim"
DROP_PROPS = ("aspect-ratio", "backdrop-filter", "accent-color")


def strip_decls(body):
    depth, cur, parts = 0, "", []
    for ch in body:
        if ch == "(":
            depth += 1
        elif ch == ")":
            depth -= 1
        if ch == ";" and depth == 0:
            parts.append(cur)
            cur = ""
        else:
            cur += ch
    parts.append(cur)
    out = []
    for p in parts:
        probe = p.replace(" ", "")
        low = probe.lower()
        if not p.strip():
            continue
        if any(low.startswith(d + ":") for d in DROP_PROPS):
            continue
        if re.match(r"^[a-z-]+:", low) and re.search(r"(^|:|\s)(clamp|min|max)\(", probe):
            continue
        out.append(p)
    return ";".join(out)


def main():
    os.makedirs(OUT, exist_ok=True)
    for f in FILES:
        src = open(f, encoding="utf-8").read()

        def style_repl(m):
            css = re.sub(r"([^{}]*)\{([^{}]*)\}",
                         lambda mm: mm.group(1) + "{" + strip_decls(mm.group(2)) + "}", m.group(2))
            return m.group(1) + css + m.group(3)

        out = re.sub(r"(<style[^>]*>)(.*?)(</style>)", style_repl, src, flags=re.S)
        out = re.sub(r"[^{}]*:focus-visible[^{}]*\{[^{}]*\}", "", out)
        out = re.sub(r'<script type="importmap">.*?</script>', "", out, flags=re.S)
        out = out.replace("</head>", "<script>document.documentElement.className += ' no-flexgap';</script>\n</head>", 1)
        open(os.path.join(OUT, f), "w", encoding="utf-8", newline="").write(out)
        print("simulated:", f)


if __name__ == "__main__":
    main()
