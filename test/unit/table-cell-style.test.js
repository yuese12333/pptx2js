const { parseXml } = require('../../lib/xml-parser');
const { extractTable } = require('../../lib/table');

describe('table cell text styles', () => {
  it('提取单元格内 bold 与文字颜色', async () => {
    const frameXml = `<?xml version="1.0" encoding="UTF-8"?>
<p:graphicFrame xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"
  xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">
  <p:xfrm><a:off x="0" y="0"/><a:ext cx="3000000" cy="2000000"/></p:xfrm>
  <a:graphic>
    <a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/table">
      <a:tbl>
        <a:tblGrid><a:gridCol w="2000000"/></a:tblGrid>
        <a:tr>
          <a:tc>
            <a:tcPr><a:solidFill><a:srgbClr val="4472C4"/></a:solidFill></a:tcPr>
            <a:txBody>
              <a:p>
                <a:r>
                  <a:rPr b="1"><a:solidFill><a:srgbClr val="FFFFFF"/></a:solidFill></a:rPr>
                  <a:t>产品</a:t>
                </a:r>
              </a:p>
            </a:txBody>
          </a:tc>
        </a:tr>
      </a:tbl>
    </a:graphicData>
  </a:graphic>
</p:graphicFrame>`;

    const frame = (await parseXml(frameXml))['p:graphicFrame'];
    const entity = extractTable(frame, {
      slideIndex: 0,
      slidePath: 'ppt/slides/slide1.xml',
      offset: { x: 0, y: 0 },
      scheme: {},
    });

    const cell = entity.table.rows[0][0];
    expect(cell.text).toBe('产品');
    expect(cell.options.bold).toBe(true);
    expect(cell.options.color).toBe('FFFFFF');
    expect(cell.options.fill).toBe('4472C4');
  });
});
