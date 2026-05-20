/**
 * ⑥ 资源打包器
 * 复制 media/ 文件，写入退化生成图片。
 */
const fs = require('fs');
const path = require('path');

/**
 * @typedef {object} PackagerInput
 * @property {import('./unpacker').PptxArchive} archive
 * @property {import('./mapper').IntermediateRepresentation} ir
 */

/**
 * 为 zip 内媒体路径生成不冲突的输出文件名
 * @param {string} entryPath 如 ppt/media/image1.png
 * @param {Set<string>} usedDestNames
 */
function uniqueMediaFileName(entryPath, usedDestNames) {
  const base = path.posix.basename(entryPath);
  if (!usedDestNames.has(base)) {
    usedDestNames.add(base);
    return base;
  }
  const ext = path.posix.extname(base);
  const stem = ext ? base.slice(0, -ext.length) : base;
  let n = 2;
  let candidate;
  do {
    candidate = `${stem}_${n}${ext}`;
    n += 1;
  } while (usedDestNames.has(candidate));
  usedDestNames.add(candidate);
  return candidate;
}

/**
 * 将 IR 中图片元素的 mediaPath 对齐到实际写入的文件名
 * @param {import('./mapper').IntermediateRepresentation} ir
 * @param {Map<string, string>} zipToRel zip 路径 → media/xxx.png
 */
function applyMediaPathsToIR(ir, zipToRel) {
  if (!ir?.slides) return;
  for (const slide of ir.slides) {
    for (const el of slide.elements) {
      if (el.type === 'image' && el.zipPath && zipToRel.has(el.zipPath)) {
        el.mediaPath = zipToRel.get(el.zipPath);
      }
    }
  }
}

/**
 * @param {PackagerInput} input
 * @param {string} outputDir
 * @param {{ noMedia?: boolean }} options
 * @returns {Promise<{ written: string[], zipToRel: Map<string, string> }>}
 */
async function packageMedia(input, outputDir, options = {}) {
  /** @type {Map<string, string>} */
  const zipToRel = new Map();

  if (options.noMedia) {
    return { written: [], zipToRel };
  }

  const mediaDir = path.join(outputDir, 'media');
  fs.mkdirSync(mediaDir, { recursive: true });

  const written = [];
  const usedDestNames = new Set();
  const { zip } = input.archive;

  for (const [entryPath, entry] of Object.entries(zip.files)) {
    if (entry.dir) continue;
    if (!entryPath.startsWith('ppt/media/')) continue;

    const destName = uniqueMediaFileName(entryPath, usedDestNames);
    const relPath = path.posix.join('media', destName);
    zipToRel.set(entryPath, relPath);

    const dest = path.join(outputDir, relPath);
    const data = await entry.async('nodebuffer');
    fs.writeFileSync(dest, data);
    written.push(relPath);
  }

  applyMediaPathsToIR(input.ir, zipToRel);
  return { written, zipToRel };
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

module.exports = {
  packageMedia,
  applyMediaPathsToIR,
  uniqueMediaFileName,
  writeConversionLog,
  writeOutputReadme,
};
