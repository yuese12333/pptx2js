const { parseXml } = require('../../lib/xml-parser');
const { documentRoot } = require('../../lib/xml-utils');
const { buildRelationIndex } = require('../../lib/rels');
const { extractChart } = require('../../lib/chart');

describe('chart labels and title', () => {
  it('?? multiLvlStrRef ????? chart ? title', async () => {
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
<c:chartSpace xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart"
  xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">
  <c:chart>
    <c:title>
      <c:tx><c:rich><a:p><a:r><a:t>????</a:t></a:r></a:p></c:rich></c:tx>
    </c:title>
    <c:plotArea>
      <c:barChart>
        <c:ser>
          <c:tx><c:strRef><c:strCache><c:pt idx="0"><c:v>??</c:v></c:pt></c:strCache></c:strRef></c:tx>
          <c:cat>
            <c:multiLvlStrRef>
              <c:multiLvlStrCache>
                <c:lvl>
                  <c:pt idx="0"><c:v>Q1</c:v></c:pt>
                  <c:pt idx="1"><c:v>Q2</c:v></c:pt>
                </c:lvl>
              </c:multiLvlStrCache>
            </c:multiLvlStrRef>
          </c:cat>
          <c:val><c:numRef><c:numCache>
            <c:pt idx="0"><c:v>12</c:v></c:pt>
            <c:pt idx="1"><c:v>19</c:v></c:pt>
          </c:numCache></c:numRef></c:val>
        </c:ser>
      </c:barChart>
    </c:plotArea>
  </c:chart>
</c:chartSpace>`;

    const slideRels = `<?xml version="1.0" encoding="UTF-8"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rIdChart" Type="chart" Target="../charts/chart1.xml"/>
</Relationships>`;

    const parsed = {
      'ppt/slides/_rels/slide1.xml.rels': parseXml(slideRels),
      'ppt/charts/chart1.xml': parseXml(chartXml),
    };
    const relIndex = buildRelationIndex(parsed);
    const frame = documentRoot(parseXml(frameXml), 'p:graphicFrame');

    const entity = extractChart(frame, {
      slideIndex: 0,
      slidePath: 'ppt/slides/slide1.xml',
      relIndex,
      parsed,
      offset: { x: 0, y: 0 },
    });

    expect(entity.kind).toBe('chart');
    expect(entity.chart.title).toBe('????');
    expect(entity.chart.data[0].labels).toEqual(['Q1', 'Q2']);
  });
});
