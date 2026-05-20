/**
 * OOXML 关系（.rels）解析与路径解析
 */
const path = require('path');
const { asArray, attr } = require('./xml-utils');

/**
 * @typedef {object} Relationship
 * @property {string} id
 * @property {string} type
 * @property {string} target
 */

/**
 * @typedef {object} RelationIndex
 * @property {(sourcePath: string, relId: string) => string|null} resolve
 * @property {(sourcePath: string) => Relationship[]} list
 */

/**
 * .rels 文件路径 → 所属部件路径
 * @param {string} relsPath 如 ppt/slides/_rels/slide1.xml.rels
 * @returns {string}
 */
function relsOwnerPath(relsPath) {
  const normalized = relsPath.replace(/\\/g, '/');
  // 包根关系：_rels/.rels → owner 为包根（空路径）
  if (normalized === '_rels/.rels') {
    return '';
  }

  const parts = normalized.split('/');
  const relFile = parts.pop();
  parts.pop(); // _rels
  const ownerFile = relFile.replace(/\.rels$/i, '');
  parts.push(ownerFile);
  return parts.join('/');
}

/**
 * @param {string} ownerPath
 * @param {string} target
 * @returns {string}
 */
/**
 * @param {Relationship} rel
 */
function isExternalTarget(rel) {
  if (rel.targetMode === 'External') return true;
  return /^(https?|mailto|ftp):/i.test(rel.target);
}

function resolveTargetPath(ownerPath, target) {
  if (!ownerPath) {
    return path.posix.normalize(target);
  }
  const ownerDir = path.posix.dirname(ownerPath);
  return path.posix.normalize(path.posix.join(ownerDir, target));
}

/**
 * @param {object} relsDoc xml2js 解析结果
 * @returns {Relationship[]}
 */
function parseRelationships(relsDoc) {
  const root = relsDoc?.Relationships ?? relsDoc;
  const rels = asArray(root?.Relationship);
  return rels
    .map((rel) => ({
      id: attr(rel, 'Id'),
      type: attr(rel, 'Type'),
      target: attr(rel, 'Target'),
      targetMode: attr(rel, 'TargetMode'),
    }))
    .filter((r) => r.id && r.target);
}

/**
 * @param {Record<string, object>} parsed
 * @returns {RelationIndex}
 */
function buildRelationIndex(parsed) {
  /** @type {Map<string, Map<string, Relationship>>} */
  const bySource = new Map();

  for (const [filePath, doc] of Object.entries(parsed)) {
    if (!filePath.endsWith('.rels')) continue;
    const owner = relsOwnerPath(filePath);
    const relationships = parseRelationships(doc);
    const map = new Map();
    for (const rel of relationships) {
      const target = isExternalTarget(rel)
        ? rel.target
        : resolveTargetPath(owner, rel.target);
      map.set(rel.id, { ...rel, target });
    }
    bySource.set(owner, map);
  }

  return {
    resolve(sourcePath, relId) {
      const rel = bySource.get(sourcePath)?.get(relId);
      return rel?.target ?? null;
    },
    list(sourcePath) {
      const map = bySource.get(sourcePath);
      return map ? Array.from(map.values()) : [];
    },
  };
}

module.exports = {
  relsOwnerPath,
  resolveTargetPath,
  parseRelationships,
  buildRelationIndex,
};
