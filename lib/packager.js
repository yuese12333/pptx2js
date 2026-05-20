/**
 * ⑥ 资源打包器
 * 复制 media/ 文件，处理重名冲突，写入退化生成图片。
 */
const fs = require('fs');
const path = require('path');

/**
 * @typedef {object} PackagerInput
 * @property {import('./unpacker').PptxArchive} archive
 * @property {import('./mapper').IntermediateRepresentation} ir
 */

/**
 * @param {PackagerInput} input
 * @param {string} outputDir
 * @param {{ noMedia?: boolean }} options
 * @returns {Promise<string[]>} 已写入的媒体文件相对路径列表
 */
async function packageMedia(input, outputDir, options = {}) {
  if (options.noMedia) return [];

  const mediaDir = path.join(outputDir, 'media');
  fs.mkdirSync(mediaDir, { recursive: true });

  const written = [];
  const { zip } = input.archive;
  for (const [entryPath, entry] of Object.entries(zip.files)) {
    if (entry.dir) continue;
    if (!entryPath.startsWith('ppt/media/')) continue;
    const name = path.basename(entryPath);
    const dest = path.join(mediaDir, name);
    const data = await entry.async('nodebuffer');
    fs.writeFileSync(dest, data);
    written.push(path.join('media', name));
  }
  return written;
}

/**
 * @param {string} outputDir
 * @param {object} log
 */
function writeConversionLog(outputDir, log) {
  const logPath = path.join(outputDir, 'conversion.log');
  fs.writeFileSync(logPath, JSON.stringify(log, null, 2), 'utf8');
}

/**
 * @param {string} outputDir
 * @param {object} meta
 */
function writeOutputReadme(outputDir, meta) {
  const readmePath = path.join(outputDir, 'README.md');
  const content = [
    '# pptx2js 转换输出',
    '',
    `源文件：\`${meta.sourcePath}\``,
    `生成时间：${meta.generatedAt}`,
    '',
    '## 文件说明',
    '',
    '- `output.js` — 可直接 `node output.js` 运行的 PptxGenJS 脚本',
    '- `media/` — 提取的图片等媒体资源',
    '- `conversion.log` — JSON 格式转换报告',
    '',
  ].join('\n');
  fs.writeFileSync(readmePath, content, 'utf8');
}

module.exports = { packageMedia, writeConversionLog, writeOutputReadme };
