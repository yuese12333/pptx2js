/**
 * EMU 换算与形状坐标：a:xfrm → 英寸边界
 */
const { attr, child } = require('./xml-utils');

/** EMU（English Metric Units）与英寸换算，1 英寸 = 914400 EMU */
const EMU_PER_INCH = 914400;

/**
 * @param {number} emu
 * @returns {number}
 */
function emuToInch(emu) {
  return emu / EMU_PER_INCH;
}

/**
 * @param {number} inch
 * @returns {number}
 */
function inchToEmu(inch) {
  return inch * EMU_PER_INCH;
}

/**
 * @param {object|null|undefined} xfrm
 * @param {{ x: number, y: number }} offset EMU
 * @returns {{ x: number, y: number, w: number, h: number }}
 */
function boundsFromXfrm(xfrm, offset = { x: 0, y: 0 }) {
  const off = child(xfrm, 'a:off');
  const ext = child(xfrm, 'a:ext');
  const x = parseInt(attr(off, 'x') ?? '0', 10) + offset.x;
  const y = parseInt(attr(off, 'y') ?? '0', 10) + offset.y;
  const cx = parseInt(attr(ext, 'cx') ?? '0', 10);
  const cy = parseInt(attr(ext, 'cy') ?? '0', 10);
  return {
    x: round3(emuToInch(x)),
    y: round3(emuToInch(y)),
    w: round3(emuToInch(cx)),
    h: round3(emuToInch(cy)),
  };
}

/**
 * @param {number} n
 */
function round3(n) {
  return Math.round(n * 1000) / 1000;
}

module.exports = {
  EMU_PER_INCH,
  emuToInch,
  inchToEmu,
  boundsFromXfrm,
};
