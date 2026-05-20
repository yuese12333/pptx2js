const fs = require('fs');
const os = require('os');
const path = require('path');
const { convert } = require('../../lib/convert');
const { buildMinimalPptxBuffer } = require('../helpers/minimal-pptx');

describe('convert integration', () => {
  let tmpDir;
  let pptxPath;

  beforeAll(async () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pptx2js-'));
    pptxPath = path.join(tmpDir, 'minimal.pptx');
    fs.writeFileSync(pptxPath, await buildMinimalPptxBuffer());
  });

  afterAll(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('转换最小 PPTX 并生成 output.js', async () => {
    const outDir = path.join(tmpDir, 'out');
    const result = await convert(pptxPath, { outputDir: outDir });

    expect(fs.existsSync(result.scriptPath)).toBe(true);
    const script = fs.readFileSync(result.scriptPath, 'utf8');
    expect(script).toContain('Hello pptx2js');
    expect(script).toContain('addText');
    expect(script).toContain('PPTX_IMPORT');

    expect(result.log.statistics.slides).toBe(1);
    expect(result.log.statistics.full).toBeGreaterThan(0);
    expect(fs.existsSync(path.join(outDir, 'conversion.log'))).toBe(true);
  });
});
