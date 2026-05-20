const { parseXml } = require('../../lib/xml-parser');
const { buildRelationIndex } = require('../../lib/rels');
const { child, children, documentRoot } = require('../../lib/xml-utils');
const { buildSlideInheritance, getEffectiveXfrm } = require('../../lib/placeholder');
const { boundsFromXfrm } = require('../../lib/utils/bounds');

describe('placeholder grpSp walk', () => {
  const layoutXml = `<?xml version="1.0" encoding="UTF-8"?>
<p:sldLayout xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"
  xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">
  <p:cSld><p:spTree>
    <p:nvGrpSpPr><p:cNvPr id="1"/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>
    <p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>
    <p:grpSp>
      <p:nvGrpSpPr><p:cNvPr id="10"/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>
      <p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>
      <p:sp>
        <p:nvSpPr><p:cNvPr id="11"/><p:cNvSpPr/><p:nvPr><p:ph type="body" idx="1"/></p:nvPr></p:nvSpPr>
        <p:spPr><a:xfrm><a:off x="2000000" y="3000000"/><a:ext cx="4000000" cy="800000"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></p:spPr>
      </p:sp>
    </p:grpSp>
  </p:spTree></p:cSld>
</p:sldLayout>`;

  const slideXml = `<?xml version="1.0" encoding="UTF-8"?>
<p:sld xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"
  xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">
  <p:cSld><p:spTree>
    <p:nvGrpSpPr><p:cNvPr id="1"/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>
    <p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>
    <p:sp>
      <p:nvSpPr><p:cNvPr id="2"/><p:cNvSpPr/><p:nvPr><p:ph type="body" idx="1"/></p:nvPr></p:nvSpPr>
      <p:spPr/>
      <p:txBody><a:bodyPr/><a:lstStyle/><a:p><a:r><a:t>Body</a:t></a:r></a:p></p:txBody>
    </p:sp>
  </p:spTree></p:cSld>
</p:sld>`;

  const slideRels = `<?xml version="1.0" encoding="UTF-8"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout1.xml"/>
</Relationships>`;

  it('组合内占位符 xfrm 可被继承', () => {
    const parsed = {
      'ppt/slides/slide1.xml': parseXml(slideXml),
      'ppt/slides/_rels/slide1.xml.rels': parseXml(slideRels),
      'ppt/slideLayouts/slideLayout1.xml': parseXml(layoutXml),
    };
    const relIndex = buildRelationIndex(parsed);
    const inheritance = buildSlideInheritance(parsed, relIndex, 'ppt/slides/slide1.xml');
    const slide = documentRoot(parsed['ppt/slides/slide1.xml'], 'p:sld');
    const sp = children(child(child(slide, 'p:cSld'), 'p:spTree'), 'p:sp')[0];
    const xfrm = getEffectiveXfrm(sp, inheritance);
    const bounds = boundsFromXfrm(xfrm);
    expect(bounds.w).toBeGreaterThan(4);
    expect(bounds.y).toBeGreaterThan(2);
  });
});
