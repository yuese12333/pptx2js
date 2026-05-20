/**
 * 文本 run 提取（从 extractor 拆出，避免 extractor ↔ table 循环依赖）
 */
const { attr, child, childNodes, children, textContent } = require('./xml-utils');
const {
  resolveFillColor,
  resolveColorFromContainer,
} = require('./utils/color');
const { compressTextRuns } = require('./run-utils');

const PARA_ALIGN_MAP = {
  l: 'left',
  ctr: 'center',
  r: 'right',
  just: 'justify',
  dist: 'justify',
};

/**
 * @param {object} txBody a:txBody
 * @param {Record<string, string>} scheme
 * @param {{ relIndex?: import('./rels').RelationIndex, slidePath?: string }|null} linkCtx
 */
function extractTextRuns(txBody, scheme, linkCtx) {
  const runs = [];
  const bodyParaOpts = extractBodyPrParaOptions(txBody);
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
      const paraOpts = { ...bodyParaOpts, ...extractParaOptions(pPr) };
      const bullet0 = extractBullet(firstPPr);
      const bullet = extractBullet(pPr) ?? bullet0;

      if (node.tag === 'a:r') {
        const text = textContent(child(node, 'a:t'));
        if (!text) continue;
        const options = extractRunOptions(child(node, 'a:rPr'), scheme, linkCtx);
        Object.assign(options, paraOpts);
        if (bullet) Object.assign(options, bullet);
        runs.push({ text, options, degraded: options._degraded });
      } else if (node.tag === 'a:fld') {
        const text = textContent(child(node, 'a:t'));
        if (!text) continue;
        const options = extractRunOptions(child(node, 'a:rPr'), scheme, linkCtx);
        Object.assign(options, paraOpts);
        runs.push({ text, options, degraded: options._degraded });
      } else if (node.tag === 'a:br') {
        runs.push({ text: '\n', options: { ...paraOpts }, degraded: false });
      }
    }

    if (pi < paragraphs.length - 1) {
      const last = runs[runs.length - 1];
      if (!last || !last.text.endsWith('\n')) {
        const paraOpts = { ...bodyParaOpts, ...extractParaOptions(firstPPr) };
        if (extractBullet(firstPPr)) delete paraOpts.bullet;
        runs.push({ text: '\n', options: { ...paraOpts }, degraded: false });
      }
    }
  }
  return compressTextRuns(runs);
}

/**
 * @param {object|null|undefined} txBody
 */
function extractBodyPrParaOptions(txBody) {
  if (!txBody) return {};
  const lstStyle = child(txBody, 'a:lstStyle');
  const defPPr = lstStyle && child(lstStyle, 'a:defPPr');
  return defPPr ? extractParaOptions(defPPr) : {};
}

/**
 * @param {object|null|undefined} pPr
 */
function extractParaOptions(pPr) {
  if (!pPr) return {};
  const node = pPr;
  const opts = {};

  const algn = attr(node, 'algn');
  if (algn && PARA_ALIGN_MAP[algn]) opts.align = PARA_ALIGN_MAP[algn];

  const lvl = attr(node, 'lvl');
  if (lvl) opts.indentLevel = parseInt(lvl, 10);

  const spcBef = attr(child(child(node, 'a:spcBef'), 'a:spcPts'), 'val');
  if (spcBef) opts.paraSpaceBefore = parseInt(spcBef, 10) / 100;

  const spcAft = attr(child(child(node, 'a:spcAft'), 'a:spcPts'), 'val');
  if (spcAft) opts.paraSpaceAfter = parseInt(spcAft, 10) / 100;

  const lnSpc = attr(child(child(node, 'a:lnSpc'), 'a:spcPts'), 'val');
  if (lnSpc) opts.lineSpacing = parseInt(lnSpc, 10) / 100;

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
  if (attr(rPr, 'b') === '1') options.bold = true;
  if (attr(rPr, 'i') === '1') options.italic = true;

  const u = attr(rPr, 'u');
  if (u && u !== 'none') options.underline = { style: 'sng' };

  const face = attr(child(rPr, 'a:latin'), 'typeface');
  if (face) options.fontFace = face;

  const solid = child(rPr, 'a:solidFill');
  const grad = child(rPr, 'a:gradFill');
  if (grad) {
    degraded = true;
    const g = resolveFillColor({ 'a:gradFill': grad }, scheme);
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
  extractParaOptions,
  extractRunOptions,
};
