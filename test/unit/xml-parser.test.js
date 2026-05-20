const { parseXml } = require('../../lib/xml-parser');
const { child, children } = require('../../lib/xml-utils');

describe('xml-parser', () => {
  it('????????????? XML', () => {
    const xml = '<root xmlns:a="http://example"><a:r>text</a:r></root>';
    const doc = parseXml(xml);
    expect(doc.tag).toBe('root');
    expect(children(doc, 'a:r')).toHaveLength(1);
    expect(children(doc, 'a:r')[0].text).toBe('text');
  });

  it('???? children ?????', () => {
    const xml = '<p:sld><p:cSld><p:spTree/></p:cSld></p:sld>';
    const doc = parseXml(xml);
    expect(doc.tag).toBe('p:sld');
    const spTree = child(child(doc, 'p:cSld'), 'p:spTree');
    expect(spTree).toBeDefined();
    expect(Array.isArray(spTree.children)).toBe(true);
  });
});
