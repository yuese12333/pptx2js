/**
 * 表格提取（design.html §4.5）
 */
const { asArray, attr, child, textContent } = require('./xml-utils');
const { getGraphicXfrm } = require('./graphic');
const { boundsFromXfrm } = require('./utils/bounds');
const { resolveFillColor } = require('./utils/color');
const { emuToInch } = require('./utils/emu');

/**
 * @param {object} graphicFrame
 * @param {object} ctx
 * @returns {import('./extractor').SlideEntity|null}
 */
function extractTable(graphicFrame, ctx) {
  const bounds = boundsFromXfrm(getGraphicXfrm(graphicFrame), ctx.offset);
  const graphicData = child(child(graphicFrame, 'a:graphic'), 'a:graphicData');
  const tbl = child(graphicData, 'a:tbl');

  if (!tbl) {
    return {
      slideIndex: ctx.slideIndex,
      slidePath: ctx.slidePath,
      decision: 'SKIP',
      kind: 'skip',
      bounds,
      skipReason: '表格数据无法解析（无内联 a:tbl）',
    };
  }

  const rows = extractTableRows(tbl, ctx.scheme);
  if (rows.length === 0) return null;

  const colWidths = extractColWidths(tbl);

  return {
    slideIndex: ctx.slideIndex,
    slidePath: ctx.slidePath,
    decision: 'FULL',
    kind: 'table',
    bounds,
    table: { rows, colWidths },
  };
}

/**
 * @param {object} tbl
 * @param {Record<string, string>} scheme
 */
function extractTableRows(tbl, scheme) {
  const rows = [];
  for (const tr of asArray(tbl['a:tr'])) {
    const cells = [];
    for (const tc of asArray(tr['a:tc'])) {
      const text = extractCellText(tc);
      const tcPr = child(tc, 'a:tcPr');
      const fill = tcPr ? resolveFillColor(tcPr, scheme).color : null;
      const merge = {};
      const rowSpan = attr(tcPr, 'rowSpan');
      const gridSpan = attr(tcPr, 'gridSpan');
      if (rowSpan && rowSpan !== '1') merge.rowspan = parseInt(rowSpan, 10);
      if (gridSpan && gridSpan !== '1') merge.colspan = parseInt(gridSpan, 10);

      const cell = { text, options: {} };
      if (fill) cell.options.fill = { color: fill };
      if (Object.keys(merge).length) Object.assign(cell.options, merge);

      const border = extractCellBorder(tcPr, scheme);
      if (border) cell.options.border = border;

      cells.push(cell);
    }
    if (cells.length) rows.push(cells);
  }
  return rows;
}

/**
 * @param {object|null|undefined} tcPr
 * @param {Record<string, string>} scheme
 */
function extractCellBorder(tcPr, scheme) {
  if (!tcPr) return null;
  const border = {};
  const sides = {
    left: 'a:lnL',
    right: 'a:lnR',
    top: 'a:lnT',
    bottom: 'a:lnB',
  };
  let hasAny = false;

  for (const [side, key] of Object.entries(sides)) {
    const ln = child(tcPr, key);
    if (!ln) continue;
    const { color } = resolveFillColor(ln, scheme);
    const w = parseInt(attr(ln, 'w') ?? '0', 10);
    if (color || w) {
      border[side] = {
        ...(color && { color }),
        ...(w > 0 && { pt: Math.round(w / 12700) }),
      };
      hasAny = true;
    }
  }
  return hasAny ? border : null;
}

/**
 * @param {object} tc
 */
function extractCellText(tc) {
  const txBody = child(tc, 'a:txBody');
  if (!txBody) return '';
  const parts = [];
  for (const p of asArray(txBody['a:p'])) {
    for (const r of asArray(p['a:r'])) {
      parts.push(textContent(r['a:t']));
    }
  }
  return parts.join('');
}

/**
 * @param {object} tbl
 * @returns {number[]|undefined}
 */
function extractColWidths(tbl) {
  const grid = child(tbl, 'a:tblGrid');
  const cols = asArray(child(grid, 'a:gridCol'));
  if (!cols.length) return undefined;
  return cols.map((col) => {
    const w = parseInt(attr(col, 'w') ?? '0', 10);
    return Math.round(emuToInch(w) * 1000) / 1000;
  });
}

module.exports = { extractTable };
