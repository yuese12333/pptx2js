const { parseXml } = require('../../lib/xml-parser');
const { extractTextRuns } = require('../../lib/extractor');

describe('txBody lstStyle', () => {
  it('从 a:txBody/a:lstStyle/defPPr 读取默认 align', async () => {
    const txBodyXml = `<?xml version="1.0" encoding="UTF-8"?>
<a:txBody xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">
  <a:bodyPr/>
  <a:lstStyle>
    <a:defPPr algn="ctr"/>
  </a:lstStyle>
  <a:p>
    <a:r><a:rPr sz="3600"/><a:t>Title</a:t></a:r>
  </a:p>
</a:txBody>`;

    const doc = await parseXml(txBodyXml);
    const txBody = doc['a:txBody'];
    const runs = extractTextRuns(txBody, {}, null);

    expect(runs[0].options.align).toBe('center');
  });
});
