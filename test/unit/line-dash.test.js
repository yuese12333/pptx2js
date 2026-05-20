const { parseXml } = require('../../lib/xml-parser');
const { extractEntities } = require('../../lib/extractor');
const { buildRelationIndex } = require('../../lib/rels');

describe('line dash', () => {
  it('提取 prstDash 并写�?shape.lineDash', async () => {
    const slideXml = `<?xml version="1.0" encoding="UTF-8"?>
<p:sld xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"
  xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">
  <p:cSld><p:spTree>
    <p:nvGrpSpPr><p:cNvPr id="1"/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>
    <p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>
    <p:sp>
      <p:nvSpPr><p:cNvPr id="2"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr>
      <p:spPr>
        <a:xfrm><a:off x="914400" y="914400"/><a:ext cx="1828800" cy="1828800"/></a:xfrm>
        <a:prstGeom prst="rect"><a:avLst/></a:prstGeom>
        <a:ln w="12700">
          <a:solidFill><a:srgbClr val="FF0000"/></a:solidFill>
          <a:prstDash val="dash"/>
        </a:ln>
      </p:spPr>
    </p:sp>
  </p:spTree></p:cSld>
</p:sld>`;

    const presRels = `<?xml version="1.0" encoding="UTF-8"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide1.xml"/>
</Relationships>`;

    const presXml = `<?xml version="1.0" encoding="UTF-8"?>
<p:presentation xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
  <p:sldIdLst><p:sldId id="256" r:id="rId1"/></p:sldIdLst>
  <p:sldSz cx="9144000" cy="6858000"/>
</p:presentation>`;

    const parsed = {
      'ppt/presentation.xml': parseXml(presXml),
      'ppt/_rels/presentation.xml.rels': parseXml(presRels),
      'ppt/slides/slide1.xml': parseXml(slideXml),
    };
    const relIndex = buildRelationIndex(parsed);
    const slides = extractEntities({ parsed, relIndex });
    const shape = slides[0].find((e) => e.kind === 'shape');
    expect(shape.shape.lineDash).toBe('dash');
    expect(shape.shape.line).toBe('FF0000');
  });
});
