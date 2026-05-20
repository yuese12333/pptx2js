const { parseXml } = require('../../lib/xml-parser');
const { documentRoot } = require('../../lib/xml-utils');
const { buildRelationIndex } = require('../../lib/rels');
const { extractSmartArt } = require('../../lib/smartart');

describe('smartart', () => {
  it('? dgm:data ??????', async () => {
    const frameXml = `<?xml version="1.0" encoding="UTF-8"?>
<p:graphicFrame xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"
  xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"
  xmlns:dgm="http://schemas.openxmlformats.org/drawingml/2006/diagram"
  xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <p:xfrm><a:off x="0" y="0"/><a:ext cx="3000000" cy="2000000"/></p:xfrm>
  <a:graphic>
    <a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/diagram">
      <dgm:relIds r:dm="rIdDm"/>
    </a:graphicData>
  </a:graphic>
</p:graphicFrame>`;

    const dataXml = `<?xml version="1.0" encoding="UTF-8"?>
<dgm:dataModel xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"
  xmlns:dgm="http://schemas.openxmlformats.org/drawingml/2006/diagram">
  <dgm:pt><a:t>Node A</a:t></dgm:pt>
  <dgm:pt><a:t>Node B</a:t></dgm:pt>
</dgm:dataModel>`;

    const slideRels = `<?xml version="1.0" encoding="UTF-8"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rIdDm" Type="diagramData" Target="../diagrams/data1.xml"/>
</Relationships>`;

    const parsed = {
      'ppt/slides/_rels/slide1.xml.rels': parseXml(slideRels),
      'ppt/diagrams/data1.xml': parseXml(dataXml),
    };
    const relIndex = buildRelationIndex(parsed);
    const frame = documentRoot(parseXml(frameXml), 'p:graphicFrame');

    const entity = extractSmartArt(frame, {
      slideIndex: 0,
      slidePath: 'ppt/slides/slide1.xml',
      relIndex,
      parsed,
      offset: { x: 0, y: 0 },
    });

    expect(entity.kind).toBe('text');
    expect(entity.text.runs.map((r) => r.text).join(' ')).toContain('Node A');
    expect(entity.degradeReason).toContain('SmartArt');
  });

  it('?? xml ?????????', async () => {
    const frameXml = `<?xml version="1.0" encoding="UTF-8"?>
<p:graphicFrame xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"
  xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"
  xmlns:dgm="http://schemas.openxmlformats.org/drawingml/2006/diagram"
  xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <p:xfrm><a:off x="0" y="0"/><a:ext cx="3000000" cy="2000000"/></p:xfrm>
  <a:graphic>
    <a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/diagram">
      <dgm:relIds r:dm="rIdDm"/>
    </a:graphicData>
  </a:graphic>
</p:graphicFrame>`;

    const dataXml = `<?xml version="1.0" encoding="UTF-8"?>
<dgm:dataModel xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"
  xmlns:dgm="http://schemas.openxmlformats.org/drawingml/2006/diagram">
  <dgm:pt modelId="accent1"><a:t>Only this</a:t></dgm:pt>
</dgm:dataModel>`;

    const slideRels = `<?xml version="1.0" encoding="UTF-8"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rIdDm" Type="diagramData" Target="../diagrams/data1.xml"/>
</Relationships>`;

    const parsed = {
      'ppt/slides/_rels/slide1.xml.rels': parseXml(slideRels),
      'ppt/diagrams/data1.xml': parseXml(dataXml),
    };
    const relIndex = buildRelationIndex(parsed);
    const frame = documentRoot(parseXml(frameXml), 'p:graphicFrame');

    const entity = extractSmartArt(frame, {
      slideIndex: 0,
      slidePath: 'ppt/slides/slide1.xml',
      relIndex,
      parsed,
      offset: { x: 0, y: 0 },
    });

    const allText = entity.text.runs.map((r) => r.text).join(' ');
    expect(allText).toContain('Only this');
    expect(allText).not.toContain('accent1');
  });
});
