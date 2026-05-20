const { parseXml } = require('../../lib/xml-parser');
const { extractTable } = require('../../lib/table');

describe('table border', () => {
  it('提取单元格四边边框', async () => {
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
            <a:tcPr>
              <a:lnL w="12700"><a:solidFill><a:srgbClr val="FF0000"/></a:solidFill></a:lnL>
            </a:tcPr>
            <a:txBody><a:p><a:r><a:t>X</a:t></a:r></a:p></a:txBody>
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
    expect(cell.options.border.left.color).toBe('FF0000');
    expect(cell.options.border.left.pt).toBe(1);
  });

  it('四边一致时合并为简写 border', async () => {
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
            <a:tcPr>
              <a:lnL w="12700"><a:solidFill><a:srgbClr val="FF0000"/></a:solidFill></a:lnL>
              <a:lnR w="12700"><a:solidFill><a:srgbClr val="FF0000"/></a:solidFill></a:lnR>
              <a:lnT w="12700"><a:solidFill><a:srgbClr val="FF0000"/></a:solidFill></a:lnT>
              <a:lnB w="12700"><a:solidFill><a:srgbClr val="FF0000"/></a:solidFill></a:lnB>
            </a:tcPr>
            <a:txBody><a:p><a:r><a:t>X</a:t></a:r></a:p></a:txBody>
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

    expect(entity.table.rows[0][0].options.border).toEqual({
      type: 'solid',
      color: 'FF0000',
      pt: 1,
    });
  });

  it('边框色误写入 solidFill 时不提取单元格 fill', async () => {
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
            <a:tcPr>
              <a:solidFill><a:srgbClr val="FF0000"/></a:solidFill>
              <a:lnL w="12700"><a:solidFill><a:srgbClr val="FF0000"/></a:solidFill></a:lnL>
              <a:lnR w="12700"><a:solidFill><a:srgbClr val="FF0000"/></a:solidFill></a:lnR>
              <a:lnT w="12700"><a:solidFill><a:srgbClr val="FF0000"/></a:solidFill></a:lnT>
              <a:lnB w="12700"><a:solidFill><a:srgbClr val="FF0000"/></a:solidFill></a:lnB>
            </a:tcPr>
            <a:txBody><a:p><a:r><a:t>42</a:t></a:r></a:p></a:txBody>
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
    expect(cell.options.border.type).toBe('solid');
    expect(cell.options.border.color).toBe('FF0000');
    expect(cell.options.fill).toBeUndefined();
  });
});
