const { parseXml } = require('../../lib/xml-parser');
const { buildRelationIndex } = require('../../lib/rels');
const { extractEntities } = require('../../lib/extractor');

describe('flattenGroup', () => {
  it('?? grpSp ?? cxnSp?? p:spTree ???', () => {
    const slideXml = `<?xml version="1.0" encoding="UTF-8"?>
<p:sld xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"
  xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">
  <p:cSld>
    <p:spTree>
      <p:nvGrpSpPr><p:cNvPr id="1"/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>
      <p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/></a:xfrm></p:grpSpPr>
      <p:grpSp>
        <p:nvGrpSpPr><p:cNvPr id="2"/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>
        <p:grpSpPr>
          <a:xfrm>
            <a:off x="100000" y="200000"/>
            <a:ext cx="5000000" cy="3000000"/>
            <a:chOff x="0" y="0"/>
          </a:xfrm>
        </p:grpSpPr>
        <p:cxnSp>
          <p:nvCxnSpPr><p:cNvPr id="3"/><p:cNvCxnSpPr/><p:nvPr/></p:nvCxnSpPr>
          <p:spPr>
            <a:xfrm>
              <a:off x="200000" y="300000"/>
              <a:ext cx="1000000" cy="0"/>
            </a:xfrm>
            <a:prstGeom prst="line"><a:avLst/></a:prstGeom>
            <a:ln w="12700">
              <a:solidFill><a:srgbClr val="FF0000"/></a:solidFill>
            </a:ln>
          </p:spPr>
        </p:cxnSp>
      </p:grpSp>
    </p:spTree>
  </p:cSld>
</p:sld>`;

    const presXml = `<?xml version="1.0" encoding="UTF-8"?>
<p:presentation xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"
  xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <p:sldIdLst><p:sldId id="256" r:id="rId1"/></p:sldIdLst>
  <p:sldSz cx="9144000" cy="6858000"/>
</p:presentation>`;

    const presRels = `<?xml version="1.0" encoding="UTF-8"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="slide" Target="slides/slide1.xml"/>
</Relationships>`;

    const parsed = {
      'ppt/presentation.xml': parseXml(presXml),
      'ppt/_rels/presentation.xml.rels': parseXml(presRels),
      'ppt/slides/slide1.xml': parseXml(slideXml),
    };
    const relIndex = buildRelationIndex(parsed);
    const entities = extractEntities({ relIndex, parsed });

    const lines = entities[0].filter((e) => e.kind === 'shape' && e.shape?.type === 'LINE');
    expect(lines.length).toBe(1);
    expect(lines[0].shape.line).toBe('FF0000');
  });
});
