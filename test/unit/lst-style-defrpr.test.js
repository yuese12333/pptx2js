const { parseXml } = require('../../lib/xml-parser');
const { extractTextRuns } = require('../../lib/text-utils');

describe('lstStyle defRPr inheritance', () => {
  it('inherits fontSize and color from lvl1pPr defRPr when rPr is empty', () => {
    const txBodyXml = `<?xml version="1.0" encoding="UTF-8"?>
<a:txBody xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">
  <a:lstStyle>
    <a:lvl1pPr>
      <a:defRPr sz="3200" b="1">
        <a:solidFill><a:srgbClr val="00B050"/></a:solidFill>
        <a:latin typeface="微软雅黑"/>
      </a:defRPr>
    </a:lvl1pPr>
  </a:lstStyle>
  <a:p>
    <a:r><a:t>标题</a:t></a:r>
  </a:p>
</a:txBody>`;

    const runs = extractTextRuns(parseXml(txBodyXml), {}, null);
    expect(runs[0].text).toBe('标题');
    expect(runs[0].options.fontSize).toBe(32);
    expect(runs[0].options.bold).toBe(true);
    expect(runs[0].options.color).toBe('00B050');
    expect(runs[0].options.fontFace).toBe('微软雅黑');
  });
});
