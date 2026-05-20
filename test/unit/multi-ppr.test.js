const { parseXml } = require('../../lib/xml-parser');
const { extractTextRuns } = require('../../lib/extractor');

describe('multiple a:pPr in one paragraph', () => {
  it('每个 run 使用对应位置的 pPr（含 algn）', async () => {
    const txBodyXml = `<?xml version="1.0" encoding="UTF-8"?>
<a:txBody xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">
  <a:bodyPr/>
  <a:p>
    <a:pPr algn="ctr"/>
    <a:r><a:rPr sz="1600" b="1"/><a:t>居中加粗</a:t></a:r>
    <a:pPr indent="0"/>
    <a:r><a:rPr sz="1400"/><a:t>\n</a:t></a:r>
  </a:p>
</a:txBody>`;

    const doc = await parseXml(txBodyXml);
    const runs = extractTextRuns(doc['a:txBody'], {}, null);

    expect(runs[0].text).toBe('居中加粗');
    expect(runs[0].options.align).toBe('center');
    expect(runs[0].options.bold).toBe(true);
  });
});
