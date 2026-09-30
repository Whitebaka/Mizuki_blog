# 相册与写真集

在现有相册之外，`/books/` 展示写真集书架，`/books/<id>/` 提供章节滚动与画册翻阅。桌面按编辑单元展示对页，窄屏画册按单张翻阅；灯箱沿用 Fancybox。照片始终完整显示，首期不提供自动裁切或纸张卷曲效果。

视觉分为基础 UI 与册内美术两层。书架、全站背景、导航、阅读方式、翻页控件和工作台外框沿用 Mizuki 的主题色、字体、深浅模式与卡片样式；书架保留原站横幅和侧栏，阅读器和工作台保留宽版空间。

封面、章节页和工作台画布使用独立的 `photobook-art.css`，限定在 `.book-art` 中。纸色、文字、照片衬底和标题字体使用 `--book-art-*` 变量，不引用站点色相；每本可用 `.book-art[data-artwork="书册ID"]` 独立定制，并自行提供夜间配色。基础 UI 使用 `--book-ui-*`，避免互相影响。当前样册恢复纸色和书刊排版，照片周围使用中性衬底；访客改变站点主题色只改变控件，不改变册内配色。美术在源码中定制，本轮没有新增任意 CSS 编辑器或修改草稿 JSON 结构。

## 素材与清单

只从 `Photo_View` 生成网页派生，生成器拒绝其他目录和越界的文件/符号链接。原片不修改，不回退到 Master。选片清单格式见 `scripts/photobook/p04-selection.json`，每项为唯一 ID 与直接文件名。

```sh
python3 scripts/photobook/prepare.py \
  --source /path/to/Photo_View \
  --selection scripts/photobook/p04-selection.json \
  --output /private/build/botan \
  --url-prefix /photobooks/botan
python3 scripts/photobook/verify.py /private/build/botan
```

需要 Pillow（本次使用已有 NAS 镜像内的 Pillow 12.3.0）。生成长边 640/1600/2400 的 WebP 与 JPEG，按嵌入 ICC 转换 sRGB，并按 EXIF 转正后去掉 EXIF。缺失 ICC 时停止，先确认输入色域。相同环境重复生成得到相同文件哈希。

输出的 `assets.json` 含真实宽高、字节数和版本 URL；作者应补写准确的 `alt`。`source-audit.private.json` 包含来源文件名和哈希，只保存在私有编排侧。**只复制生成的图片到 `public/photobooks/<book>/`，不要复制整个输出目录。** 图片也可放在已配置的 HTTPS 对象存储，以对应 URL 更新版本字段。`srcset` 使用实际宽度，不使用长边值代替宽度。

书册清单放在 `src/data/photobooks/*.json`，结构见 `src/types/photobook.ts`，校验入口 `src/utils/photobook.ts`。清单只含展示字段：封面、图片库、阅读单元、章节、文字、模板、顺序和锁定。模板支持 `hero`/`ending` 各 1 张、`pair` 2 张、`sequence` 2–3 张；同一本书不重复使用照片。通过 `revision` 区分版本。沿用内容分离时，`data/photobooks` 随既有 `data` 同步，不修改同步脚本。

## 私有预览与发布

```sh
pnpm install --frozen-lockfile
PHOTOBOOK_PREVIEW=1 pnpm exec astro check
PHOTOBOOK_PREVIEW=1 pnpm exec astro build
pnpm exec pagefind --site dist
pnpm exec astro preview --host 127.0.0.1 --port 4321
```

`PHOTOBOOK_PREVIEW=1` 构建包括草稿和 `/studio/<id>/`。这是需要自行限制访问的私有预览产物，**不是鉴权措施**。正式构建仅生成已发布书册，不生成编排页；生产构建守卫还逐个检查 `public/photobooks`，阻止未批准或未被已发布清单引用的文件被 Astro 原样拷进输出。正式发布前需人工确认书册 `status: published` 和每个资产 `publicationApproved: true`，并移出剩余草稿文件。不要把私有预览目录当成正式部署目录。

样册 `*.private.json`、网页照片及 `.preview/` 已加入 Git 忽略；照片和来源审计不进公开代码仓库。清单中的批准标记只是发布流程约束，不能替代作者的实际授权，也不提供公开 URL 访问控制。

## 编排工作台

书架在私有预览中提供工作台入口。工作台支持拖拽或按钮调整单元顺序、选择模板、替换为未使用照片、编辑文字、锁定、撤销/重做、浏览器草稿保存及 JSON 导入导出。锁定保护单元内容和绝对位置；移动/删除其他单元也不能绕过位置锁定。裁切固定为完整画面，手机按同一语义顺序重排。

草稿仅保存在当前浏览器。重新打开后按“恢复草稿”载入；网页源版本变化时会拒绝直接恢复，需先核对版本。导出文件是可携带备份；将审阅后的清单交回替换源清单并重新构建，才能更新阅读页。“查看源版本”始终打开构建时的样册。

AI 流程：导出编排简报 → 在外部 AI 工具中生成 `proposal` 对象 → 粘贴提案 → 校验并检查差异 → 接受为草稿。提案只能更新合法阅读单元，必须匹配书册 ID、当前 revision，保持锁定字段；不接受脚本或 HTML。此版本没有配置在线模型，不会上传照片或在访客端调用模型。自动选片/视觉分析、可视化裁切和在线多人编辑不在此版本内。

## 相册兼容

原有 `Photo.src` 保持可用。可选 `thumbnail` 控制默认展示，`fullsize` 控制点击放大，`variants` 支持响应式 WebP/JPEG。页面同时传递 `width`/`height`，加密相册使用同样的图片选择和 HTML 转义。未提供新字段的相册保持原有地址行为。

## 验证

```sh
pnpm test:photobook
pnpm test
```

领域测试覆盖尺寸版本、旧相册、加密 HTML 转义、非法清单、发布批准、提案版本、锁定、事务性应用和生产输出守卫。实际浏览器与交付状态记录在本项目验收记录中；工程通过不等于用户已验收。

## NAS 验收预览

`ops/compose.photobook-preview.yaml` 使用已有 Python 3.12 slim 镜像、非 root、只读挂载，以独立容器 `mizuki-photobook-preview` 提供静态验收页。仅绑定 NAS 局域网地址 `192.168.1.99:8101`，不接公网隧道，不替换正式博客。HTTP 层统一 `no-store`/`noindex` 并关闭目录列表。局域网入口不设登录，不应转发至公网。

源码与构建交付目录：`/mnt/user/ai/Mizuki_blog`。运行：

```sh
cd /mnt/user/ai/Mizuki_blog/ops
docker compose -f compose.photobook-preview.yaml up -d
# 停止验收页，不影响博客或其他应用
docker compose -f compose.photobook-preview.yaml down
```

本机同样可用 `python3 scripts/photobook/preview-server.py --directory dist --port 4321` 查看。后续替换构建时先停止验收容器、同步 `dist` 后再启动，避免用户读到不同构建的混合资源。

浏览器复测脚本为 `tests/photobook.browser.mjs`，需可用 Chromium 和 Playwright。默认使用安装的 `playwright` 包，或通过 `PLAYWRIGHT_MODULE` 指向单独 QA 环境中的包入口，`CHROMIUM_PATH` 可指定浏览器路径。脚本仅对私有预览运行，编辑发生在自动化浏览器自己的草稿中，不修改服务器清单。
