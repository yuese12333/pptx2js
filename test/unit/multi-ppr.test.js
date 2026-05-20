const { parseXml } = require('../../lib/xml-parser');
const { extractTextRuns } = require('../../lib/extractor');

describe('multiple a:pPr in one paragraph', () => {
  it('?? run ??????? pPr?? algn?', () => {
    const txBodyXml = `<?xml version="1.0" encoding="UTF-8"?>
<a:txBody xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">
  <a:bodyPr/>
  <a:p>
    <a:pPr algn="ctr"/>
    <a:r><a:rPr sz="1600" b="1"/><a:t>????</a:t></a:r>
    <a:pPr indent="0"/>
    <a:r><a:rPr sz="1400"/><a:t>\n</a:t></a:r>
  </a:p>
</a:txBody>`;

    const runs = extractTextRuns(parseXml(txBodyXml), {}, null);

    expect(runs[0].text).toBe('????');
    expect(runs[0].options.align).toBe('center');
    expect(runs[0].options.bold).toBe(true);
  });

  it('run ?? pPr ??????? pPr', () => {
    const txBodyXml = `<?xml version="1.0" encoding="UTF-8"?>
<a:txBody xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">
  <a:bodyPr/>
  <a:p>
    <a:pPr algn="ctr"/>
    <a:r><a:t>A</a:t></a:r>
    <a:pPr algn="r"/>
    <a:r><a:t>B</a:t></a:r>
    <a:r><a:t>C</a:t></a:r>
  </a:p>
</a:txBody>`;
    const runs = extractTextRuns(parseXml(txBodyXml), {}, null);
    expect(runs[0].text).toBe('A');
    expect(runs[0].options.align).toBe('center');
    const tail = runs.slice(1).map((r) => r.text).join('');
    expect(tail).toContain('B');
    expect(tail).toContain('C');
    expect(runs[1].options.align).toBe('right');
  });
});
