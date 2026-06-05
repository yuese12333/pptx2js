/**
 * 表格提取（design.html §4.5）
 */
const { attr, child, children } = require('./xml-utils');
const { getGraphicXfrm } = require('./graphic');
const { boundsFromXfrm, emuToInch } = require('./bounds');
const { resolveFillColor } = require('./color');
const { compressCellBorder, flattenTableCellText } = require('./run-utils');
const { extractTextRuns } = require('./text-utils');

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
/**
 * 深色单元格背景 → 白字；首行表头 → 加粗（表格样式主题未实现时的对比度补偿）
 * @param {number} rowIndex
 * @param {string|null} fill
 * @param {object} runOptions
 */
function applyTableCellRunStyle(rowIndex, fill, runOptions) {
  const opts = { ...runOptions };
  if (fill && fill.length === 6 && fill !== 'FFFFFF') {
    const r = parseInt(fill.slice(0, 2), 16);
    const g = parseInt(fill.slice(2, 4), 16);
    const b = parseInt(fill.slice(4, 6), 16);
    const yiq = (r * 299 + g * 587 + b * 114) / 1000;
    if (!opts.color && yiq < 128) opts.color = 'FFFFFF';
  }
  return opts;
}

function extractTableRows(tbl, scheme) {
  const rows = [];
  let rowIndex = 0;
  for (const tr of children(tbl, 'a:tr')) {
    const cells = [];
    for (const tc of children(tr, 'a:tc')) {
      const tcPr = child(tc, 'a:tcPr');
      const txBody = child(tc, 'a:txBody');
      let text = '';
      /** @type {object} */
      let runOptions = {};
      if (txBody) {
        const flat = flattenTableCellText(extractTextRuns(txBody, scheme, null));
        text = flat.text;
        runOptions = flat.runOptions;
      }

      const fill = tcPr ? resolveFillColor(tcPr, scheme).color : null;
      runOptions = applyTableCellRunStyle(rowIndex, fill, runOptions);
      if (Array.isArray(text)) {
        text = text.map((part) => ({
          ...part,
          options: applyTableCellRunStyle(rowIndex, fill, part.options ?? {}),
        }));
      }
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
    if (cells.length) {
      rows.push(cells);
      rowIndex++;
    }
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
  const cols = children(grid, 'a:gridCol');
  if (!cols.length) return undefined;
  return cols.map((col) => {
    const w = parseInt(attr(col, 'w') ?? '0', 10);
    return Math.round(emuToInch(w) * 1000) / 1000;
  });
}

module.exports = { extractTable };
