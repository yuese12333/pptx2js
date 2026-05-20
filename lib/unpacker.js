/**
 * ① 解压与索引
 * JSZip 解压 PPTX，建立文件清单；解析 [Content_Types].xml 与 _rels/*.rels。
 */
const fs = require('fs');
const path = require('path');
const JSZip = require('jszip');

/**
 * @typedef {object} PptxArchive
 * @property {JSZip} zip
 * @property {Map<string, string>} files - 路径 → 文本或标记为 binary
 * @property {Map<string, string>} rels - 关系 ID 映射（待实现）
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
    const isXml =
      entryPath.endsWith('.xml') ||
      entryPath.endsWith('.rels') ||
      entryPath.endsWith('[Content_Types].xml');
    if (isXml) {
      files.set(entryPath, await entry.async('string'));
    } else {
      files.set(entryPath, '__binary__');
    }
  }

  return {
    zip,
    files,
    rels: new Map(),
  };
}

/**
 * @param {PptxArchive} archive
 * @returns {Promise<object>} 关系索引（占位，待实现完整 rels 解析）
 */
async function buildRelationIndex(archive) {
  return { archive, rels: archive.rels };
}

module.exports = { unpack, buildRelationIndex };
