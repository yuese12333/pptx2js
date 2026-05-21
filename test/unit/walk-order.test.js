const { parseXml } = require('../../lib/xml-parser');
const { childNodes } = require('../../lib/xml-utils');

describe('spTree document order', () => {
  it('childNodes preserves pic before sp order', () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<p:spTree xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"
          xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">
  <p:nvGrpSpPr/>
  <p:grpSpPr/>
  <p:pic/>
  <p:sp/>
</p:spTree>`;
    const doc = parseXml(xml);
    const tags = childNodes(doc)
      .map((n) => n.tag)
      .filter((t) => t === 'p:pic' || t === 'p:sp');
    expect(tags).toEqual(['p:pic', 'p:sp']);
  });
});
