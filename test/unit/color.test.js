const { parseXml } = require('../../lib/xml-parser');
const { resolveFillColor, DEFAULT_SCHEME } = require('../../lib/utils/color');

describe('color', () => {
  it('??????? a:srgbClr', () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<a:gradFill xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">
  <a:gsLst>
    <a:gs pos="0"><a:srgbClr val="FF6600"/></a:gs>
  </a:gsLst>
</a:gradFill>`;
    const doc = parseXml(xml);
    const { color, degraded } = resolveFillColor(doc, DEFAULT_SCHEME);
    expect(degraded).toBe(true);
    expect(color).toBe('FF6600');
  });

  it('??????? a:schemeClr', () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<a:gradFill xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">
  <a:gsLst>
    <a:gs pos="0">
      <a:schemeClr val="accent1"/>
    </a:gs>
  </a:gsLst>
</a:gradFill>`;
    const doc = parseXml(xml);
    const { color, degraded } = resolveFillColor(doc, DEFAULT_SCHEME);
    expect(degraded).toBe(true);
    expect(color).toBe(DEFAULT_SCHEME.accent1);
  });

  it('????? pos ?????????', () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<a:gradFill xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">
  <a:gsLst>
    <a:gs pos="100000"><a:srgbClr val="00FF00"/></a:gs>
    <a:gs pos="0"><a:srgbClr val="FF6600"/></a:gs>
  </a:gsLst>
</a:gradFill>`;
    const doc = parseXml(xml);
    const { color } = resolveFillColor(doc, DEFAULT_SCHEME);
    expect(color).toBe('FF6600');
  });

  it('ptnFill ??????', () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<a:ptnFill xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" prst="pct5">
  <a:fgClr><a:srgbClr val="AABBCC"/></a:fgClr>
  <a:bgClr><a:srgbClr val="FFFFFF"/></a:bgClr>
</a:ptnFill>`;
    const doc = parseXml(xml);
    const { color, degraded } = resolveFillColor(doc, DEFAULT_SCHEME);
    expect(degraded).toBe(true);
    expect(color).toBe('AABBCC');
  });

  it('srgbClr ?? shade ??', () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<a:solidFill xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">
  <a:srgbClr val="FFFFFF">
    <a:shade val="50000"/>
  </a:srgbClr>
</a:solidFill>`;
    const doc = parseXml(xml);
    const { color } = resolveFillColor(doc, DEFAULT_SCHEME);
    expect(color).toBe('808080');
  });

  it('schemeClr shade ?? pct ????', () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<a:solidFill xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">
  <a:schemeClr val="accent6">
    <a:shade val="50000"/>
  </a:schemeClr>
</a:solidFill>`;
    const doc = parseXml(xml);
    const { color } = resolveFillColor(doc, DEFAULT_SCHEME);
    expect(color).toBe('385724');
  });

  it('schemeClr ?? lumMod ??', () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<a:solidFill xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">
  <a:schemeClr val="accent6">
    <a:lumMod val="50000"/>
  </a:schemeClr>
</a:solidFill>`;
    const doc = parseXml(xml);
    const { color } = resolveFillColor(doc, DEFAULT_SCHEME);
    expect(color).toBe('385724');
  });
});
