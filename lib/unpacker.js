/**
 * ① 解压与索引
 * JSZip 解压 PPTX，建立文件清单。
 */
const fs = require('fs');
const JSZip = require('jszip');

/**
 * @typedef {object} PptxArchive
 * @property {JSZip} zip
 * @property {Map<string, string>} files - 路径 → 文本内容或 __binary__
 */

/**
 * @param {string} filePath
 * @returns {Promise<PptxArchive>}
 */
async function unpack(filePath) {
  const buffer = fs.readFileSync(filePath);
  const zip = await JSZip.loadAsync(buffer);

  /** @type {Map<string, string>} */
  const files = new Map();
  for (const [entryPath, entry] of Object.entries(zip.files)) {
    if (entry.dir) continue;
    const isText =
      entryPath.endsWith('.xml') ||
      entryPath.endsWith('.rels') ||
      entryPath.includes('[Content_Types]');
    if (isText) {
      files.set(entryPath, await entry.async('string'));
    } else {
      files.set(entryPath, '__binary__');
    }
  }

  return { zip, files };
}

module.exports = { unpack };
