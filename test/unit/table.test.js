const { parseXml } = require('../../lib/xml-parser');
const { extractTable } = require('../../lib/table');

describe('table', () => {
  it('提取内联表格', async () => {
    const frameXml = `<?xml version="1.0" encoding="UTF-8"?>
<p:graphicFrame xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"
  xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">
  <p:xfrm><a:off x="1000000" y="1000000"/><a:ext cx="4000000" cy="2000000"/></p:xfrm>
  <a:graphic>
    <a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/table">
      <a:tbl>
        <a:tblGrid><a:gridCol w="2000000"/><a:gridCol w="2000000"/></a:tblGrid>
        <a:tr>
          <a:tc><a:txBody><a:p><a:r><a:t>A1</a:t></a:r></a:p></a:txBody></a:tc>
          <a:tc><a:txBody><a:p><a:r><a:t>B1</a:t></a:r></a:p></a:txBody></a:tc>
        </a:tr>
      </a:tbl>
    </a:graphicData>
  </a:graphic>
</p:graphicFrame>`;

    const { documentRoot } = require('../../lib/xml-utils');
    const frame = documentRoot(parseXml(frameXml), 'p:graphicFrame');
    const entity = extractTable(frame, {
      slideIndex: 0,
      slidePath: 'ppt/slides/slide1.xml',
      offset: { x: 0, y: 0 },
      scheme: {},
    });

    expect(entity.kind).toBe('table');
    expect(entity.table.rows).toHaveLength(1);
    expect(entity.table.rows[0][0].text).toBe('A1');
    expect(entity.table.rows[0][1].text).toBe('B1');
  });
});
