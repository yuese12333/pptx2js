/**
 * ③ 实体提取器
 */
const path = require('path');
const { attr, child, children, documentRoot } = require('./xml-utils');
const { boundsFromXfrm } = require('./utils/bounds');
const {
  loadColorScheme,
  resolveFillColor,
  resolveColorFromContainer,
} = require('./utils/color');
const { extractTextRuns } = require('./text-utils');
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
  const slide = documentRoot(doc, 'p:sld');
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
  const bg = child(cSld, 'p:bg');
  if (!bg) return null;

  const bgPr = child(bg, 'p:bgPr');
  if (bgPr) {
    const { color, degraded } = resolveFillColor(bgPr, scheme);
    if (color) return { color, degraded };
  }

  const bgRef = child(bg, 'p:bgRef');
  if (bgRef) {
    const fromRef = resolveFillColor(bgRef, scheme);
    if (fromRef.color) return fromRef;
    const schemeColor = resolveColorFromContainer(bgRef, scheme);
    if (schemeColor) return { color: schemeColor, degraded: false };
  }

  return null;
}

function walkSpTree(spTree, ctx) {
  for (const sp of children(spTree, 'p:sp')) {
    extractShape(sp, ctx);
  }
  for (const pic of children(spTree, 'p:pic')) {
    extractPicture(pic, ctx);
  }
  for (const grp of children(spTree, 'p:grpSp')) {
    flattenGroup(grp, ctx);
  }
  for (const frame of children(spTree, 'p:graphicFrame')) {
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
  for (const cxn of children(spTree, 'p:cxnSp')) {
    extractConnector(cxn, ctx);
  }
}

function flattenGroup(grp, ctx) {
  const grpXfrm = child(child(grp, 'p:grpSpPr'), 'a:xfrm');
  const off = readOffset(grpXfrm);
  const chOff = readChOff(grpXfrm);

  // p:grpSp 子节点直接挂在 grp 上，没有 p:spTree 包装
  walkSpTree(grp, {
    ...ctx,
    offset: {
      x: ctx.offset.x + off.x - chOff.x,
      y: ctx.offset.y + off.y - chOff.y,
    },
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
    if (runs.length > 0) {
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
    // 无 a:r 文本（如 a:fld 页码）或空 txBody → 若有几何则继续按形状提取
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
  const lineWidth = extractLineWidthPt(ln);
  const lineDash = extractLineDash(ln);

  if (!shapeName) {
    ctx.entities.push({
      slideIndex: ctx.slideIndex,
      slidePath: ctx.slidePath,
      decision: 'DEGRADE',
      kind: 'shape',
      bounds,
      shape: {
        type: 'RECTANGLE',
        fill: fillColor,
        line: lineColor,
        lineWidth,
        lineDash,
      },
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
    shape: {
      type: shapeName,
      fill: fillColor,
      line: lineColor,
      lineWidth,
      lineDash,
    },
    degradeReason: fillDegraded ? '渐变/图案填充退化为纯色' : undefined,
  });
}

/**
 * @param {object|null|undefined} ln a:ln
 * @returns {number|undefined}
 */
function extractLineWidthPt(ln) {
  if (!ln) return undefined;
  const w = parseInt(attr(ln, 'w') ?? '0', 10);
  if (!w) return undefined;
  return Math.max(1, Math.round(w / 12700));
}

/** OOXML prstDash → PptxGenJS line.dashType */
const PRST_DASH_MAP = {
  dash: 'dash',
  dot: 'dot',
  dashDot: 'dashDot',
  lgDash: 'lgDash',
  lgDashDot: 'lgDashDot',
  lgDashDotDot: 'lgDashDotDot',
  sysDash: 'sysDash',
  sysDot: 'sysDot',
  sysDashDot: 'sysDashDot',
  sysDashDotDot: 'sysDashDotDot',
};

/**
 * @param {object|null|undefined} ln a:ln
 * @returns {string|undefined}
 */
function extractLineDash(ln) {
  if (!ln) return undefined;
  const prstDash = child(ln, 'a:prstDash');
  const val = attr(prstDash, 'val');
  return val ? PRST_DASH_MAP[val] : undefined;
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
  const ln = child(spPr, 'a:ln');
  const { color: lineColor } = resolveFillColor(ln, ctx.scheme);

  ctx.entities.push({
    slideIndex: ctx.slideIndex,
    slidePath: ctx.slidePath,
    decision: 'FULL',
    kind: 'shape',
    bounds,
    shape: {
      type: 'LINE',
      fill: null,
      line: lineColor,
      lineWidth: extractLineWidthPt(ln),
      lineDash: extractLineDash(ln),
    },
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

/**
 * 组合内部坐标系原点（EMU）
 * @param {object|null|undefined} xfrm
 */
function readChOff(xfrm) {
  const chOff = child(xfrm, 'a:chOff');
  return {
    x: parseInt(attr(chOff, 'x') ?? '0', 10),
    y: parseInt(attr(chOff, 'y') ?? '0', 10),
  };
}

module.exports = {
  extractEntities,
  extractTextRuns,
  PRST_TO_SHAPE,
  boundsFromXfrm,
};
