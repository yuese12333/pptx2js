# pptx2js

将 **PowerPoint `.pptx`** 文件转换为可直接运行的 **[PptxGenJS](https://github.com/gitbrent/PptxGenJS)** 生成脚本，并附带媒体资源与转换报告。

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
- 仅支持 OOXML（`.pptx`），不做双向转换、不做 GUI

## 当前转换能力（v0.4.2）

| 元素 | 状态 | 说明 |
|------|------|------|
| 文本框（run 格式、段落对齐、`lvl`、段距、行距、列表、超链接、页码字段） | ✅ 精确 | `addText()`；同段多 `a:pPr` 按 XML 顺序绑定 run |
| 图片（PNG/JPEG 等） | ✅ 精确 | `addImage()`；`media/` 重名自动 `name_2.ext` |
| 表格（内联 `a:tbl`、单元格样式与四边边框） | ✅ 精确 | `addTable()`；文本经 `lib/text-utils.js` 提取 |
| 图表（BAR / LINE / PIE / AREA / DOUGHNUT / SCATTER / RADAR / BUBBLE） | ✅ 精确 | `addChart()`；散点图读取 `c:xVal` |
| 预设形状 / 线条（含虚线 `dashType`） | ✅ 精确 | `addShape()` |
| 纯色 / 渐变首色标 / 图案前景色背景 | ✅ / ⚡ | `p:bgPr` 与 `p:bgRef`（schemeClr） |
| 幻灯片尺寸 | ✅ 精确 | `defineLayout()` |
| 组合形状（`p:grpSp`） | ✅ 精确 | 无 `p:spTree` 包装时直接递归展平 |
| 母版/版式占位符继承 | ✅ 精确 | `lib/placeholder.js`；`grpSp` 内占位符可遍历 |
| SmartArt | ⚡ 退化 | 从 `dgm:data` 提取文本列表，否则占位 |
| 渐变填充 / 未知形状 | ⚡ 退化 | 按 `pos` 取渐变色标；未知 `prstGeom`→矩形 |
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
  → ⑥ 资源打包器      (lib/packager.js)   ← 先于代码生成，写回图片路径
  → ⑤ 代码生成器      (lib/codegen.js)
  → output.js + media/ + conversion.log
```

辅助模块：`lib/presentation.js`、`lib/graphic.js`、`lib/xml-utils.js`、`lib/utils/color.js`、`lib/utils/bounds.js`、`lib/run-utils.js`、`lib/table.js`、`lib/chart.js`、`lib/smartart.js`。

### XML 节点模型（v0.4.2+）

自研轻量解析器（`lib/xml-parser.js`），统一为 **OONode**：

```js
{ tag: 'a:r', attrs: { … }, children: [ … ], text: '' }
```

`lib/xml-utils.js` 提供：

| API | 用途 |
|-----|------|
| `child(node, tag)` | 第一个子节点 |
| `children(node, tag)` | 所有同名子节点（始终为数组） |
| `childNodes(node)` | 有序子节点列表（段落内 `pPr` / `r` 顺序） |
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
npm test              # 单元测试 + 集成测试（47 用例）
npm run test:watch    # 监听模式
```

### 目录结构

```
pptx2js/
├── bin/pptx2js.js          # CLI 入口
├── lib/
│   ├── index.js            # 库入口（export convert）
│   ├── convert.js          # 流水线编排
│   ├── unpacker.js         # ① 解压
│   ├── xml-parser.js       # ② OONode XML 解析
│   ├── xml-utils.js        # child / children / childNodes
│   ├── rels.js             # ② 关系索引
│   ├── presentation.js     # 幻灯片列表 / 尺寸
│   ├── placeholder.js      # 母版/版式占位符继承
│   ├── text-utils.js       # 文本 run 提取（打破与 table 循环依赖）
│   ├── graphic.js          # graphicFrame URI 识别
│   ├── table.js            # 表格提取
│   ├── chart.js            # 图表提取
│   ├── smartart.js         # SmartArt 退化
│   ├── extractor.js        # ③ 实体提取
│   ├── mapper.js           # ④ IR 映射
│   ├── codegen.js          # ⑤ 代码生成
│   ├── packager.js         # ⑥ 资源打包（重名去重）
│   ├── run-utils.js        # run 合并与选项压缩
│   └── utils/              # EMU、颜色、坐标
├── test/
│   ├── unit/
│   ├── integration/
│   └── helpers/            # 最小 PPTX 构造
├── design.html             # 完整设计文档
└── README.html             # 本页 HTML 版
```

## 已知局限

1. **字体**依赖运行环境，不负责检测或打包嵌入字体  
2. **母版装饰形状**（非占位符的校徽、页脚装饰线等）尚未从 layout/master 层提取  
3. **母版继承**已实现 xfrm 与基础 txBody 补全；复杂段落/列表样式继承仍有限；`a:spcPct` 百分比段距/行距暂不处理  
4. **SmartArt** 仅文本列表退化，缓存图片路径因 PPT 版本差异未实现  
5. **动画**尚未转换（设计为退化淡入，待实现）  
6. **不保证**往返 PPTX 二进制一致，追求视觉可接受  
7. **不支持**密码保护或 `.ppt` 旧格式  
8. **不支持**增量转换，每次全量重写  
9. **大文件**超过 `--max-file-size` 会直接报错，超大 PPT 需调高阈值或拆分  
10. **默认命名空间**无 XML 前缀的非标 OOXML 可能解析失败  

## 项目状态

当前为 **v0.4.2**：自研 OONode 解析器替代 xml2js；修复组合展平、颜色修饰符、图案/背景 `bgRef`、边框虚线、媒体重名、表格循环依赖与散点图 `xVal` 等。复杂动画、母版装饰层提取等按 [`design.html`](./design.html) 继续推进，欢迎贡献。

## License

MIT
