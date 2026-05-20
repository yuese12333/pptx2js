const { generateScript } = require('../../lib/codegen');

describe('codegen layout fallback', () => {
  it('ir.layout 缺失时使用默认尺寸', () => {
    const script = generateScript({ slides: [] });
    expect(script).toContain('width: 10');
    expect(script).toContain('height: 7.5');
  });
});
