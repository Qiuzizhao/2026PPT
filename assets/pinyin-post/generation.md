# 拼音小邮局场景素材

使用内置 imagegen 生成。场景和人物保存在本目录，课件只加载本地资源。15张地图均为1536×1024，人物为512×192透明WebP四帧合图（单帧128×192）。路径和镜头由课件根据曲线计算，不把文字或交互界面画进图片。

## 场景提示词

共同提示词（每次独立生成一张图，场景描述替换下列主题）：

> Use case: stylized-concept. Asset type: ONE full-frame landscape 3:2 2.5D map background for a children's delivery typing game. Create a beautiful elevated three-quarter bird's-eye miniature world, soft sculpted clay and detailed painterly texture, rounded dimensional scenery, lovely ambient occlusion, soft sun shadows, natural rich detail, refined pastel color harmony. Whole ground map visible from above, no horizon, no sky strip. Scenery forms pleasing clusters around the edges and islands between open spaces, leaving a broad unobstructed winding walking corridor. The open corridor starts at lower left (13% width,87% height), runs gently toward lower right (75%,68%), bends back to left-middle (27%,44%), then curves right and up to the destination cottage (85%,21%). Keep all buildings, trees, rocks and water out of this corridor. Do not draw a path itself, leave smooth grass/sand/snow/paving for the game to overlay the route. Generous clear open foreground and center. Premium cozy storybook game art, dimensional and immersive. Absolutely no characters, vehicles, writing, labels, symbols, UI, borders, numbers, no side view, no flat vector style.

| 文件 | 场景主题 |
| --- | --- |
| forest.webp | Lush woodland, rounded pines, ferns, mossy rocks, wildflowers, tiny wooden forest cottage, soft sunlight. |
| city.webp | Charming pastel European town, bookstore, tiled roofs, cafe, planters, warm sun on cobblestones. |
| beach.webp | Turquoise coastal cove, pale sand, palms, shells, tide pools, white lighthouse. |
| snow.webp | Snowy mountain valley, powdery pines, icy blue rocks, warm glowing cabin. |
| night.webp | Magical midnight woodland, indigo trees, fireflies, moonlit flowers, warm lantern lodge. |
| flowers.webp | Meadow of pink, lavender and cream flowers, green grass, flower kiosk. |
| bamboo.webp | Chinese bamboo grove, jade bamboo, stones, shallow stream, traditional tea house. |
| orchard.webp | Golden apple orchard, harvest baskets, wildflowers, farm cottage. |
| lake.webp | Clear lakeside garden, willows, lily pads, docked boat, lake cabin. |
| desert.webp | Golden desert oasis, dunes, succulents, date palms, spring, adobe mail station. |
| village.webp | Countryside farm, cream windmill, vegetables, wheat fields, red-roof farmhouse. |
| autumn.webp | Autumn park, ochre and coral maple trees, fallen leaves, postal cottage. |

## 人物提示词

> Use case: stylized-concept. Game character sprite: ONE adorable young adult male postal courier, green cap and sage green jacket, cream trousers, small brown shoes, tan canvas shoulder satchel, holding one small parcel. Full body, feet and hat fully inside frame. Soft dimensional clay-like storybook 2.5D miniature with delicate painted details, same perspective as an elevated three-quarter bird's-eye map viewed 35 degrees from above. Three-quarter facing toward upper right, friendly and simple readable silhouette, face visible a little, cute professional messenger. Character alone centered on truly transparent background, no ground plane, no scenery, no props around him, no text, no border. Very small soft contact shadow directly under shoes only. Render detailed character suitable for scaling to 55 pixels tall on a map.


## 新增中世纪地图

- `medieval-city.webp`：城墙、塔楼、石桥、公会建筑。
- `medieval-town.webp`：半木结构房屋、集市摊棚、水车、旅店。
- `medieval-village.webp`：茅屋、麦田、菜园、风车和小教堂。

由内置 imagegen 分别生成，完整提示词见 `medieval-prompts.json`。继续采用窄小径和跟随镜头，每图50词。


## 网页图片优化

发布素材统一使用 WebP。地图保留1536×1024，quality=82；角色使用512×192四帧合图（单帧128×192），quality=90，保留透明度。16张图片从54,906,042字节压缩至6,533,376字节，约减少88.1%。原始PNG保留在imagegen生成目录，仓库只发布压缩后的图片。

拼音小邮局：基础练习开始2秒后，空闲时按送件顺序逐张预载完整地图，每张之间至少间隔1.2秒，进入送件后停止队列。隐藏标签页暂停，节省流量或2G网络跳过后台队列。进入隐藏关仍只优先请求当前地图和角色，随后预取下一张。

独立拼音送件小哥：先显示768×512、quality=65的WebP预览（15张合计1,399,666字节，单张73–115KB），再空闲加载当前高清图，保留预览作底图避免闪白；随后串行预载下一站预览与高清图。只预载下一站，不下载全部地图，切换场景时旧回调失效。节省流量模式只显示预览，不补高清或预取。预览由已发布WebP用Pillow LANCZOS缩放生成，位于previews/；完整地图保持原样。地图沿途移动不重建图片。


## 角色步行动画

`courier-walk.webp` 使用内置 imagegen 以原角色为参考生成，四格迈步姿态。完整提示词见 `walk-prompt.txt`。将生成合图等分四帧、缩放并发布为透明WebP，合计28,008字节。按沿路移动距离切换帧，连续输入从当前步态接续，停下后切到接地姿态；人物整体不做旋转或晃动。


## 刷新后的地图缓存

两个拼音页面通过`assets/pinyin-post/map-cache.js`注册根目录`pinyin-map-sw.js`，仅拦截本项目目录内的WebP地图、预览与角色。缓存键`pinyin-map-images-v1`，命中直接返回，不再向服务器校验；首次注册前下载的图片从HTTP缓存补存。HTML与脚本始终按正常网络规则加载，不缓存练习进度。修改同名图片时必须递增worker内的缓存版本。浏览器清理站点数据、存储配额回收会清掉缓存。

Service Worker需要HTTPS或localhost；普通HTTP局域网地址、file://、策略禁用时静默降级为浏览器HTTP缓存，不影响练习。独立版预览加载完成立即尝试高清，不再额外等空闲调度，下一站预载仍保留空闲调度。
