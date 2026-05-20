const { parseXml } = require('../../lib/xml-parser');
const { buildRelationIndex } = require('../../lib/rels');
const {
  buildSlideInheritance,
  mergeXfrm,
  getEffectiveXfrm,
} = require('../../lib/placeholder');

describe('placeholder', () => {
  const layoutXml = `<?xml version="1.0" encoding="UTF-8"?>
<p:sldLayout xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"
  xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">
  <p:cSld>
    <p:spTree>
      <p:sp>
        <p:nvSpPr><p:nvPr><p:ph type="ctrTitle" idx="0"/></p:nvPr></p:nvSpPr>
        <p:spPr><a:xfrm><a:off x="1000000" y="2000000"/><a:ext cx="5000000" cy="1000000"/></a:xfrm></p:spPr>
      </p:sp>
    </p:spTree>
  </p:cSld>
</p:sldLayout>`;

  const slideXml = `<?xml version="1.0" encoding="UTF-8"?>
<p:sld xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"
  xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">
  <p:cSld>
    <p:spTree>
      <p:sp>
        <p:nvSpPr><p:nvPr><p:ph type="ctrTitle" idx="0"/></p:nvPr></p:nvSpPr>
        <p:txBody><a:p><a:r><a:t>Title</a:t></a:r></a:p></p:txBody>
      </p:sp>
    </p:spTree>
  </p:cSld>
</p:sld>`;

  const slideRels = `<?xml version="1.0" encoding="UTF-8"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout1.xml"/>
</Relationships>`;

  it('从 layout 层继承 xfrm 尺寸', async () => {
    const parsed = {
      'ppt/slides/slide1.xml': await parseXml(slideXml),
      'ppt/slides/_rels/slide1.xml.rels': await parseXml(slideRels),
      'ppt/slideLayouts/slideLayout1.xml': await parseXml(layoutXml),
    };
    const relIndex = buildRelationIndex(parsed);
    const inheritance = buildSlideInheritance(
      parsed,
      relIndex,
      'ppt/slides/slide1.xml'
    );

    expect(inheritance.layoutPath).toBe('ppt/slideLayouts/slideLayout1.xml');

    const sp = parsed['ppt/slides/slide1.xml']['p:sld']['p:cSld']['p:spTree']['p:sp'];
    const xfrm = getEffectiveXfrm(sp, inheritance);
    const { boundsFromXfrm } = require('../../lib/utils/bounds');
    const bounds = boundsFromXfrm(xfrm);

    expect(bounds.w).toBeGreaterThan(5);
    expect(bounds.h).toBeGreaterThan(1);
  });

  it('off 与 ext 逐属性独立继承（slide 无 xfrm 时用 layout）', () => {
    const merged = mergeXfrm(
      null,
      { 'a:off': { $: { x: '100', y: '200' } }, 'a:ext': { $: { cx: '300', cy: '400' } } },
      null
    );
    expect(merged['a:off'].$).toEqual({ x: '100', y: '200' });
    expect(merged['a:ext'].$).toEqual({ cx: '300', cy: '400' });
  });

  it('slide 显式 cx/cy 为 0 时跳过并继承 layout 尺寸', () => {
    const merged = mergeXfrm(
      { 'a:off': { $: { x: '0', y: '0' } }, 'a:ext': { $: { cx: '0', cy: '0' } } },
      { 'a:off': { $: { x: '100', y: '200' } }, 'a:ext': { $: { cx: '300', cy: '400' } } },
      null
    );
    expect(merged['a:off'].$).toEqual({ x: '0', y: '0' });
    expect(merged['a:ext'].$).toEqual({ cx: '300', cy: '400' });
  });
});
