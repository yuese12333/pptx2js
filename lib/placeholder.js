/**
 * 母版 / 版式占位符继承（design.html §4.1）
 * 优先级：slide → slideLayout → slideMaster
 */
const { attr, child, children, documentRoot } = require('./xml-utils');

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
  const root = documentRoot(doc, 'p:sld', 'p:sldLayout', 'p:sldMaster');
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
  for (const sp of children(spTree, 'p:sp')) {
    yield sp;
  }
  for (const grp of children(spTree, 'p:grpSp')) {
    yield* walkAllSp(grp);
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
    'a:off',
    layers.map((x) => child(x, 'a:off')),
    ['x', 'y']
  );
  const ext = mergeXfrmPart(
    'a:ext',
    layers.map((x) => child(x, 'a:ext')),
    ['cx', 'cy'],
    { skipZero: true }
  );

  if (!off && !ext) return null;
  return {
    tag: 'a:xfrm',
    attrs: {},
    children: [
      off ?? makeXfrmPart('a:off', { x: '0', y: '0' }),
      ext ?? makeXfrmPart('a:ext', { cx: '0', cy: '0' }),
    ],
    text: '',
  };
}

/**
 * @param {string} tag
 * @param {(object|null|undefined)[]} parts
 * @param {string[]} attrNames
 * @param {{ skipZero?: boolean }} [opts]
 * @returns {import('./xml-parser').OONode|null}
 */
function mergeXfrmPart(tag, parts, attrNames, opts = {}) {
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
  return makeXfrmPart(tag, values);
}

/**
 * @param {string} tag
 * @param {Record<string, string>} attrs
 * @returns {import('./xml-parser').OONode}
 */
function makeXfrmPart(tag, attrs) {
  return { tag, attrs, children: [], text: '' };
}

/**
 * @param {import('./xml-parser').OONode} node
 * @returns {import('./xml-parser').OONode}
 */
function cloneNode(node) {
  return {
    tag: node.tag,
    attrs: { ...node.attrs },
    children: node.children.map(cloneNode),
    text: node.text,
  };
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
 * @param {import('./xml-parser').OONode} slide p:sld
 * @returns {boolean}
 */
function shouldShowMasterShapes(slide) {
  const v = attr(slide, 'showMasterSp');
  if (v === '0' || v === 'false') return false;
  return true;
}

/**
 * 从 txBody 的 lstStyle / endParaRPr 取默认 run 样式
 * @param {object|null|undefined} txBody
 * @returns {import('./xml-parser').OONode|null}
 */
function getDefaultRPrFromTxBody(txBody) {
  if (!txBody) return null;

  const lstStyle = child(txBody, 'a:lstStyle');
  if (lstStyle) {
    for (let lvl = 1; lvl <= 9; lvl++) {
      const lvlPPr = child(lstStyle, `a:lvl${lvl}pPr`);
      const defRPr = lvlPPr && child(lvlPPr, 'a:defRPr');
      if (defRPr) return defRPr;
    }
    const defPPr = child(lstStyle, 'a:defPPr');
    const defRPr = defPPr && child(defPPr, 'a:defRPr');
    if (defRPr) return defRPr;
  }

  const firstP = children(txBody, 'a:p')[0];
  if (firstP) {
    const endRPr = child(firstP, 'a:endParaRPr');
    if (endRPr) return endRPr;
    const firstR = children(firstP, 'a:r')[0];
    if (firstR) {
      const rPr = child(firstR, 'a:rPr');
      if (rPr) return rPr;
    }
  }
  return null;
}

/**
 * @param {import('./xml-parser').OONode|null|undefined} slideRPr
 * @param {import('./xml-parser').OONode} fallbackRPr
 * @returns {import('./xml-parser').OONode}
 */
function mergeRPrAttrs(slideRPr, fallbackRPr) {
  if (!fallbackRPr) return slideRPr;
  if (!slideRPr) return cloneNode(fallbackRPr);

  const merged = cloneNode(slideRPr);
  for (const [k, v] of Object.entries(fallbackRPr.attrs)) {
    if (merged.attrs[k] == null || merged.attrs[k] === '') {
      merged.attrs[k] = v;
    }
  }
  for (const fc of fallbackRPr.children) {
    if (!child(merged, fc.tag)) {
      merged.children.push(cloneNode(fc));
    }
  }
  return merged;
}

/**
 * 合并 txBody：补全 lstStyle 与 layout/master 的 defRPr
 * @param {object} slideTxBody
 * @param {object|null} layoutSp
 * @param {object|null} masterSp
 * @returns {object}
 */
function mergeTxBody(slideTxBody, layoutSp, masterSp) {
  const fallbackBody =
    (layoutSp && child(layoutSp, 'p:txBody')) ||
    (masterSp && child(masterSp, 'p:txBody'));

  const merged = cloneNode(slideTxBody);

  if (fallbackBody) {
    const fallbackLst = child(fallbackBody, 'a:lstStyle');
    if (fallbackLst && !child(merged, 'a:lstStyle')) {
      merged.children.unshift(cloneNode(fallbackLst));
    }
  }

  const fallbackRPr = fallbackBody
    ? getDefaultRPrFromTxBody(fallbackBody)
    : null;
  if (!fallbackRPr) return merged;

  for (const p of children(merged, 'a:p')) {
    for (const r of children(p, 'a:r')) {
      const rPr = child(r, 'a:rPr');
      const mergedRPr = mergeRPrAttrs(rPr, fallbackRPr);
      if (rPr) {
        const idx = r.children.findIndex((c) => c.tag === 'a:rPr');
        r.children[idx] = mergedRPr;
      } else {
        r.children.unshift(mergedRPr);
      }
    }
    const endRPr = child(p, 'a:endParaRPr');
    if (endRPr) {
      const idx = p.children.findIndex((c) => c.tag === 'a:endParaRPr');
      p.children[idx] = mergeRPrAttrs(endRPr, fallbackRPr);
    }
  }
  return merged;
}

/**
 * 按级别读取 lstStyle 中的 defRPr（lvl1pPr → 索引 0）
 * @param {object|null|undefined} txBody
 * @returns {Record<number, import('./xml-parser').OONode>}
 */
function getLstStyleDefRPrByLevel(txBody) {
  /** @type {Record<number, import('./xml-parser').OONode>} */
  const byLevel = {};
  const lstStyle = txBody && child(txBody, 'a:lstStyle');
  if (!lstStyle) return byLevel;

  for (let lvl = 1; lvl <= 9; lvl++) {
    const lvlPPr = child(lstStyle, `a:lvl${lvl}pPr`);
    const defRPr = lvlPPr && child(lvlPPr, 'a:defRPr');
    if (defRPr) byLevel[lvl - 1] = defRPr;
  }
  const defPPr = child(lstStyle, 'a:defPPr');
  const defRPr = defPPr && child(defPPr, 'a:defRPr');
  if (defRPr && byLevel[0] == null) byLevel[0] = defRPr;
  return byLevel;
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
  mergeRPrAttrs,
  getDefaultRPrFromTxBody,
  getLstStyleDefRPrByLevel,
  shouldShowMasterShapes,
  getSpTree,
};
