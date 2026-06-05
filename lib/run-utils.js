/**
 * 文本 run 合并与 PptxGenJS 选项压缩（IR → 代码 简化层）
 */

const DEFAULT_TEXT_COLOR = '000000';

/**
 * @param {object} a
 * @param {object} b
 */
function optionsEqual(a, b) {
  return optionsKey(a) === optionsKey(b);
}

/**
 * @param {object} opts
 */
function optionsKey(opts) {
  const o = compressRunOptions({ ...opts });
  return JSON.stringify(o, Object.keys(o).sort());
}

/**
 * @param {string} text
 */
function isNewlineOnly(text) {
  return typeof text === 'string' && /^[\r\n\s]*$/.test(text) && /[\r\n]/.test(text);
}

/**
 * 剔除 PptxGenJS 默认值，简化 underline
 * @param {object} opts
 */
function compressRunOptions(opts) {
  if (!opts || typeof opts !== 'object') return {};
  const copy = { ...opts };
  delete copy._degraded;

  // 保留 XML 中显式解析出的颜色（含 000000），避免回退到母版色导致白底白字

  if (copy.underline && typeof copy.underline === 'object') {
    if ((copy.underline.style ?? 'sng') === 'sng') {
      copy.underline = true;
    }
  }

  return copy;
}

/**
 * 合并相邻同样式 run，将独立换行 run 并入前一段文本
 * @param {Array<{ text: string, options?: object }>} runs
 */
function compressTextRuns(runs) {
  if (!runs?.length) return [];

  /** @type {Array<{ text: string, options: object }>} */
  const out = [];

  for (const run of runs) {
    const text = run.text ?? '';
    const options = compressRunOptions(run.options ?? {});

    if (!text && Object.keys(options).length === 0) continue;

    if (!out.length) {
      out.push({ text, options });
      continue;
    }

    const last = out[out.length - 1];

    if (isNewlineOnly(text)) {
      const nlOpts = { ...options };
      delete nlOpts.bullet;
      if (optionsEqual(last.options, nlOpts) || optionsEqual(last.options, options)) {
        if (!last.text.endsWith('\n')) {
          last.text += text.includes('\r') ? '\r\n' : '\n';
        }
        continue;
      }
    }

    if (optionsEqual(last.options, options)) {
      last.text += text;
      continue;
    }

    out.push({ text, options });
  }

  while (out.length > 1 && isNewlineOnly(out[out.length - 1].text)) {
    const tail = out.pop();
    const prev = out[out.length - 1];
    if (optionsEqual(prev.options, tail.options) && !prev.text.endsWith('\n')) {
      prev.text += tail.text.includes('\r') ? '\r\n' : '\n';
    } else {
      const nlOpts = { ...tail.options };
      delete nlOpts.bullet;
      out.push({ text: tail.text, options: nlOpts });
      break;
    }
  }

  return out.map((run) => {
    if (!isNewlineOnly(run.text)) return run;
    const options = { ...run.options };
    delete options.bullet;
    return { text: run.text, options };
  });
}

/**
 * 四边相同时合并为 PptxGenJS 简写 border
 * @param {object|null} border
 */
function compressCellBorder(border) {
  if (!border) return null;

  const sides = ['left', 'right', 'top', 'bottom'];
  const present = sides.filter((s) => border[s]);
  if (present.length === 0) return null;

  if (present.length < 4) return border;

  const first = border[present[0]];
  const allSame = present.every((s) => {
    const side = border[s];
    return (
      (side.color ?? null) === (first.color ?? null) &&
      (side.pt ?? 1) === (first.pt ?? 1)
    );
  });

  if (allSame) {
    return {
      type: 'solid',
      color: first.color,
      pt: first.pt ?? 1,
    };
  }

  return border;
}

/**
 * 表格单元格：压缩 runs → 纯文本或内联多 run
 * @param {Array<{ text: string, options?: object }>} runs
 */
function flattenTableCellText(runs) {
  const merged = compressTextRuns(runs);
  if (!merged.length) return { text: '', runOptions: {} };

  const allSame =
    merged.length === 1 ||
    merged.every((r) => optionsEqual(r.options, merged[0].options));

  if (allSame) {
    const text = merged.map((r) => r.text).join('').replace(/\r\n/g, '\n');
    return { text, runOptions: compressRunOptions(merged[0].options) };
  }

  return {
    text: merged.map((r) => ({
      text: String(r.text).replace(/\r\n/g, '\n'),
      options: compressRunOptions(r.options),
    })),
    runOptions: {},
  };
}

module.exports = {
  compressRunOptions,
  compressTextRuns,
  compressCellBorder,
  flattenTableCellText,
  optionsEqual,
  isNewlineOnly,
};
