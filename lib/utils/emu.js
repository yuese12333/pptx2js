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

module.exports = { EMU_PER_INCH, emuToInch, inchToEmu };
