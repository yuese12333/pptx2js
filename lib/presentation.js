/**
 * presentation.xml：幻灯片列表与版面尺寸
 */
const { attr, child, children, documentRoot } = require('./xml-utils');
const { emuToInch } = require('./bounds');

const PRESENTATION_PATH = 'ppt/presentation.xml';

/**
 * @param {Record<string, object>} parsed
 * @param {import('./rels').RelationIndex} relIndex
 * @returns {string[]}
 */
function getSlidePaths(parsed, relIndex) {
  const doc = parsed[PRESENTATION_PATH];
  const pres = documentRoot(doc, 'p:presentation');
  if (!pres) return [];

  const sldIds = children(child(pres, 'p:sldIdLst'), 'p:sldId');
  const paths = [];
  for (const sldId of sldIds) {
    const relId = attr(sldId, 'r:id');
    if (!relId) continue;
    const target = relIndex.resolve(PRESENTATION_PATH, relId);
    if (target) paths.push(target);
  }
  return paths;
}

/**
 * @param {Record<string, object>} parsed
 * @returns {{ width: number, height: number }}
 */
function getSlideSizeInches(parsed) {
  const pres = documentRoot(parsed[PRESENTATION_PATH], 'p:presentation');
  const sldSz = child(pres, 'p:sldSz');
  const cx = parseInt(attr(sldSz, 'cx') ?? '9144000', 10);
  const cy = parseInt(attr(sldSz, 'cy') ?? '6858000', 10);
  return {
    width: round3(emuToInch(cx)),
    height: round3(emuToInch(cy)),
  };
}

/**
 * @param {Record<string, object>} parsed
 * @param {import('./rels').RelationIndex} relIndex
 * @returns {string|null}
 */
function getThemePath(parsed, relIndex) {
  const themeRel = relIndex
    .list(PRESENTATION_PATH)
    .find((r) => r.type && r.type.includes('/relationships/theme'));
  return themeRel?.target ?? null;
}

/**
 * @param {number} n
 * @returns {number}
 */
function round3(n) {
  return Math.round(n * 1000) / 1000;
}

module.exports = {
  PRESENTATION_PATH,
  getSlidePaths,
  getSlideSizeInches,
  getThemePath,
};
