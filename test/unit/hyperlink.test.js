const { parseXml } = require('../../lib/xml-parser');
const { buildRelationIndex } = require('../../lib/rels');
const { extractEntities } = require('../../lib/extractor');

describe('hyperlink', () => {
  it('文本 run 解析超链接', async () => {
    const slideXml = `<?xml version="1.0" encoding="UTF-8"?>
<p:sld xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"
  xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"
  xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <p:cSld>
    <p:spTree>
      <p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>
      <p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/></a:xfrm></p:grpSpPr>
      <p:sp>
        <p:nvSpPr><p:cNvPr id="2" name=""/><p:cNvSpPr/><p:nvPr/></p:nvSpPr>
        <p:spPr><a:xfrm><a:off x="914400" y="914400"/><a:ext cx="4000000" cy="1000000"/></a:xfrm></p:spPr>
        <p:txBody>
          <a:p><a:r>
            <a:rPr><a:hlinkClick r:id="rId5"/></a:rPr>
            <a:t>Click me</a:t>
          </a:r></a:p>
        </p:txBody>
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

    const slideRels = `<?xml version="1.0" encoding="UTF-8"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId5" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink" Target="https://example.com" TargetMode="External"/>
</Relationships>`;

    const parsed = {
      'ppt/presentation.xml': parseXml(presXml),
      'ppt/_rels/presentation.xml.rels': parseXml(presRels),
      'ppt/slides/slide1.xml': parseXml(slideXml),
      'ppt/slides/_rels/slide1.xml.rels': parseXml(slideRels),
    };

    const relIndex = buildRelationIndex(parsed);
    const entities = extractEntities({ relIndex, parsed });
    const text = entities[0].find((e) => e.kind === 'text');

    expect(text.text.runs[0].options.hyperlink.url).toBe('https://example.com');
  });
});
