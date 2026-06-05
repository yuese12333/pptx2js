# pptx2js

将 **PowerPoint `.pptx`** 文件转换为可直接运行的 **[PptxGenJS](https://github.com/gitbrent/PptxGenJS)** 生成脚本，并附带媒体资源与转换报告。**当前**生成的 `output.js` 需配合 PptxGenJS 运行；**后续**将制作 **js2pptx** 工具，从脚本或中间表示直接写回 `.pptx`，从而脱离对 PptxGenJS 的依赖。

> 设计文档见 [`design.html`](./design.html)，HTML 版说明见 [`README.html`](./README.html)。

## 核心哲学

**「PptxGenJS 能力边界即转换边界」**

| 层级 | 策略 | 示例 |
|------|------|------|
| 精确转换 | PptxGenJS 原生支持的元素一比一映射 | 文本框、图片、基本形状、线条、纯色背景 |
| 退化转换 | 尽力保留内容，降级为近似表示 | 渐变→纯色、图案填充→前景色、未知形状→矩形 |
| 静默跳过 | 记录日志，不中断流程 | 不支持的 graphicFrame、ActiveX、OLE、VBA |

## 功能特性

- 输入 `.pptx`，输出 `output.js` + `media/` + `conversion.log` + 自动生成说明
- **CLI** 与 **编程 API** 共用同一套六模块流水线
- 转换报告为 JSON，含 `slideIndex`、`elementBounds`、`severity`，便于 CI 集成
- 仅支持 OOXML（`.pptx`），当前为单向 pptx→js；后续 **js2pptx** 实现 js→pptx，不做 GUI

## 当前转换能力（v0.4.4）

| 元素 | 状态 | 说明 |
|------|------|------|
| 文本框（run 格式、段落对齐、`lvl`、段距/行距、`spcPct`、列表、超链接） | ✅ 精确 | `addText()`；`lstStyle`/`defRPr` 继承（优先 `lvl1pPr`）；`indentLevel` 限制 0–8；同段多 `a:pPr` 按 XML 顺序 |
| 文本框 `bodyPr`（垂直对齐、换行） | ✅ 精确 | `anchor`→`valign`；`wrap="none"`→`wrap: false` |
| 图片（PNG/JPEG 等） | ✅ 精确 | `addImage()`；`media/` 重名自动 `name_2.ext` |
| 表格（内联 `a:tbl`、单元格样式与四边边框） | ✅ 精确 | `addTable()`；深色单元格背景自动补白字；四边边框分别输出 |
| 图表（BAR / LINE / PIE / AREA / DOUGHNUT / SCATTER / RADAR / BUBBLE） | ✅ 精确 | `addChart()`；散点图读取 `c:xVal`；graphicFrame URI 精确匹配 |
| 预设形状 / 线条（虚线、`flipH`/`flipV`） | ✅ 精确 | `addShape()`；`spTree` 按文档顺序渲染；`flowChartDecision`→菱形 |
| 形状填充回退 | ✅ 精确 | `spPr` 无填充时读取 `p:style/a:fillRef` |
| 母版/版式装饰形状 | ✅ 精确 | master → layout → slide 层叠；跳过占位符定义形状；母版无填充纯文本装饰（页脚等）不重复渲染 |
| 纯色 / 渐变首色标 / 图案前景色 / `prstClr` / `sysClr` | ✅ / ⚡ | `p:bgPr`、`p:bgRef`；lumMod/shade/tint 等在 HLS 亮度通道运算 |
| 幻灯片尺寸 | ✅ 精确 | `defineLayout()` |
| 组合形状（`p:grpSp`） | ✅ 精确 | 无 `p:spTree` 包装时直接递归展平 |
| 母版/版式占位符继承 | ✅ 精确 | xfrm、`txBody`/`lstStyle`/`defRPr` 合并 |
| 越界元素过滤 | ✅ 精确 | 映射阶段丢弃完全落在幻灯片外的实体 |
| SmartArt | ⚡ 退化 | 从 `dgm:data` 提取文本列表，否则占位 |
| 渐变填充 / 弯曲连接线 | ⚡ 退化 | 渐变文字/填充取首色标；`bentConnector*` 连接器退化为直线 |
| 自定义路径（`a:custGeom`） | ⚡ 跳过 | 记录日志，不中断流程 |
| 不支持图表类型 | ⚡ 退化 | 图表部件 rels 缓存图或占位文本 |
| 复杂动画 | 🔜 计划中 | 见设计文档 |

## 安装

```bash
npm install pptx2js
```

本地开发：

```bash
git clone https://github.com/yuese12333/pptx2js.git
cd pptx2js
npm install
npm test
```

## 使用方式

### CLI

```bash
npx pptx2js input.pptx -o ./pptx2js-output
```

常用参数：

| 参数 | 默认值 | 说明 |
|------|--------|------|
| `input.pptx` | 必填 | 源文件路径 |
| `-o, --output` | `./pptx2js-output` | 输出目录 |
| `--no-media` | — | 不提取媒体，图片引用变为占位注释 |
| `--strict-degrade` | `false` | 任意退化项触发非零退出码 |
| `--strict-skip` | `false` | `severity:error` 跳过项触发非零退出码 |
| `--log-level` | `info` | `minimal` / `info` / `verbose` |
| `--max-file-size` | 50MB | 超过阈值抛出错误（避免静默 OOM） |

> **注意：** Commander 的 `--no-media` 对应内部选项 `media`（默认 `true`）。传入 `--no-media` 后 `media` 为 `false`，才会跳过媒体提取。

### 编程 API

```javascript
const { convert } = require('pptx2js');

const result = await convert('./input.pptx', {
  outputDir: './pptx2js-output',
  logLevel: 'info',
});

console.log(result.scriptPath);  // .../output.js
console.log(result.logPath);     // .../conversion.log
console.log(result.log.statistics);
```

### 运行生成脚本

`output.js` 依赖 [PptxGenJS](https://github.com/gitbrent/PptxGenJS)，需在输出目录单独安装：

> **说明：** 这是 v0.4.x 的过渡方案。后续 **js2pptx** 将支持 `node output.js` 或直接调用 API 生成 `.pptx`，无需安装 PptxGenJS。

```bash
cd pptx2js-output
npm init -y
npm install pptxgenjs
node output.js   # 生成 output.pptx
```

## 输出目录结构

```
pptx2js-output/
├── output.js          # 主生成脚本，可直接 node 运行
├── media/             # 提取的图片等媒体（重名自动加后缀）
├── conversion.log     # JSON 格式转换报告
└── README.md          # 自动生成的说明
```

`conversion.log` 主要字段：`source`、`statistics`、`slides[]`、`degraded[]`、`omitted[]`、`warnings[]`。

## 系统架构

六模块流水线（顺序执行）：

```
input.pptx
  → ① 解压与索引      (lib/unpacker.js)
  → ② XML 预解析      (lib/xml-parser.js, lib/rels.js)
  → ③ 实体提取器      (lib/extractor.js, lib/text-utils.js, lib/placeholder.js, …)
  → ④ 映射引擎        (lib/mapper.js)
  → ⑥ 资源打包器      (lib/packager.js)   ← 先于代码生成，就地更新 IR 中 mediaPath
  → ⑤ 代码生成器      (lib/codegen.js)
  → output.js + media/ + conversion.log
```

辅助模块：`lib/presentation.js`、`lib/graphic.js`、`lib/xml-utils.js`、`lib/color.js`、`lib/bounds.js`、`lib/run-utils.js`、`lib/table.js`、`lib/chart.js`、`lib/smartart.js`。

### XML 节点模型（v0.4.2+）

自研轻量解析器（`lib/xml-parser.js`），统一为 **OONode**：

```js
{ tag: 'a:r', attrs: { … }, children: [ … ], text: '' }
```

实体与命名解码：

| API | 用途 |
|-----|------|
| `decodeOoxmlText(str)` | 文本/属性值中的 `&amp;`、`&#39;` 等（单次扫描，不处理 `_xHHHH_`） |
| `decodeOoxmlName(str)` | 元素/属性名中的 OOXML `_xHHHH_` 转义 |

`lib/xml-utils.js` 提供：

| API | 用途 |
|-----|------|
| `child(node, tag)` | 第一个子节点 |
| `children(node, tag)` | 所有同名子节点（始终为数组） |
| `childNodes(node)` | 有序子节点列表（Z 轴顺序、`pPr`/`r` 顺序） |
| `documentRoot(doc, …tags)` | 兼容 parseXml 直接返回根节点 |

## 技术栈

| 用途 | 选型 |
|------|------|
| ZIP 处理 | [JSZip](https://www.npmjs.com/package/jszip) |
| XML 解析 | 自研 `lib/xml-parser.js`（无 xml2js 运行时依赖） |
| CLI | [Commander.js](https://www.npmjs.com/package/commander) |
| 终端输出 | [chalk](https://www.npmjs.com/package/chalk) |
| 测试 | [Jest](https://jestjs.io/)（单元 + 集成） |

代码格式化在生成阶段自实现缩进拼接，不引入 Prettier。

## 开发

```bash
npm test              # 单元测试 + 集成测试（52 用例）
npm run test:watch    # 监听模式
```

### 目录结构

```
pptx2js/
├── bin/pptx2js.js          # CLI 入口
├── lib/                    # 20 个模块文件（扁平布局）
│   ├── index.js            # 库入口（export convert）
│   ├── convert.js          # 流水线编排
│   ├── unpacker.js         # ① 解压
│   ├── xml-parser.js       # ② OONode XML 解析与 OOXML 实体/命名解码
│   ├── xml-utils.js        # child / children / childNodes
│   ├── rels.js             # ② 关系索引
│   ├── presentation.js     # 幻灯片列表 / 尺寸
│   ├── placeholder.js      # 母版/版式继承与装饰层
│   ├── text-utils.js       # 文本 run / bodyPr 提取
│   ├── color.js            # 颜色规范化与 HLS 亮度修饰
│   ├── bounds.js           # EMU 换算与 xfrm 边界
│   ├── graphic.js          # graphicFrame URI 识别
│   ├── table.js / chart.js / smartart.js
│   ├── extractor.js        # ③ 实体提取
│   ├── mapper.js           # ④ IR 映射
│   ├── codegen.js          # ⑤ 代码生成
│   ├── packager.js         # ⑥ 资源打包
│   └── run-utils.js        # run 合并与选项压缩
├── test/
│   ├── unit/
│   ├── integration/
│   └── helpers/
├── design.html
└── README.html
```

## 已知局限

1. **字体**依赖运行环境，不负责检测或打包嵌入字体  
2. **母版继承**已实现装饰层与 `lstStyle`/`defRPr`；复杂列表/多主题/嵌套样式仍可能不完整  
3. **表格样式主题**（`tblStyle`）未完整实现；深色单元格仅做对比度补偿（白字），非精确主题映射  
4. **SmartArt** 仅文本列表退化，缓存图片路径因 PPT 版本差异未实现  
5. **自定义路径**（`a:custGeom`）与部分预设形状尚未支持  
6. **动画**尚未转换（设计为退化淡入，待实现）  
7. **不保证**往返 PPTX 二进制一致，追求视觉可接受  
8. **不支持**密码保护或 `.ppt` 旧格式  
9. **不支持**增量转换，每次全量重写  
10. **大文件**超过 `--max-file-size` 会直接报错，超大 PPT 需调高阈值或拆分  
11. **默认命名空间**无 XML 前缀的非标 OOXML 可能解析失败  

## 项目状态

当前为 **v0.4.4**，近期增强包括：

- **颜色**：lumMod / lumOff / shade / tint 改在 HLS 亮度通道运算，更贴近 DrawingML 语义  
- **文本**：`bodyPr` 垂直对齐与换行；显式黑色（`000000`）保留；`defRPr` 优先读取 `lvl1pPr`  
- **形状/连接器**：`fillRef` 填充回退；`bentConnector*` 在连接器路径退化；`flowChartDecision` 映射；越界实体过滤  
- **母版装饰**：母版层无填充纯文本形状（页脚等）跳过，避免与幻灯片内容重复  
- **表格**：深色单元格背景自动补白字；四边边框分别 codegen  
- **XML**：`_xHHHH_` 元素名解码与单次实体解码（`decodeOoxmlText` / `decodeOoxmlName`）

复杂动画、`custGeom` 自定义路径与 SmartArt 图形化等待 [`design.html`](./design.html) 继续推进，欢迎贡献。

## 路线图

| 工具 | 状态 | 说明 |
|------|------|------|
| **pptx2js** | 进行中（v0.4.x） | pptx → JS 脚本 + 媒体；代码生成目标为 PptxGenJS API |
| **js2pptx** | 计划中 | 读取脚本或 IR，直接组装 OOXML/ZIP 输出 `.pptx`；完成后可脱离 PptxGenJS，形成 pptx ↔ js 闭环 |

js2pptx 与 pptx2js 将共用提取/映射层的中间表示（IR），避免两套语义各写一遍。

## License

MIT
