const { parseXml } = require('../../lib/xml-parser');
const { buildRelationIndex } = require('../../lib/rels');
const { extractEntities } = require('../../lib/extractor');

describe('shape without text', () => {
  it('无文本但�?prstGeom �?schemeClr 填充时仍提取形状', async () => {
    const slideXml = `<?xml version="1.0" encoding="UTF-8"?>
<p:sld xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"
  xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">
  <p:cSld>
    <p:spTree>
      <p:nvGrpSpPr><p:cNvPr id="1"/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>
      <p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/></a:xfrm></p:grpSpPr>
      <p:sp>
        <p:nvSpPr><p:cNvPr id="2"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr>
        <p:spPr>
          <a:xfrm><a:off x="914400" y="914400"/><a:ext cx="2000000" cy="1000000"/></a:xfrm>
          <a:prstGeom prst="rect"><a:avLst/></a:prstGeom>
          <a:solidFill>
            <a:schemeClr val="accent6">
              <a:lumMod val="60000"/>
            </a:schemeClr>
          </a:solidFill>
        </p:spPr>
      </p:sp>
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

    const shapes = entities[0].filter((e) => e.kind === 'shape' && e.shape?.type === 'RECTANGLE');
    expect(shapes.length).toBe(1);
    expect(shapes[0].shape.fill).toBeTruthy();
  });
});
