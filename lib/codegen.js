/**
 * ⑤ 代码生成器 — IR → PptxGenJS 脚本
 */
const { compressRunOptions } = require('./run-utils');

function generateScript(ir, options = {}) {
  const lines = [];
  const indent = (n) => '  '.repeat(n);

  lines.push("const path = require('path');");
  lines.push("const PptxGenJS = require('pptxgenjs');");
  lines.push('');
  lines.push('async function main() {');
  lines.push(`${indent(1)}const pptx = new PptxGenJS();`);
  lines.push('');

  const { width = 10, height = 7.5 } = ir.layout ?? {};
  lines.push(
    `${indent(1)}pptx.defineLayout({ name: 'PPTX_IMPORT', width: ${width}, height: ${height} });`
  );
  lines.push(`${indent(1)}pptx.layout = 'PPTX_IMPORT';`);
  lines.push('');

  ir.slides.forEach((slide, i) => {
    const varName = `slide${i}`;
    lines.push(`${indent(1)}const ${varName} = pptx.addSlide();`);

    if (slide.background?.color) {
      lines.push(
        `${indent(1)}${varName}.background = { color: '${escapeJs(slide.background.color)}' };`
      );
    }

    for (const el of slide.elements) {
      lines.push(...emitElement(el, varName, indent, options));
    }
    lines.push('');
  });

  lines.push(`${indent(1)}await pptx.writeFile({ fileName: 'output.pptx' });`);
  lines.push('}');
  lines.push('');
  lines.push('main().catch((err) => {');
  lines.push(`${indent(1)}console.error(err);`);
  lines.push(`${indent(1)}process.exit(1);`);
  lines.push('});');
  lines.push('');

  return lines.join('\n');
}

function emitElement(el, slideVar, indent, options) {
  const { x, y, w, h } = el.bounds ?? { x: 0, y: 0, w: 0, h: 0 };
  const pos = `x: ${x}, y: ${y}, w: ${w}, h: ${h}`;

  if (el.type === 'skip') {
    return [`${indent(1)}// [skipped] ${escapeJs(el.skipReason ?? 'unsupported')}`];
  }

  if (el.type === 'text') {
    return [`${indent(1)}${slideVar}.addText(${formatTextRuns(el.runs)}, { ${pos} });`];
  }

  if (el.type === 'image') {
    if (options.noMedia) {
      return [`${indent(1)}// [no-media] ${escapeJs(el.mediaPath ?? 'image')}`];
    }
    const imgPath = `path.join(__dirname, '${escapeJs(el.mediaPath)}')`;
    return [`${indent(1)}${slideVar}.addImage({ path: ${imgPath}, ${pos} });`];
  }

  if (el.type === 'table') {
    const rowsLit = formatTableRows(el.rows);
    const opts = [pos];
    if (el.colWidths?.length) {
      opts.push(`colW: [${el.colWidths.join(', ')}]`);
    }
    return [`${indent(1)}${slideVar}.addTable(${rowsLit}, { ${opts.join(', ')} });`];
  }

  if (el.type === 'chart') {
    const dataLit = JSON.stringify(el.data);
    const opts = [`${pos}`];
    if (el.title) {
      opts.push('showTitle: true');
      opts.push(`title: '${escapeJs(el.title)}'`);
    }
    return [
      `${indent(1)}${slideVar}.addChart(pptx.charts.${el.chartType}, ${dataLit}, { ${opts.join(', ')} });`,
    ];
  }

  if (el.type === 'shape') {
    const shapeRef = `pptx.shapes.${el.shape}`;
    const opts = [pos];
    if (el.fill) opts.push(`fill: { color: '${escapeJs(el.fill)}' }`);
    if (el.line) {
      const w = el.lineWidth ?? 1;
      opts.push(`line: { color: '${escapeJs(el.line)}', width: ${w} }`);
    }
    return [`${indent(1)}${slideVar}.addShape(${shapeRef}, { ${opts.join(', ')} });`];
  }

  return [];
}

function formatTableRows(rows) {
  const mapped = rows.map((row) =>
    row.map((cell) => {
      const textLit = Array.isArray(cell.text)
        ? formatTextRuns(cell.text)
        : `'${escapeJs(cell.text ?? '')}'`;
      const parts = [`text: ${textLit}`];
      const opts = compressTableCellOptions(cell.options ?? {});
      if (Object.keys(opts).length) {
        parts.push(`options: ${formatOptionsObject(opts)}`);
      }
      return `{ ${parts.join(', ')} }`;
    })
  );
  return `[\n    ${mapped.map((r) => `[${r.join(', ')}]`).join(',\n    ')}\n  ]`;
}

/**
 * @param {object} opts
 */
function compressTableCellOptions(opts) {
  const copy = compressRunOptions({ ...opts });
  return copy;
}

/**
 * 生成可读的 options 字面量（避免 JSON 双引号风格）
 * @param {object} opts
 */
function formatBorderObject(border) {
  if (border.type === 'solid' && border.color) {
    const parts = [`type: 'solid'`, `color: '${escapeJs(border.color)}'`];
    if (border.pt != null) parts.push(`pt: ${border.pt}`);
    return `{ ${parts.join(', ')} }`;
  }
  return JSON.stringify(border);
}

function formatOptionsObject(opts) {
  const entries = [];
  for (const [key, val] of Object.entries(opts)) {
    if (key === 'border' && val && typeof val === 'object') {
      entries.push(`border: ${formatBorderObject(val)}`);
    } else if (val === true) {
      entries.push(`${key}: true`);
    } else if (val === false) {
      entries.push(`${key}: false`);
    } else if (typeof val === 'number') {
      entries.push(`${key}: ${val}`);
    } else if (typeof val === 'string') {
      entries.push(`${key}: '${escapeJs(val)}'`);
    } else {
      entries.push(`${key}: ${JSON.stringify(val)}`);
    }
  }
  return `{ ${entries.join(', ')} }`;
}

function formatTextRuns(runs) {
  if (!runs?.length) return "''";

  const parts = runs.map((run) => {
    const text = escapeJs(run.text ?? '');
    const opts = formatRunOptions(run.options ?? {});
    if (opts === '{}') {
      return `{ text: '${text}' }`;
    }
    return `{ text: '${text}', options: ${opts} }`;
  });

  if (parts.length === 1 && !parts[0].includes('options:')) {
    return `'${escapeJs(runs[0].text ?? '')}'`;
  }

  return `[\n    ${parts.join(',\n    ')}\n  ]`;
}

function formatRunOptions(options) {
  const copy = compressRunOptions({ ...options });
  delete copy._degraded;
  const entries = [];
  if (copy.fontSize != null) entries.push(`fontSize: ${copy.fontSize}`);
  if (copy.bold) entries.push('bold: true');
  if (copy.italic) entries.push('italic: true');
  if (copy.fontFace) entries.push(`fontFace: '${escapeJs(String(copy.fontFace))}'`);
  if (copy.color) entries.push(`color: '${escapeJs(String(copy.color))}'`);
  if (copy.bullet === true) entries.push('bullet: true');
  if (copy.bullet && typeof copy.bullet === 'object') {
    entries.push(`bullet: { type: '${copy.bullet.type ?? 'number'}' }`);
  }
  if (copy.hyperlink?.url) {
    entries.push(`hyperlink: { url: '${escapeJs(copy.hyperlink.url)}' }`);
  }
  if (copy.underline === true) {
    entries.push('underline: true');
  } else if (copy.underline && typeof copy.underline === 'object') {
    entries.push(`underline: { style: '${escapeJs(copy.underline.style ?? 'sng')}' }`);
  }
  if (copy.align) entries.push(`align: '${escapeJs(String(copy.align))}'`);
  if (copy.indentLevel != null && copy.indentLevel > 0) {
    entries.push(`indentLevel: ${copy.indentLevel}`);
  }
  if (copy.paraSpaceBefore != null) {
    entries.push(`paraSpaceBefore: ${copy.paraSpaceBefore}`);
  }
  if (copy.paraSpaceAfter != null) {
    entries.push(`paraSpaceAfter: ${copy.paraSpaceAfter}`);
  }
  if (copy.lineSpacing != null) entries.push(`lineSpacing: ${copy.lineSpacing}`);
  if (entries.length === 0) return '{}';
  return `{ ${entries.join(', ')} }`;
}

function escapeJs(s) {
  return String(s)
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'")
    .replace(/\r/g, '\\r')
    .replace(/\n/g, '\\n');
}

module.exports = { generateScript, escapeJs, formatTableRows };
