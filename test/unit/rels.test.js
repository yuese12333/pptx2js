const { parseXml } = require('../../lib/xml-parser');
const {
  buildRelationIndex,
  resolveTargetPath,
  relsOwnerPath,
} = require('../../lib/rels');

describe('rels', () => {
  it('resolveTargetPath 解析相对路径', () => {
    expect(resolveTargetPath('ppt/slides/slide1.xml', '../media/image1.png')).toBe(
      'ppt/media/image1.png'
    );
  });

  it('resolveTargetPath 解析 PptxGenJS 包根绝对路径 /ppt/charts/...', () => {
    expect(
      resolveTargetPath('ppt/slides/slide4.xml', '/ppt/charts/chart1.xml')
    ).toBe('ppt/charts/chart1.xml');
  });

  it('relsOwnerPath 处理包根 _rels/.rels', () => {
    expect(resolveTargetPath('', 'ppt/presentation.xml')).toBe('ppt/presentation.xml');
    expect(relsOwnerPath('_rels/.rels')).toBe('');
  });

  it('buildRelationIndex 建立 rId 映射', async () => {
    const relsXml = `<?xml version="1.0" encoding="UTF-8"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId2" Type="http://example/slide" Target="slides/slide1.xml"/>
</Relationships>`;
    const parsed = {
      'ppt/_rels/presentation.xml.rels': parseXml(relsXml),
    };
    const index = buildRelationIndex(parsed);
    expect(index.resolve('ppt/presentation.xml', 'rId2')).toBe(
      'ppt/slides/slide1.xml'
    );
  });
});
