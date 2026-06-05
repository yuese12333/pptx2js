const { parseXml, decodeOoxmlText } = require('../../lib/xml-parser');
const { child, children } = require('../../lib/xml-utils');

describe('xml-parser', () => {
  it('正确解析带命名空间前缀的 XML', () => {
    const xml = '<root xmlns:a="http://example"><a:r>text</a:r></root>';
    const doc = parseXml(xml);
    expect(doc.tag).toBe('root');
    expect(children(doc, 'a:r')).toHaveLength(1);
    expect(children(doc, 'a:r')[0].text).toBe('text');
  });

  it('空节点 children 始终返回数组', () => {
    const xml = '<p:sld><p:cSld><p:spTree/></p:cSld></p:sld>';
    const doc = parseXml(xml);
    expect(doc.tag).toBe('p:sld');
    const spTree = child(child(doc, 'p:cSld'), 'p:spTree');
    expect(spTree).toBeDefined();
    expect(Array.isArray(spTree.children)).toBe(true);
  });

  it('decodeOoxmlText 单次解码实体且不处理 _xHHHH_', () => {
    expect(decodeOoxmlText('&amp;lt;')).toBe('&lt;');
    expect(decodeOoxmlText('_x0041_')).toBe('_x0041_');
    expect(decodeOoxmlText('&#39;')).toBe("'");
  });
});
