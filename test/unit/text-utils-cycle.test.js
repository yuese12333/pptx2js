/**
 * 确保 table 通过 text-utils 取到 extractTextRuns（非循环依赖下的 undefined）
 */
const { extractTable } = require('../../lib/table');
const { parseXml } = require('../../lib/xml-parser');
const { documentRoot } = require('../../lib/xml-utils');

describe('text-utils cycle break', () => {
  it('表格单元格能提取多 run 文本', () => {
    const frameXml = `<?xml version="1.0" encoding="UTF-8"?>
<p:graphicFrame xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"
  xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">
  <p:xfrm><a:off x="0" y="0"/><a:ext cx="4000000" cy="2000000"/></p:xfrm>
  <a:graphic>
    <a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/table">
      <a:tbl>
        <a:tblGrid><a:gridCol w="2000000"/></a:tblGrid>
        <a:tr>
          <a:tc>
            <a:txBody>
              <a:bodyPr/>
              <a:p><a:r><a:rPr b="1"/><a:t>粗体</a:t></a:r></a:p>
            </a:txBody>
          </a:tc>
        </a:tr>
      </a:tbl>
    </a:graphicData>
  </a:graphic>
</p:graphicFrame>`;

    const frame = documentRoot(parseXml(frameXml), 'p:graphicFrame');
    const entity = extractTable(frame, {
      slideIndex: 0,
      slidePath: 'ppt/slides/slide1.xml',
      scheme: {},
    });
    expect(entity).not.toBeNull();
    expect(entity.table.rows[0][0].text).toBe('粗体');
    expect(entity.table.rows[0][0].options.bold).toBe(true);
  });
});
