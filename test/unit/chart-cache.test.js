const { parseXml } = require('../../lib/xml-parser');
const { buildRelationIndex } = require('../../lib/rels');
const { extractChart } = require('../../lib/chart');

describe('chart cache image', () => {
  it('仅使用图表部件 rels 中的缓存图，不用幻灯片上的其他图片', async () => {
    const frameXml = `<?xml version="1.0" encoding="UTF-8"?>
<p:graphicFrame xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"
  xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"
  xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart"
  xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <p:xfrm><a:off x="0" y="0"/><a:ext cx="4000000" cy="3000000"/></p:xfrm>
  <a:graphic>
    <a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/chart">
      <c:chart r:id="rIdChart"/>
    </a:graphicData>
  </a:graphic>
</p:graphicFrame>`;

    const chartXml = `<?xml version="1.0" encoding="UTF-8"?>
<c:chartSpace xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart">
  <c:chart><c:plotArea><c:doughnutChart/></c:plotArea></c:chart>
</c:chartSpace>`;

    const slideRels = `<?xml version="1.0" encoding="UTF-8"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rIdChart" Type="chart" Target="../charts/chart1.xml"/>
  <Relationship Id="rIdImg" Type="image" Target="../media/unrelated.png"/>
</Relationships>`;

    const chartRels = `<?xml version="1.0" encoding="UTF-8"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="image" Target="../media/chart-cache.png"/>
</Relationships>`;

    const parsed = {
      'ppt/slides/_rels/slide1.xml.rels': await parseXml(slideRels),
      'ppt/charts/chart1.xml': await parseXml(chartXml),
      'ppt/charts/_rels/chart1.xml.rels': await parseXml(chartRels),
    };
    const relIndex = buildRelationIndex(parsed);
    const frame = (await parseXml(frameXml))['p:graphicFrame'];

    const entity = extractChart(frame, {
      slideIndex: 0,
      slidePath: 'ppt/slides/slide1.xml',
      relIndex,
      parsed,
      offset: { x: 0, y: 0 },
    });

    expect(entity.kind).toBe('image');
    expect(entity.image.fileName).toBe('chart-cache.png');
    expect(entity.degradeReason).toContain('缓存图片');
  });
});
