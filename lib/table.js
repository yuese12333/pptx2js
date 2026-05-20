/**
 * 表格提取（design.html §4.5）
 */
const { asArray, attr, child } = require('./xml-utils');
const { getGraphicXfrm } = require('./graphic');
const { boundsFromXfrm } = require('./utils/bounds');
const { resolveFillColor } = require('./utils/color');
const { emuToInch } = require('./utils/emu');
const { compressCellBorder, flattenTableCellText } = require('./run-utils');

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
      const tcPr = child(tc, 'a:tcPr');
      const txBody = child(tc, 'a:txBody');
      let text = '';
      /** @type {object} */
      let runOptions = {};
      if (txBody) {
        const { extractTextRuns } = require('./extractor');
        const flat = flattenTableCellText(extractTextRuns(txBody, scheme, null));
        text = flat.text;
        runOptions = flat.runOptions;
      }

      const fill = tcPr ? resolveFillColor(tcPr, scheme).color : null;
      const borderRaw = extractCellBorderSides(tcPr, scheme);
      const borderColors = borderRaw
        ? Object.values(borderRaw)
            .map((b) => b.color)
            .filter(Boolean)
        : [];
      const border = compressCellBorder(borderRaw);
      const fillIsJustBorderColor =
        fill &&
        borderColors.length > 0 &&
        borderColors.every((c) => c === fill);

      const merge = {};
      const rowSpan = attr(tcPr, 'rowSpan');
      const gridSpan = attr(tcPr, 'gridSpan');
      if (rowSpan && rowSpan !== '1') merge.rowspan = parseInt(rowSpan, 10);
      if (gridSpan && gridSpan !== '1') merge.colspan = parseInt(gridSpan, 10);

      const cell = { text, options: { ...runOptions } };
      if (fill && !fillIsJustBorderColor) cell.options.fill = fill;
      if (Object.keys(merge).length) Object.assign(cell.options, merge);
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
function extractCellBorderSides(tcPr, scheme) {
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
