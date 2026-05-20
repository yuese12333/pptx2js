const { parseXml } = require('../../lib/xml-parser');
const { resolveFillColor, DEFAULT_SCHEME } = require('../../lib/utils/color');

describe('color', () => {
  it('渐变首色标支持 a:srgbClr', async () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<a:gradFill xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">
  <a:gsLst>
    <a:gs pos="0"><a:srgbClr val="FF6600"/></a:gs>
  </a:gsLst>
</a:gradFill>`;
    const doc = await parseXml(xml);
    const { color, degraded } = resolveFillColor(
      { 'a:gradFill': doc['a:gradFill'] },
      DEFAULT_SCHEME
    );
    expect(degraded).toBe(true);
    expect(color).toBe('FF6600');
  });

  it('渐变首色标支持 a:schemeClr', async () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<a:gradFill xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">
  <a:gsLst>
    <a:gs pos="0">
      <a:schemeClr val="accent1"/>
    </a:gs>
  </a:gsLst>
</a:gradFill>`;
    const doc = await parseXml(xml);
    const grad = doc['a:gradFill'];
    const { color, degraded } = resolveFillColor({ 'a:gradFill': grad }, DEFAULT_SCHEME);
    expect(degraded).toBe(true);
    expect(color).toBe(DEFAULT_SCHEME.accent1);
  });
});
