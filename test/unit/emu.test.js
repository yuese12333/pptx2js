const { emuToInch, inchToEmu, EMU_PER_INCH } = require('../../lib/utils/emu');

describe('emu', () => {
  it('EMU 与英寸双向换算', () => {
    expect(emuToInch(EMU_PER_INCH)).toBeCloseTo(1, 6);
    expect(inchToEmu(1)).toBe(EMU_PER_INCH);
  });
});
