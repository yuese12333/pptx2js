const { parseXml } = require('../../lib/xml-parser');
const { buildRelationIndex } = require('../../lib/rels');
const { getSlidePaths, getSlideSizeInches } = require('../../lib/presentation');

describe('presentation', () => {
  const presXml = `<?xml version="1.0" encoding="UTF-8"?>
<p:presentation xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"
  xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <p:sldIdLst><p:sldId id="256" r:id="rId1"/></p:sldIdLst>
  <p:sldSz cx="9144000" cy="6858000"/>
</p:presentation>`;

  const relsXml = `<?xml version="1.0" encoding="UTF-8"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="slide" Target="slides/slide1.xml"/>
</Relationships>`;

  it('读取幻灯片路径与尺寸', async () => {
    const parsed = {
      'ppt/presentation.xml': parseXml(presXml),
      'ppt/_rels/presentation.xml.rels': parseXml(relsXml),
    };
    const relIndex = buildRelationIndex(parsed);
    expect(getSlidePaths(parsed, relIndex)).toEqual(['ppt/slides/slide1.xml']);
    expect(getSlideSizeInches(parsed)).toEqual({ width: 10, height: 7.5 });
  });
});
