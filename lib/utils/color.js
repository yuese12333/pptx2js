/**
 * 颜色规范化（srgbClr、schemeClr、渐变首色标）
 */
const { asArray, attr, child } = require('../xml-utils');

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

  const theme = child(parsed[themePath], 'a:theme');
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
    return last ? last.toUpperCase() : null;
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

  const solid = child(fillNode, 'a:solidFill');
  if (solid) {
    return { color: resolveColorFromContainer(solid, scheme), degraded: false };
  }

  const grad = child(fillNode, 'a:gradFill');
  if (grad) {
    const gs = asArray(child(child(grad, 'a:gsLst'), 'a:gs'))[0];
    return {
      color: gs ? resolveColorFromContainer(gs, scheme) : null,
      degraded: true,
    };
  }

  return { color: null, degraded: false };
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
    return val ? val.toUpperCase() : null;
  }

  const schemeClr = child(container, 'a:schemeClr');
  if (schemeClr) {
    const name = attr(schemeClr, 'val');
    return name ? scheme[name] ?? DEFAULT_SCHEME[name] ?? null : null;
  }

  return extractRgbFromColorNode(container);
}

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
};
