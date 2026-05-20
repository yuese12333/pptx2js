const { parseXml } = require('../../lib/xml-parser');
const { buildRelationIndex } = require('../../lib/rels');
const { child, children, documentRoot } = require('../../lib/xml-utils');
const {
  buildSlideInheritance,
  mergeXfrm,
  getEffectiveXfrm,
} = require('../../lib/placeholder');

function makeXfrm(offAttrs, extAttrs) {
  return {
    tag: 'a:xfrm',
    attrs: {},
    children: [
      { tag: 'a:off', attrs: offAttrs, children: [], text: '' },
      { tag: 'a:ext', attrs: extAttrs, children: [], text: '' },
    ],
    text: '',
  };
}

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

  it('? layout ??? xfrm ??', () => {
    const parsed = {
      'ppt/slides/slide1.xml': parseXml(slideXml),
      'ppt/slides/_rels/slide1.xml.rels': parseXml(slideRels),
      'ppt/slideLayouts/slideLayout1.xml': parseXml(layoutXml),
    };
    const relIndex = buildRelationIndex(parsed);
    const inheritance = buildSlideInheritance(
      parsed,
      relIndex,
      'ppt/slides/slide1.xml'
    );

    expect(inheritance.layoutPath).toBe('ppt/slideLayouts/slideLayout1.xml');

    const slide = documentRoot(parsed['ppt/slides/slide1.xml'], 'p:sld');
    const sp = children(child(child(slide, 'p:cSld'), 'p:spTree'), 'p:sp')[0];
    const xfrm = getEffectiveXfrm(sp, inheritance);
    const { boundsFromXfrm } = require('../../lib/utils/bounds');
    const bounds = boundsFromXfrm(xfrm);

    expect(bounds.w).toBeGreaterThan(5);
    expect(bounds.h).toBeGreaterThan(1);
  });

  it('off ? ext ????????slide ? xfrm ?? layout?', () => {
    const merged = mergeXfrm(
      null,
      makeXfrm({ x: '100', y: '200' }, { cx: '300', cy: '400' }),
      null
    );
    expect(child(merged, 'a:off').attrs).toEqual({ x: '100', y: '200' });
    expect(child(merged, 'a:ext').attrs).toEqual({ cx: '300', cy: '400' });
  });

  it('slide ?? cx/cy ? 0 ?????? layout ??', () => {
    const merged = mergeXfrm(
      makeXfrm({ x: '0', y: '0' }, { cx: '0', cy: '0' }),
      makeXfrm({ x: '100', y: '200' }, { cx: '300', cy: '400' }),
      null
    );
    expect(child(merged, 'a:off').attrs).toEqual({ x: '0', y: '0' });
    expect(child(merged, 'a:ext').attrs).toEqual({ cx: '300', cy: '400' });
  });
});
