/**
 * ⑤ 代码生成器
 * 将 IR 序列化为可运行的 PptxGenJS 脚本（自实现缩进拼接，不依赖 Prettier）。
 */

/**
 * @param {import('./mapper').IntermediateRepresentation} ir
 * @param {object} _options
 * @returns {string}
 */
function generateScript(ir, _options) {
  const slideCount = ir.slides.length;
  const lines = [
    "const PptxGenJS = require('pptxgenjs');",
    '',
    'async function main() {',
    '  const pptx = new PptxGenJS();',
    '',
    `  // TODO: ${slideCount} slide(s) — conversion pipeline not yet implemented`,
    '',
    "  await pptx.writeFile({ fileName: 'output.pptx' });",
    '}',
    '',
    'main().catch((err) => {',
    '  console.error(err);',
    '  process.exit(1);',
    '});',
    '',
  ];
  return lines.join('\n');
}

module.exports = { generateScript };
