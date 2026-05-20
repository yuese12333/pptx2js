/**
 * 图表提取（design.html §4.3）
 */
const path = require('path');
const { asArray, attr, child, textContent } = require('./xml-utils');
const { getGraphicXfrm } = require('./graphic');
const { boundsFromXfrm } = require('./utils/bounds');

const CHART_NS_BAR = 'barChart';
const CHART_NS_LINE = 'lineChart';
const CHART_NS_PIE = 'pieChart';

const PPTX_TO_PPTGEN = {
  barChart: 'BAR',
  lineChart: 'LINE',
  pieChart: 'PIE',
  areaChart: 'AREA',
  doughnutChart: 'DOUGHNUT',
  scatterChart: 'SCATTER',
  radarChart: 'RADAR',
  bubbleChart: 'BUBBLE',
};

/**
 * @param {object} graphicFrame
 * @param {object} ctx
 * @returns {import('./extractor').SlideEntity|null}
 */
function extractChart(graphicFrame, ctx) {
  const bounds = boundsFromGraphicFrame(graphicFrame, ctx.offset);
  const graphicData = child(child(graphicFrame, 'a:graphic'), 'a:graphicData');
  const chartEl = child(graphicData, 'c:chart');
  const relId = attr(chartEl, 'r:id');

  if (!relId) {
    return chartFallback(graphicFrame, ctx, bounds, '图表缺少关系 ID');
  }

  const chartPath = ctx.relIndex.resolve(ctx.slidePath, relId);
  if (!chartPath || !ctx.parsed[chartPath]) {
    return chartFallback(graphicFrame, ctx, bounds, '无法解析图表 XML');
  }

  const chartDoc = ctx.parsed[chartPath];
  const chartSpace = child(chartDoc, 'c:chartSpace') ?? chartDoc;
  const chartRoot = child(chartSpace, 'c:chart');
  const plotArea = child(chartRoot, 'c:plotArea');

  const parsed = parseChartPlotArea(plotArea);
  if (parsed) {
    parsed.title = extractChartTitle(chartRoot);
    return {
      slideIndex: ctx.slideIndex,
      slidePath: ctx.slidePath,
      decision: 'FULL',
      kind: 'chart',
      bounds,
      chart: parsed,
    };
  }

  return chartFallback(graphicFrame, ctx, bounds, '不支持的图表类型');
}

/**
 * @param {object|null|undefined} plotArea
 */
function parseChartPlotArea(plotArea) {
  if (!plotArea) return null;

  for (const [xmlName, pptxType] of Object.entries(PPTX_TO_PPTGEN)) {
    const chartNode = child(plotArea, `c:${xmlName}`);
    if (!chartNode) continue;

    const series = extractSeries(chartNode, plotArea);
    if (!series.length) continue;

    return {
      type: pptxType,
      data: series,
      title: '',
    };
  }
  return null;
}

/**
 * @param {object} chartNode c:barChart 等
 * @param {object} plotArea
 */
function extractSeries(chartNode, plotArea) {
  const result = [];
  const seriesNodes = asArray(chartNode['c:ser']);

  for (const ser of seriesNodes) {
    const titleText = extractSeriesName(ser);
    const cat = extractCategoryLabels(ser);
    const values = extractSeriesValues(ser, plotArea);
    if (!values.length) continue;

    result.push({
      name: titleText || `Series ${result.length + 1}`,
      labels: cat.length ? cat : values.map((_, i) => String(i + 1)),
      values,
    });
  }
  return result;
}

/**
 * @param {object} ser
 */
function extractSeriesName(ser) {
  const tx = child(child(ser, 'c:tx'), 'c:strRef');
  const cache = child(tx, 'c:strCache');
  const pt = asArray(child(cache, 'c:pt'))[0];
  return pt ? textContent(child(pt, 'c:v')) : '';
}

/**
 * @param {object} ser
 */
function extractCategoryLabels(ser) {
  const cat = child(ser, 'c:cat');
  if (!cat) return [];

  const strRef = child(cat, 'c:strRef');
  if (strRef) {
    const pts = extractCachePoints(strRef, 'c:strCache', 'c:v');
    if (pts.length) return pts;
  }

  const multiRef = child(cat, 'c:multiLvlStrRef');
  if (multiRef) {
    const pts = extractMultiLvlStrLabels(multiRef);
    if (pts.length) return pts;
  }

  const numRef = child(cat, 'c:numRef');
  if (numRef) {
    const pts = extractCachePoints(numRef, 'c:numCache', 'c:v').map(String);
    if (pts.length) return pts;
  }

  const strLit = child(cat, 'c:strLit');
  if (strLit) {
    return extractCachePoints(strLit, null, 'c:v').filter(Boolean);
  }

  return [];
}

/**
 * PptxGenJS 常用 multiLvlStrRef 缓存分类标签
 * @param {object} multiRef
 */
function extractMultiLvlStrLabels(multiRef) {
  const cache = child(multiRef, 'c:multiLvlStrCache');
  if (!cache) return [];
  const lvl = child(cache, 'c:lvl');
  if (!lvl) return [];
  const pts = asArray(lvl['c:pt']);
  return pts
    .sort(
      (a, b) =>
        parseInt(attr(a, 'idx') ?? '0', 10) - parseInt(attr(b, 'idx') ?? '0', 10)
    )
    .map((pt) => textContent(child(pt, 'c:v')))
    .filter(Boolean);
}

/**
 * @param {object} ser
 * @param {object} plotArea
 */
function extractSeriesValues(ser, plotArea) {
  void plotArea;
  const val = child(ser, 'c:val');
  if (!val) return [];
  const numRef = child(val, 'c:numRef');
  if (!numRef) return [];
  return extractCachePoints(numRef, 'c:numCache', 'c:v').map((v) => parseFloat(v) || 0);
}

/**
 * @param {object} refNode
 * @param {string|null} cacheKey null 时直接在 refNode 上找 c:pt（如 strLit）
 * @param {string} valueKey
 */
function extractCachePoints(refNode, cacheKey, valueKey) {
  const container = cacheKey ? child(refNode, cacheKey) : refNode;
  if (!container) return [];
  const pts = asArray(child(container, 'c:pt'));
  return pts
    .sort((a, b) => parseInt(attr(a, 'idx') ?? '0', 10) - parseInt(attr(b, 'idx') ?? '0', 10))
    .map((pt) => textContent(child(pt, valueKey)));
}

/**
 * @param {object} chartRoot c:chart
 */
function extractChartTitle(chartRoot) {
  const title = child(chartRoot, 'c:title');
  if (!title) return '';
  const tx = child(title, 'c:tx');
  const rich = child(tx, 'c:rich');
  if (!rich) return '';
  const parts = [];
  for (const p of asArray(rich['a:p'])) {
    for (const r of asArray(p['a:r'])) {
      parts.push(textContent(r['a:t']));
    }
  }
  return parts.join('');
}

/**
 * 缓存图片 → 图片插入；否则占位文本
 * @param {object} graphicFrame
 * @param {object} ctx
 * @param {object} bounds
 * @param {string} reason
 */
function chartFallback(graphicFrame, ctx, bounds, reason) {
  const cached = findChartCacheImage(graphicFrame, ctx);
  if (cached) {
    return {
      slideIndex: ctx.slideIndex,
      slidePath: ctx.slidePath,
      decision: 'DEGRADE',
      kind: 'image',
      bounds,
      image: cached,
      degradeReason: `${reason}，已使用缓存图片`,
    };
  }

  return {
    slideIndex: ctx.slideIndex,
    slidePath: ctx.slidePath,
    decision: 'DEGRADE',
    kind: 'text',
    bounds,
    text: {
      runs: [{ text: `[图表] ${reason}`, options: { fontSize: 12, color: '888888' } }],
    },
    degradeReason: reason,
  };
}

/**
 * @param {object} graphicFrame
 * @param {object} ctx
 */
function findChartCacheImage(graphicFrame, ctx) {
  const graphicData = child(child(graphicFrame, 'a:graphic'), 'a:graphicData');
  const chartEl = child(graphicData, 'c:chart');
  const chartRelId = attr(chartEl, 'r:id');
  const chartPath =
    chartRelId && ctx.relIndex.resolve(ctx.slidePath, chartRelId);
  if (!chartPath) return null;

  for (const rel of ctx.relIndex.list(chartPath)) {
    if (!rel.target.match(/\.(png|jpe?g|gif)$/i)) continue;
    if (rel.type && rel.type.includes('image')) {
      return {
        zipPath: rel.target,
        fileName: path.posix.basename(rel.target),
      };
    }
  }
  return null;
}

/**
 * @param {object} graphicFrame
 * @param {{ x: number, y: number }} offset
 */
function boundsFromGraphicFrame(graphicFrame, offset) {
  return boundsFromXfrm(getGraphicXfrm(graphicFrame), offset);
}

module.exports = { extractChart, parseChartPlotArea, PPTX_TO_PPTGEN };
