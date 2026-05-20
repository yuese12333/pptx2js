# pptx2js

将 **PowerPoint `.pptx`** 文件转换为可直接运行的 **[PptxGenJS](https://github.com/gitbrent/PptxGenJS)** 生成脚本，并附带媒体资源与转换报告。

> 设计文档见 [`design.html`](./design.html)，HTML 版说明见 [`README.html`](./README.html)。

## 核心哲学

**「PptxGenJS 能力边界即转换边界」**

| 层级 | 策略 | 示例 |
|------|------|------|
| 精确转换 | PptxGenJS 原生支持的元素一比一映射 | 文本框、图片、基本形状、表格、图表 |
| 退化转换 | 尽力保留内容，降级为近似表示 | 渐变→纯色、SmartArt→截图或文本列表 |
| 静默跳过 | 记录日志，不中断流程 | ActiveX、OLE、VBA、嵌入字体 |

## 功能特性

- 输入 `.pptx`，输出 `output.js` + `media/` + `conversion.log`
- 同时提供 **CLI** 与 **编程 API**，共用同一套核心逻辑
- 转换报告为 JSON，含 `slideIndex`、`elementBounds`、`severity`，便于 CI 集成
- 仅支持 OOXML（`.pptx`），不做双向转换、不做 GUI

## 安装

```bash
npm install pptx2js
```

本地开发：

```bash
git clone https://github.com/yuese12333/pptx2js.git
cd pptx2js
npm install
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
| `--max-file-size` | 50MB | 超过阈值切换流式解析 |

### 编程 API

```javascript
const { convert } = require('pptx2js');

const result = await convert('./input.pptx', {
  outputDir: './pptx2js-output',
  logLevel: 'info',
});

console.log(result.scriptPath);  // .../output.js
console.log(result.logPath);     // .../conversion.log
```

## 输出目录结构

```
pptx2js-output/
├── output.js          # 主生成脚本，可直接 node 运行
├── media/             # 提取的图片等媒体
├── conversion.log     # JSON 格式转换报告
└── README.md          # 自动生成的说明
```

`conversion.log` 主要字段：`source`、`statistics`、`slides[]`、`degraded[]`、`omitted[]`、`warnings[]`。

## 系统架构

六模块流水线（顺序执行）：

```
input.pptx
  → ① 解压与索引      (lib/unpacker.js)
  → ② XML 预解析      (lib/xml-parser.js)
  → ③ 实体提取器      (lib/extractor.js)
  → ④ 映射引擎        (lib/mapper.js)
  → ⑤ 代码生成器      (lib/codegen.js)
  → ⑥ 资源打包器      (lib/packager.js)
  → output.js + media/ + conversion.log
```

## 技术栈

| 用途 | 选型 |
|------|------|
| ZIP 处理 | [JSZip](https://www.npmjs.com/package/jszip) |
| XML 解析 | [xml2js](https://www.npmjs.com/package/xml2js)（统一配置，见 `lib/xml-parser.js`） |
| CLI | [Commander.js](https://www.npmjs.com/package/commander) |
| 终端输出 | [chalk](https://www.npmjs.com/package/chalk) |
| 测试 | [Jest](https://jestjs.io/) |

代码格式化在生成阶段自实现缩进拼接，不引入 Prettier。

## 开发

```bash
npm test              # 运行单元测试
npm run test:watch    # 监听模式
```

### 目录结构

```
pptx2js/
├── bin/pptx2js.js       # CLI 入口
├── lib/
│   ├── index.js         # 库入口（export convert）
│   ├── convert.js       # 流水线编排
│   ├── unpacker.js      # ① 解压与索引
│   ├── xml-parser.js    # ② XML 统一解析
│   ├── extractor.js     # ③ 实体提取
│   ├── mapper.js        # ④ 映射引擎
│   ├── codegen.js       # ⑤ 代码生成
│   ├── packager.js      # ⑥ 资源打包
│   └── utils/           # EMU、颜色等工具
├── test/
│   ├── unit/
│   └── fixtures/        # 测试用 PPTX / 金标准
└── design.html          # 完整设计文档
```

## 已知局限

1. **字体**依赖运行环境，不负责检测或打包嵌入字体  
2. **动画**统一退化为淡入 0.5s（设计取舍）  
3. **不保证**往返 PPTX 二进制一致，追求视觉可接受  
4. **不支持**密码保护或 `.ppt` 旧格式  
5. **不支持**增量转换，每次全量重写  
6. **大文件**（200MB+）可能内存压力较大，超过 50MB 将启用流式解析（实现中）

## 项目状态

当前为 **v0.1.0 初始化骨架**：流水线模块已就位，核心转换逻辑（实体提取、映射、代码生成）仍在实现中。运行转换会生成占位 `output.js` 与完整输出目录结构，欢迎贡献。

## License

MIT
