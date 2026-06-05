/**
 * 颜色规范化（srgbClr、schemeClr、渐变首色标）
 */
const { attr, child, children, documentRoot } = require('./xml-utils');

/** OOXML a:prstClr val → 6 位 RGB（源 PPT 主要使用 black / white） */
const PRST_COLOR_MAP = {
  black: '000000',
  white: 'FFFFFF',
  red: 'FF0000',
  green: '00FF00',
  blue: '0000FF',
  yellow: 'FFFF00',
  gray: '808080',
  grey: '808080',
  silver: 'C0C0C0',
  navy: '000080',
  teal: '008080',
  lime: '00FF00',
  olive: '808000',
  maroon: '800000',
  aqua: '00FFFF',
  fuchsia: 'FF00FF',
  orange: 'FFA500',
  purple: '800080',
  brown: 'A52A2A',
  pink: 'FFC0CB',
  dkGreen: '006400',
  dkBlue: '00008B',
  dkRed: '8B0000',
  dkGray: 'A9A9A9',
  dkGrey: 'A9A9A9',
  ltGray: 'D3D3D3',
  ltGrey: 'D3D3D3',
};

/** @type {Record<string, string>} */
const DEFAULT_SCHEME = {
  dk1: '000000',
  lt1: 'FFFFFF',
  dk2: '44546A',
  lt2: 'E7E6E6',
  accent1: '4472C4',
  accent2: 'ED7D31',
  accent3: 'A5A5A5',
  accent4: 'FFC000',
  accent5: '5B9BD5',
  accent6: '70AD47',
  hlink: '0563C1',
  folHlink: '954F72',
};

/**
 * @param {Record<string, object>|null} parsed
 * @param {string|null} themePath
 * @returns {Record<string, string>}
 */
function loadColorScheme(parsed, themePath) {
  if (!themePath || !parsed[themePath]) return { ...DEFAULT_SCHEME };

  const theme = documentRoot(parsed[themePath], 'a:theme');
  const clrScheme = child(child(theme, 'a:themeElements'), 'a:clrScheme');
  if (!clrScheme) return { ...DEFAULT_SCHEME };

  const scheme = { ...DEFAULT_SCHEME };
  for (const name of Object.keys(DEFAULT_SCHEME)) {
    const slot = child(clrScheme, `a:${name}`);
    const rgb = extractRgbFromColorNode(slot);
    if (rgb) scheme[name] = rgb;
  }
  return scheme;
}

/**
 * @param {object|null|undefined} colorNode a:srgbClr / a:schemeClr 的父级
 * @returns {string|null}
 */
function extractRgbFromColorNode(colorNode) {
  if (!colorNode) return null;

  const srgb = child(colorNode, 'a:srgbClr');
  if (srgb) {
    const val = attr(srgb, 'val');
    return val ? val.toUpperCase() : null;
  }

  const sys = child(colorNode, 'a:sysClr');
  if (sys) {
    const last = attr(sys, 'lastClr');
    return last ? applyColorModifiers(last.toUpperCase(), sys) : null;
  }

  return null;
}

/**
 * @param {object|null|undefined} fillNode a:solidFill | a:gradFill 等
 * @param {Record<string, string>} scheme
 * @returns {{ color: string|null, degraded: boolean }}
 */
function resolveFillColor(fillNode, scheme) {
  if (!fillNode) return { color: null, degraded: false };

  const solid =
    fillNode.tag === 'a:solidFill' ? fillNode : child(fillNode, 'a:solidFill');
  if (solid) {
    return { color: resolveColorFromContainer(solid, scheme), degraded: false };
  }

  const grad =
    fillNode.tag === 'a:gradFill' ? fillNode : child(fillNode, 'a:gradFill');
  if (grad) {
    const gs = firstGradientStop(grad);
    return {
      color: gs ? resolveColorFromContainer(gs, scheme) : null,
      degraded: true,
    };
  }

  const ptn =
    fillNode.tag === 'a:ptnFill' ? fillNode : child(fillNode, 'a:ptnFill');
  if (ptn) {
    const fgClr = child(ptn, 'a:fgClr');
    return {
      color: fgClr ? resolveColorFromContainer(fgClr, scheme) : null,
      degraded: true,
    };
  }

  return { color: null, degraded: false };
}

/**
 * 渐变色标按 pos 升序，取最小 pos 对应色标（OOXML 0–100000）
 * @param {object} grad a:gradFill
 * @returns {object|null}
 */
function firstGradientStop(grad) {
  const gsLst = child(grad, 'a:gsLst');
  if (!gsLst) return null;
  const stops = children(gsLst, 'a:gs');
  if (!stops.length) return null;
  return [...stops].sort(
    (a, b) => parseInt(attr(a, 'pos') ?? '0', 10) - parseInt(attr(b, 'pos') ?? '0', 10)
  )[0];
}

/**
 * @param {object|null|undefined} container 含 a:srgbClr / a:schemeClr
 * @param {Record<string, string>} scheme
 * @returns {string|null}
 */
function resolveColorFromContainer(container, scheme) {
  if (!container) return null;

  const srgb = child(container, 'a:srgbClr');
  if (srgb) {
    const val = attr(srgb, 'val');
    if (!val) return null;
    return applyColorModifiers(val.toUpperCase(), srgb);
  }

  const schemeClr = child(container, 'a:schemeClr');
  if (schemeClr) {
    const name = attr(schemeClr, 'val');
    const base = name ? scheme[name] ?? DEFAULT_SCHEME[name] ?? null : null;
    return base ? applyColorModifiers(base, schemeClr) : null;
  }

  const prstClr = child(container, 'a:prstClr');
  if (prstClr) {
    const val = attr(prstClr, 'val');
    const base = val ? PRST_COLOR_MAP[val] ?? PRST_COLOR_MAP[val.toLowerCase()] ?? '000000' : null;
    return base ? applyColorModifiers(base, prstClr) : null;
  }

  const sysClr = child(container, 'a:sysClr');
  if (sysClr) {
    const last = attr(sysClr, 'lastClr');
    return last ? applyColorModifiers(last.toUpperCase(), sysClr) : null;
  }

  return extractRgbFromColorNode(container);
}

/**
 * @param {string} hex 6 位 RGB
 */
function hexToRgb(hex) {
  const h = String(hex).replace(/^#/, '');
  if (h.length !== 6) return { r: 0, g: 0, b: 0 };
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  };
}

/**
 * @param {{ r: number, g: number, b: number }} rgb
 */
function rgbToHex(rgb) {
  const clamp = (n) => Math.max(0, Math.min(255, Math.round(n)));
  return [rgb.r, rgb.g, rgb.b]
    .map((c) => clamp(c).toString(16).padStart(2, '0'))
    .join('')
    .toUpperCase();
}

/**
 * RGB 0–255 → HLS（H 0–360，L/S 0–1，与 DrawingML 亮度语义一致）
 * @param {number} r
 * @param {number} g
 * @param {number} b
 */
function rgbToHls(r, g, b) {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  let h = 0;
  const l = (max + min) / 2;
  let s = 0;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case rn:
        h = ((gn - bn) / d + (gn < bn ? 6 : 0)) / 6;
        break;
      case gn:
        h = ((bn - rn) / d + 2) / 6;
        break;
      default:
        h = ((rn - gn) / d + 4) / 6;
        break;
    }
  }
  return { h: h * 360, l, s };
}

/**
 * @param {number} h
 * @param {number} l
 * @param {number} s
 */
function hlsToRgb(h, l, s) {
  if (s === 0) {
    const v = Math.round(l * 255);
    return { r: v, g: v, b: v };
  }
  const hue = (((h % 360) + 360) % 360) / 360;
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const hue2rgb = (t) => {
    let x = t;
    if (x < 0) x += 1;
    if (x > 1) x -= 1;
    if (x < 1 / 6) return p + (q - p) * 6 * x;
    if (x < 1 / 2) return q;
    if (x < 2 / 3) return p + (q - p) * (2 / 3 - x) * 6;
    return p;
  };
  return {
    r: Math.round(hue2rgb(hue + 1 / 3) * 255),
    g: Math.round(hue2rgb(hue) * 255),
    b: Math.round(hue2rgb(hue - 1 / 3) * 255),
  };
}

/**
 * srgbClr / schemeClr 上的 lumMod / shade / tint 等修饰（OOXML 比例 1/100000，在 HLS 亮度通道运算）
 * @param {string} hex
 * @param {object} clrNode
 */
function applyColorModifiers(hex, clrNode) {
  let { r, g, b } = hexToRgb(hex);
  let { h, l, s } = rgbToHls(r, g, b);

  const lumMod = child(clrNode, 'a:lumMod');
  if (lumMod) {
    const pct = parseInt(attr(lumMod, 'val') ?? '100000', 10) / 100000;
    l *= pct;
  }

  const lumOff = child(clrNode, 'a:lumOff');
  if (lumOff) {
    const pct = parseInt(attr(lumOff, 'val') ?? '0', 10) / 100000;
    l += pct;
  }

  const shade = child(clrNode, 'a:shade');
  if (shade) {
    const pct = parseInt(attr(shade, 'val') ?? '100000', 10) / 100000;
    l *= pct;
  }

  const tint = child(clrNode, 'a:tint');
  if (tint) {
    const pct = parseInt(attr(tint, 'val') ?? '0', 10) / 100000;
    l += (1 - l) * pct;
  }

  l = Math.max(0, Math.min(1, l));
  ({ r, g, b } = hlsToRgb(h, l, s));
  return rgbToHex({ r, g, b });
}

/** @deprecated 使用 applyColorModifiers */
const applySchemeClrModifiers = applyColorModifiers;

/**
 * @param {Record<string, string>} scheme
 * @param {object|null|undefined} clrNode
 * @returns {string|null}
 */
function resolveColor(scheme, clrNode) {
  return resolveColorFromContainer(clrNode, scheme);
}

module.exports = {
  DEFAULT_SCHEME,
  loadColorScheme,
  resolveFillColor,
  resolveColor,
  resolveColorFromContainer,
  firstGradientStop,
  applyColorModifiers,
  applySchemeClrModifiers,
};
