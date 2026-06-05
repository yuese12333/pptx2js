/**
 * 文本 run 提取（从 extractor 拆出，避免 extractor ↔ table 循环依赖）
 */
const { attr, child, childNodes, children, textContent } = require('./xml-utils');
const {
  resolveFillColor,
  resolveColorFromContainer,
} = require('./color');
const { compressTextRuns } = require('./run-utils');
const {
  getLstStyleDefRPrByLevel,
  mergeRPrAttrs,
} = require('./placeholder');

const PARA_ALIGN_MAP = {
  l: 'left',
  ctr: 'center',
  r: 'right',
  just: 'justify',
  dist: 'justify',
};

const BODY_ANCHOR_VALIGN = {
  t: 'top',
  ctr: 'middle',
  b: 'bottom',
  just: 'middle',
};

/**
 * @param {object} txBody a:txBody
 * @param {Record<string, string>} scheme
 * @param {{ relIndex?: import('./rels').RelationIndex, slidePath?: string }|null} linkCtx
 */
function extractTextRuns(txBody, scheme, linkCtx) {
  const runs = [];
  const bodyParaOpts = extractBodyPrParaOptions(txBody);
  const defRPrByLevel = getLstStyleDefRPrByLevel(txBody);
  const defaultFontSize =
    bodyParaOpts._defaultFontSize ??
    runFontSizeFromDefRPr(defRPrByLevel[0]);
  const paragraphs = children(txBody, 'a:p');

  for (let pi = 0; pi < paragraphs.length; pi++) {
    const p = paragraphs[pi];
    let currentPPr = null;
    let firstPPr = null;

    for (const node of childNodes(p)) {
      if (node.tag === 'a:pPr') {
        currentPPr = node;
        if (!firstPPr) firstPPr = node;
        continue;
      }

      const pPr = currentPPr ?? firstPPr;
      const paraOpts = {
        ...bodyParaOpts,
        ...extractParaOptions(pPr, defaultFontSize),
      };
      delete paraOpts._defaultFontSize;
      const bullet0 = extractBullet(firstPPr);
      const bullet = extractBullet(pPr) ?? bullet0;

      const lvl = Math.max(0, Math.min(8, paraOpts.indentLevel ?? 0));
      if (paraOpts.indentLevel != null) paraOpts.indentLevel = lvl;
      const defRPr =
        defRPrByLevel[lvl] ?? defRPrByLevel[0] ?? null;

      if (node.tag === 'a:r') {
        const text = textContent(child(node, 'a:t'));
        if (!text) continue;
        const rPr = mergeRPrAttrs(child(node, 'a:rPr'), defRPr);
        const options = extractRunOptions(rPr, scheme, linkCtx);
        Object.assign(options, paraOpts);
        if (bullet) Object.assign(options, bullet);
        runs.push({ text, options, degraded: options._degraded });
      } else if (node.tag === 'a:fld') {
        const text = textContent(child(node, 'a:t'));
        if (!text) continue;
        const rPr = mergeRPrAttrs(child(node, 'a:rPr'), defRPr);
        const options = extractRunOptions(rPr, scheme, linkCtx);
        Object.assign(options, paraOpts);
        runs.push({ text, options, degraded: options._degraded });
      } else if (node.tag === 'a:br') {
        runs.push({ text: '\n', options: { ...paraOpts }, degraded: false });
      }
    }

    if (pi < paragraphs.length - 1) {
      const last = runs[runs.length - 1];
      if (!last || !last.text.endsWith('\n')) {
        const paraOpts = {
          ...bodyParaOpts,
          ...extractParaOptions(firstPPr, defaultFontSize),
        };
        delete paraOpts._defaultFontSize;
        if (extractBullet(firstPPr)) delete paraOpts.bullet;
        runs.push({ text: '\n', options: { ...paraOpts }, degraded: false });
      }
    }
  }
  return compressTextRuns(runs);
}

/**
 * @param {import('./xml-parser').OONode|null|undefined} defRPr
 * @returns {number|undefined}
 */
function runFontSizeFromDefRPr(defRPr) {
  if (!defRPr) return undefined;
  const sz = attr(defRPr, 'sz');
  return sz ? parseInt(sz, 10) / 100 : undefined;
}

/**
 * @param {object|null|undefined} txBody
 */
function extractBodyPrParaOptions(txBody) {
  if (!txBody) return {};
  const bodyPr = child(txBody, 'a:bodyPr');
  const lstStyle = child(txBody, 'a:lstStyle');
  const defPPr = lstStyle && child(lstStyle, 'a:defPPr');
  const defRPr = defPPr && child(defPPr, 'a:defRPr');
  const fontSize = runFontSizeFromDefRPr(defRPr);
  const opts = defPPr ? extractParaOptions(defPPr, fontSize) : {};
  if (fontSize != null) opts._defaultFontSize = fontSize;
  return opts;
}

/**
 * 文本框级 bodyPr → PptxGenJS addText 选项
 * @param {object|null|undefined} txBody
 * @returns {{ valign?: string, wrap?: boolean }}
 */
function extractTextBodyPr(txBody) {
  if (!txBody) return {};
  const bodyPr = child(txBody, 'a:bodyPr');
  if (!bodyPr) return {};

  const out = {};
  const anchor = attr(bodyPr, 'anchor');
  if (anchor && BODY_ANCHOR_VALIGN[anchor]) {
    out.valign = BODY_ANCHOR_VALIGN[anchor];
  }
  if (attr(bodyPr, 'wrap') === 'none') out.wrap = false;

  return out;
}

/**
 * @param {object|null|undefined} spcParent a:spcBef | a:spcAft | a:lnSpc
 * @param {number|undefined} fontSizePt
 * @returns {number|undefined} 点数
 */
function readSpacingPt(spcParent, fontSizePt) {
  if (!spcParent) return undefined;
  const spcPts = child(spcParent, 'a:spcPts');
  if (spcPts) {
    const val = attr(spcPts, 'val');
    return val ? parseInt(val, 10) / 100 : undefined;
  }
  const spcPct = child(spcParent, 'a:spcPct');
  if (spcPct && fontSizePt) {
    const val = attr(spcPct, 'val');
    if (!val) return undefined;
    return (fontSizePt * parseInt(val, 10)) / 100000;
  }
  return undefined;
}

/**
 * @param {object|null|undefined} pPr
 * @param {number|undefined} [defaultFontSizePt]
 */
function extractParaOptions(pPr, defaultFontSizePt) {
  if (!pPr) return {};
  const node = pPr;
  const opts = {};

  const algn = attr(node, 'algn');
  if (algn && PARA_ALIGN_MAP[algn]) opts.align = PARA_ALIGN_MAP[algn];

  const lvl = attr(node, 'lvl');
  if (lvl) opts.indentLevel = parseInt(lvl, 10);

  const defRPr = child(node, 'a:defRPr');
  const fontSize = runFontSizeFromDefRPr(defRPr) ?? defaultFontSizePt;

  const spcBef = readSpacingPt(child(node, 'a:spcBef'), fontSize);
  if (spcBef != null) opts.paraSpaceBefore = spcBef;

  const spcAft = readSpacingPt(child(node, 'a:spcAft'), fontSize);
  if (spcAft != null) opts.paraSpaceAfter = spcAft;

  const lnSpc = readSpacingPt(child(node, 'a:lnSpc'), fontSize);
  if (lnSpc != null) opts.lineSpacing = lnSpc;

  return opts;
}

/**
 * @param {object|null|undefined} pPr
 */
function extractBullet(pPr) {
  if (!pPr) return null;
  if (child(pPr, 'a:buChar')) return { bullet: true };
  if (child(pPr, 'a:buAutoNum')) return { bullet: { type: 'number' } };
  return null;
}

/**
 * @param {object|null|undefined} rPr
 * @param {Record<string, string>} scheme
 * @param {{ relIndex?: import('./rels').RelationIndex, slidePath?: string }|null} linkCtx
 */
function extractRunOptions(rPr, scheme, linkCtx) {
  const options = {};
  let degraded = false;
  if (!rPr) return options;

  const sz = attr(rPr, 'sz');
  if (sz) options.fontSize = parseInt(sz, 10) / 100;
  const bVal = attr(rPr, 'b');
  if (bVal === '1' || bVal === 'true') options.bold = true;
  const iVal = attr(rPr, 'i');
  if (iVal === '1' || iVal === 'true') options.italic = true;

  const u = attr(rPr, 'u');
  if (u && u !== 'none') options.underline = { style: 'sng' };

  const face = attr(child(rPr, 'a:latin'), 'typeface');
  if (face) options.fontFace = face;

  const solid = child(rPr, 'a:solidFill');
  const grad = child(rPr, 'a:gradFill');
  if (grad) {
    degraded = true;
    const g = resolveFillColor(grad, scheme);
    if (g.color) options.color = g.color;
  } else if (solid) {
    const c = resolveColorFromContainer(solid, scheme);
    if (c) options.color = c;
  }

  const hlink = child(rPr, 'a:hlinkClick');
  if (hlink && linkCtx) {
    const relId = attr(hlink, 'r:id');
    const url = relId && linkCtx.relIndex.resolve(linkCtx.slidePath, relId);
    if (url) options.hyperlink = { url };
  }

  if (degraded) options._degraded = true;
  return options;
}

module.exports = {
  extractTextRuns,
  extractTextBodyPr,
  extractParaOptions,
  extractRunOptions,
  readSpacingPt,
};
