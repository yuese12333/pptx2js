/**
 * ③ 实体提取器
 */
const path = require('path');
const { asArray, attr, child, textContent } = require('./xml-utils');
const { boundsFromXfrm } = require('./utils/bounds');
const {
  loadColorScheme,
  resolveFillColor,
  resolveColorFromContainer,
} = require('./utils/color');
const { getSlidePaths, getThemePath } = require('./presentation');
const {
  buildSlideInheritance,
  getEffectiveXfrm,
  mergeTxBody,
  resolvePlaceholderSps,
} = require('./placeholder');
const { isTableFrame, isChartFrame, isSmartArtFrame } = require('./graphic');
const { extractTable } = require('./table');
const { extractChart } = require('./chart');
const { extractSmartArt } = require('./smartart');

/** @typedef {'FULL' | 'DEGRADE' | 'SKIP'} ConversionDecision */

/**
 * @typedef {object} SlideEntity
 * @property {number} slideIndex
 * @property {string} slidePath
 * @property {ConversionDecision} decision
 * @property {string} kind
 * @property {import('./utils/bounds').Bounds} bounds
 * @property {object} [text]
 * @property {object} [image]
 * @property {object} [shape]
 * @property {object} [table]
 * @property {object} [chart]
 * @property {string} [skipReason]
 * @property {string} [degradeReason]
 */

const PRST_TO_SHAPE = {
  rect: 'RECTANGLE',
  roundRect: 'ROUNDED_RECTANGLE',
  ellipse: 'OVAL',
  line: 'LINE',
  triangle: 'TRIANGLE',
  rtTriangle: 'RIGHT_TRIANGLE',
  diamond: 'DIAMOND',
  pentagon: 'PENTAGON',
  hexagon: 'HEXAGON',
  star5: 'STAR5',
};

/**
 * @typedef {object} ExtractContext
 * @property {Record<string, object>} parsed
 * @property {import('./rels').RelationIndex} relIndex
 * @property {string} [sourcePath]
 */

/**
 * @param {ExtractContext} ctx
 * @returns {SlideEntity[][]}
 */
function extractEntities(ctx) {
  const { parsed, relIndex } = ctx;
  const themePath = getThemePath(parsed, relIndex);
  const scheme = loadColorScheme(parsed, themePath);
  const slidePaths = getSlidePaths(parsed, relIndex);

  return slidePaths.map((slidePath, slideIndex) =>
    extractSlide(slidePath, slideIndex, ctx, scheme)
  );
}

/**
 * @param {string} slidePath
 * @param {number} slideIndex
 * @param {ExtractContext} ctx
 * @param {Record<string, string>} scheme
 */
function extractSlide(slidePath, slideIndex, ctx, scheme) {
  const doc = ctx.parsed[slidePath];
  const slide = child(doc, 'p:sld');
  const cSld = child(slide, 'p:cSld');
  const spTree = child(cSld, 'p:spTree');
  if (!spTree) return [];

  const inheritance = buildSlideInheritance(ctx.parsed, ctx.relIndex, slidePath);

  /** @type {SlideEntity[]} */
  const entities = [];

  const bg = extractSlideBackground(cSld, scheme);
  if (bg) {
    entities.push({
      slideIndex,
      slidePath,
      decision: bg.degraded ? 'DEGRADE' : 'FULL',
      kind: 'background',
      bounds: { x: 0, y: 0, w: 0, h: 0 },
      shape: { type: 'background', fill: bg.color },
      degradeReason: bg.degraded ? '渐变背景退化为纯色' : undefined,
    });
  }

  const walkCtx = {
    slideIndex,
    slidePath,
    relIndex: ctx.relIndex,
    parsed: ctx.parsed,
    scheme,
    inheritance,
    offset: { x: 0, y: 0 },
    entities,
  };

  walkSpTree(spTree, walkCtx);
  return entities;
}

function extractSlideBackground(cSld, scheme) {
  const bgPr = child(child(cSld, 'p:bg'), 'p:bgPr');
  if (!bgPr) return null;
  const { color, degraded } = resolveFillColor(bgPr, scheme);
  if (!color) return null;
  return { color, degraded };
}

function walkSpTree(spTree, ctx) {
  for (const sp of asArray(spTree['p:sp'])) {
    extractShape(sp, ctx);
  }
  for (const pic of asArray(spTree['p:pic'])) {
    extractPicture(pic, ctx);
  }
  for (const grp of asArray(spTree['p:grpSp'])) {
    flattenGroup(grp, ctx);
  }
  for (const frame of asArray(spTree['p:graphicFrame'])) {
    if (isTableFrame(frame)) {
      const entity = extractTable(frame, ctx);
      if (entity) ctx.entities.push(entity);
    } else if (isChartFrame(frame)) {
      const entity = extractChart(frame, ctx);
      if (entity) ctx.entities.push(entity);
    } else if (isSmartArtFrame(frame)) {
      const entity = extractSmartArt(frame, ctx);
      if (entity) ctx.entities.push(entity);
    } else {
      skipElement(frame, ctx, '不支持的 graphicFrame 类型');
    }
  }
  for (const cxn of asArray(spTree['p:cxnSp'])) {
    extractConnector(cxn, ctx);
  }
}

function flattenGroup(grp, ctx) {
  const grpXfrm = child(child(grp, 'p:grpSpPr'), 'a:xfrm');
  const off = readOffset(grpXfrm);
  const inner = child(grp, 'p:spTree');
  if (!inner) return;
  walkSpTree(inner, {
    ...ctx,
    offset: { x: ctx.offset.x + off.x, y: ctx.offset.y + off.y },
  });
}

function extractShape(sp, ctx) {
  const xfrm = getEffectiveXfrm(sp, ctx.inheritance);
  const bounds = boundsFromXfrm(xfrm, ctx.offset);

  const { layoutSp, masterSp } = resolvePlaceholderSps(sp, ctx.inheritance);
  const txBodyRaw = child(sp, 'p:txBody');

  if (txBodyRaw) {
    const txBody = mergeTxBody(txBodyRaw, layoutSp, masterSp);
    const runs = extractTextRuns(txBody, ctx.scheme, {
      relIndex: ctx.relIndex,
      slidePath: ctx.slidePath,
    });
    if (runs.length === 0) return;

    const hasGradient = runs.some((r) => r.degraded);
    ctx.entities.push({
      slideIndex: ctx.slideIndex,
      slidePath: ctx.slidePath,
      decision: hasGradient ? 'DEGRADE' : 'FULL',
      kind: 'text',
      bounds,
      text: { runs: runs.map(({ text, options }) => ({ text, options })) },
      degradeReason: hasGradient ? '文本渐变退化为纯色' : undefined,
    });
    return;
  }

  const spPr = child(sp, 'p:spPr');
  const prst = attr(child(spPr, 'a:prstGeom'), 'prst');
  if (!prst) return;

  const shapeName = PRST_TO_SHAPE[prst];
  const { color: fillColor, degraded: fillDegraded } = resolveFillColor(
    spPr,
    ctx.scheme
  );
  const ln = child(spPr, 'a:ln');
  const lineColor = ln ? resolveFillColor(ln, ctx.scheme).color : null;

  if (!shapeName) {
    ctx.entities.push({
      slideIndex: ctx.slideIndex,
      slidePath: ctx.slidePath,
      decision: 'DEGRADE',
      kind: 'shape',
      bounds,
      shape: { type: 'RECTANGLE', fill: fillColor, line: lineColor },
      degradeReason: `未知预设形状 "${prst}"，退化为矩形`,
    });
    return;
  }

  ctx.entities.push({
    slideIndex: ctx.slideIndex,
    slidePath: ctx.slidePath,
    decision: fillDegraded ? 'DEGRADE' : 'FULL',
    kind: 'shape',
    bounds,
    shape: { type: shapeName, fill: fillColor, line: lineColor },
    degradeReason: fillDegraded ? '渐变填充退化为纯色' : undefined,
  });
}

function extractPicture(pic, ctx) {
  const spPr = child(pic, 'p:spPr');
  const bounds = boundsFromXfrm(child(spPr, 'a:xfrm'), ctx.offset);

  const blip = child(child(pic, 'p:blipFill'), 'a:blip');
  const embedId = attr(blip, 'r:embed');
  if (!embedId) return;

  const mediaPath = ctx.relIndex.resolve(ctx.slidePath, embedId);
  if (!mediaPath) return;

  ctx.entities.push({
    slideIndex: ctx.slideIndex,
    slidePath: ctx.slidePath,
    decision: 'FULL',
    kind: 'image',
    bounds,
    image: {
      zipPath: mediaPath,
      fileName: path.posix.basename(mediaPath),
    },
  });
}

function extractConnector(cxn, ctx) {
  const spPr = child(cxn, 'p:spPr');
  const bounds = boundsFromXfrm(child(spPr, 'a:xfrm'), ctx.offset);
  const { color: lineColor } = resolveFillColor(child(spPr, 'a:ln'), ctx.scheme);

  ctx.entities.push({
    slideIndex: ctx.slideIndex,
    slidePath: ctx.slidePath,
    decision: 'FULL',
    kind: 'shape',
    bounds,
    shape: { type: 'LINE', fill: null, line: lineColor },
  });
}

function skipElement(_node, ctx, reason) {
  ctx.entities.push({
    slideIndex: ctx.slideIndex,
    slidePath: ctx.slidePath,
    decision: 'SKIP',
    kind: 'skip',
    bounds: { x: 0, y: 0, w: 0, h: 0 },
    skipReason: reason,
  });
}

function readOffset(xfrm) {
  const off = child(xfrm, 'a:off');
  return {
    x: parseInt(attr(off, 'x') ?? '0', 10),
    y: parseInt(attr(off, 'y') ?? '0', 10),
  };
}

const PARA_ALIGN_MAP = {
  l: 'left',
  ctr: 'center',
  r: 'right',
  just: 'justify',
  dist: 'justify',
};

function extractTextRuns(txBody, scheme, linkCtx) {
  const runs = [];
  for (const p of asArray(txBody['a:p'])) {
    const pPr = child(p, 'a:pPr');
    const bullet = extractBullet(pPr);
    const paraOpts = extractParaOptions(pPr);

    for (const r of asArray(p['a:r'])) {
      const text = textContent(r['a:t']);
      if (!text) continue;
      const options = extractRunOptions(r['a:rPr'], scheme, linkCtx);
      Object.assign(options, paraOpts);
      if (bullet) Object.assign(options, bullet);
      runs.push({ text, options, degraded: options._degraded });
    }
  }
  return runs;
}

/**
 * @param {object|null|undefined} pPr
 */
function extractParaOptions(pPr) {
  if (!pPr) return {};
  const opts = {};

  const algn = attr(pPr, 'algn');
  if (algn && PARA_ALIGN_MAP[algn]) opts.align = PARA_ALIGN_MAP[algn];

  const lvl = attr(pPr, 'lvl');
  if (lvl) opts.indentLevel = parseInt(lvl, 10);

  // 注：a:spcPct（百分比段前/段后距）暂不处理
  const spcBef = attr(child(child(pPr, 'a:spcBef'), 'a:spcPts'), 'val');
  if (spcBef) opts.paraSpaceBefore = parseInt(spcBef, 10) / 100;

  // 注：a:spcPct（百分比段后距）暂不处理
  const spcAft = attr(child(child(pPr, 'a:spcAft'), 'a:spcPts'), 'val');
  if (spcAft) opts.paraSpaceAfter = parseInt(spcAft, 10) / 100;

  // 注：a:spcPct（百分比行距）暂不处理
  const lnSpc = attr(child(child(pPr, 'a:lnSpc'), 'a:spcPts'), 'val');
  if (lnSpc) opts.lineSpacing = parseInt(lnSpc, 10) / 100;

  return opts;
}

function extractBullet(pPr) {
  if (!pPr) return null;
  if (child(pPr, 'a:buChar')) return { bullet: true };
  if (child(pPr, 'a:buAutoNum')) return { bullet: { type: 'number' } };
  return null;
}

function extractRunOptions(rPr, scheme, linkCtx) {
  const options = {};
  let degraded = false;
  if (!rPr) return options;

  const sz = attr(rPr, 'sz');
  if (sz) options.fontSize = parseInt(sz, 10) / 100;
  if (attr(rPr, 'b') === '1') options.bold = true;
  if (attr(rPr, 'i') === '1') options.italic = true;

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
  extractEntities,
  PRST_TO_SHAPE,
  boundsFromXfrm,
};
