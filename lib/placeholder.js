/**
 * 母版 / 版式占位符继承（design.html §4.1）
 * 优先级：slide → slideLayout → slideMaster
 */
const { asArray, attr, child } = require('./xml-utils');

const REL_SLIDE_LAYOUT =
  'http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout';
const REL_SLIDE_MASTER =
  'http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideMaster';

/**
 * @typedef {object} PlaceholderKey
 * @property {string|undefined} idx
 * @property {string|undefined} type
 */

/**
 * @typedef {object} SlideInheritance
 * @property {string} slidePath
 * @property {string|null} layoutPath
 * @property {string|null} masterPath
 * @property {object|null} layoutSpTree
 * @property {object|null} masterSpTree
 */

/**
 * @param {Record<string, object>} parsed
 * @param {import('./rels').RelationIndex} relIndex
 * @param {string} slidePath
 * @returns {SlideInheritance}
 */
function buildSlideInheritance(parsed, relIndex, slidePath) {
  const layoutPath = resolveRelByType(relIndex, slidePath, REL_SLIDE_LAYOUT);
  const masterPath = layoutPath
    ? resolveRelByType(relIndex, layoutPath, REL_SLIDE_MASTER)
    : null;

  const layoutSpTree = layoutPath ? getSpTree(parsed, layoutPath) : null;
  const masterSpTree = masterPath ? getSpTree(parsed, masterPath) : null;

  return {
    slidePath,
    layoutPath,
    masterPath,
    layoutSpTree,
    masterSpTree,
  };
}

/**
 * @param {import('./rels').RelationIndex} relIndex
 * @param {string} sourcePath
 * @param {string} typeFragment
 * @returns {string|null}
 */
function resolveRelByType(relIndex, sourcePath, typeFragment) {
  const rel = relIndex
    .list(sourcePath)
    .find((r) => r.type && r.type.includes(typeFragment));
  return rel?.target ?? null;
}

/**
 * @param {Record<string, object>} parsed
 * @param {string} partPath slide / slideLayout / slideMaster
 * @returns {object|null}
 */
function getSpTree(parsed, partPath) {
  const doc = parsed[partPath];
  if (!doc) return null;
  const root =
    child(doc, 'p:sld') ??
    child(doc, 'p:sldLayout') ??
    child(doc, 'p:sldMaster');
  if (!root) return null;
  return child(child(root, 'p:cSld'), 'p:spTree');
}

/**
 * @param {object} sp
 * @returns {PlaceholderKey|null}
 */
function getPlaceholderKey(sp) {
  const ph = child(child(child(sp, 'p:nvSpPr'), 'p:nvPr'), 'p:ph');
  if (!ph) return null;
  return {
    idx: attr(ph, 'idx'),
    type: attr(ph, 'type'),
  };
}

/**
 * @param {object|null} spTree
 * @param {PlaceholderKey} key
 * @returns {object|null}
 */
function findSpByPlaceholder(spTree, key) {
  if (!spTree || !key) return null;

  for (const sp of walkAllSp(spTree)) {
    const ph = getPlaceholderKey(sp);
    if (!ph) continue;
    if (key.idx != null && ph.idx === key.idx) return sp;
    if (key.type && ph.type === key.type) return sp;
  }
  return null;
}

/**
 * @param {object} spTree
 * @returns {object[]}
 */
function* walkAllSp(spTree) {
  for (const sp of asArray(spTree['p:sp'])) {
    yield sp;
  }
  for (const grp of asArray(spTree['p:grpSp'])) {
    const inner = child(grp, 'p:spTree');
    if (inner) yield* walkAllSp(inner);
  }
}

/**
 * @param {object} slideSp
 * @param {SlideInheritance} inheritance
 * @returns {{ layoutSp: object|null, masterSp: object|null }}
 */
function resolvePlaceholderSps(slideSp, inheritance) {
  const key = getPlaceholderKey(slideSp);
  if (!key) {
    return { layoutSp: null, masterSp: null };
  }

  const layoutSp = inheritance.layoutSpTree
    ? findSpByPlaceholder(inheritance.layoutSpTree, key)
    : null;
  const masterSp = inheritance.masterSpTree
    ? findSpByPlaceholder(inheritance.masterSpTree, key)
    : null;

  return { layoutSp, masterSp };
}

/**
 * 合并 a:xfrm：off 与 ext 各属性独立按 slide → layout → master 继承
 * @param {object|null|undefined} slideXfrm
 * @param {object|null|undefined} layoutXfrm
 * @param {object|null|undefined} masterXfrm
 * @returns {object|null}
 */
function mergeXfrm(slideXfrm, layoutXfrm, masterXfrm) {
  const layers = [slideXfrm, layoutXfrm, masterXfrm];
  const off = mergeXfrmPart(
    layers.map((x) => child(x, 'a:off')),
    ['x', 'y']
  );
  const ext = mergeXfrmPart(
    layers.map((x) => child(x, 'a:ext')),
    ['cx', 'cy'],
    { skipZero: true }
  );

  if (!off && !ext) return null;
  return {
    'a:off': off ?? { $: { x: '0', y: '0' } },
    'a:ext': ext ?? { $: { cx: '0', cy: '0' } },
  };
}

/**
 * @param {(object|null|undefined)[]} parts
 * @param {string[]} attrNames
 * @param {{ skipZero?: boolean }} [opts]
 * @returns {object|null}
 */
function mergeXfrmPart(parts, attrNames, opts = {}) {
  const values = {};
  let hasAny = false;

  for (const name of attrNames) {
    for (const part of parts) {
      if (!part) continue;
      const v = attr(part, name);
      if (v == null || v === '') continue;
      if (opts.skipZero && (name === 'cx' || name === 'cy')) {
        if (parseInt(v, 10) <= 0) continue;
      }
      values[name] = v;
      hasAny = true;
      break;
    }
  }

  if (!hasAny) return null;
  return { $: values };
}

/**
 * @param {object} slideSp
 * @param {SlideInheritance} inheritance
 * @returns {object|null}
 */
function getEffectiveXfrm(slideSp, inheritance) {
  const slideSpPr = child(slideSp, 'p:spPr');
  const { layoutSp, masterSp } = resolvePlaceholderSps(slideSp, inheritance);

  return mergeXfrm(
    child(slideSpPr, 'a:xfrm'),
    layoutSp && child(child(layoutSp, 'p:spPr'), 'a:xfrm'),
    masterSp && child(child(masterSp, 'p:spPr'), 'a:xfrm')
  );
}

/**
 * 合并 txBody 默认样式：用 layout/master 的首段/首 run 补全 slide 层缺失的 rPr
 * @param {object} slideTxBody
 * @param {object|null} layoutSp
 * @param {object|null} masterSp
 * @returns {object}
 */
function mergeTxBody(slideTxBody, layoutSp, masterSp) {
  const slideBody = slideTxBody;
  const fallbackBody =
    (layoutSp && child(layoutSp, 'p:txBody')) ||
    (masterSp && child(masterSp, 'p:txBody'));
  if (!fallbackBody) return slideBody;

  const slideParas = asArray(slideBody['a:p']);
  const fallbackPara = asArray(fallbackBody['a:p'])[0];
  const fallbackRPr = fallbackPara && child(asArray(fallbackPara['a:r'])[0], 'a:rPr');

  if (!fallbackRPr) return slideBody;

  const mergedParas = slideParas.map((p) => {
    const runs = asArray(p['a:r']).map((r) => {
      const rPr = child(r, 'a:rPr');
      if (rPr) return r;
      return { ...r, 'a:rPr': JSON.parse(JSON.stringify(fallbackRPr)) };
    });
    return { ...p, 'a:r': runs.length === 1 ? runs[0] : runs };
  });

  return { ...slideBody, 'a:p': mergedParas.length === 1 ? mergedParas[0] : mergedParas };
}

module.exports = {
  REL_SLIDE_LAYOUT,
  REL_SLIDE_MASTER,
  buildSlideInheritance,
  getPlaceholderKey,
  findSpByPlaceholder,
  resolvePlaceholderSps,
  mergeXfrm,
  getEffectiveXfrm,
  mergeTxBody,
  getSpTree,
};
