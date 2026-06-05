const { parseXml } = require('../../lib/xml-parser');
const {
  resolveFillColor,
  resolveColorFromContainer,
  DEFAULT_SCHEME,
} = require('../../lib/color');
describe('color', () => {
  it('渐变填充解析 a:srgbClr 首色标', () => {
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

  it('渐变填充解析 a:schemeClr 首色标', () => {
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

  it('渐变色标按 pos 升序取最小色标', () => {
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

  it('ptnFill 图案填充取前景色', () => {
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

  it('srgbClr 应用 shade 修饰', () => {
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

  it('schemeClr shade 百分比修饰正确', () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<a:solidFill xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">
  <a:schemeClr val="accent6">
    <a:shade val="50000"/>
  </a:schemeClr>
</a:solidFill>`;
    const doc = parseXml(xml);
    const { color } = resolveFillColor(doc, DEFAULT_SCHEME);
    expect(color).toBe('385723');
  });

  it('schemeClr 应用 lumMod 修饰', () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<a:solidFill xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">
  <a:schemeClr val="accent6">
    <a:lumMod val="50000"/>
  </a:schemeClr>
</a:solidFill>`;
    const doc = parseXml(xml);
    const { color } = resolveFillColor(doc, DEFAULT_SCHEME);
    expect(color).toBe('385723');
  });

  it('prstClr black resolves', () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<a:solidFill xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">
  <a:prstClr val="black"/>
</a:solidFill>`;
    const doc = parseXml(xml);
    expect(resolveColorFromContainer(doc, DEFAULT_SCHEME)).toBe('000000');
  });

  it('sysClr applies lumMod and lumOff', () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<a:solidFill xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">
  <a:sysClr val="windowText" lastClr="000000">
    <a:lumMod val="85000"/>
    <a:lumOff val="15000"/>
  </a:sysClr>
</a:solidFill>`;
    const doc = parseXml(xml);
    const color = resolveColorFromContainer(doc, DEFAULT_SCHEME);
    expect(color).toBeTruthy();
    expect(color).not.toBe('000000');
  });
});
