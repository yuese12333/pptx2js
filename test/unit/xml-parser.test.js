const { parseXml } = require('../../lib/xml-parser');

describe('xml-parser', () => {
  it('解析带子节点命名空间前缀的 XML', async () => {
    const xml = '<root xmlns:a="http://example"><a:r>text</a:r></root>';
    const doc = await parseXml(xml);
    expect(doc).toBeDefined();
    expect(doc.root).toBeDefined();
  });

  it('单子节点不包裹为数组（explicitArray: false）', async () => {
    const xml = '<p:sld><p:cSld><p:spTree/></p:cSld></p:sld>';
    const doc = await parseXml(xml);
    const sld = doc['p:sld'];
    expect(sld).toBeDefined();
    expect(Array.isArray(sld)).toBe(false);
  });
});
