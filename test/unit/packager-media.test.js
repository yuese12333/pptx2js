const { uniqueMediaFileName, applyMediaPathsToIR } = require('../../lib/packager');

describe('packager media names', () => {
  it('重名 basename 自动加后缀', () => {
    const used = new Set();
    const a = uniqueMediaFileName('ppt/media/image1.png', used);
    const b = uniqueMediaFileName('ppt/media/sub/image1.png', used);
    expect(a).toBe('image1.png');
    expect(b).toBe('image1_2.png');
  });

  it('applyMediaPathsToIR 更新图片 mediaPath', () => {
    const ir = {
      slides: [
        {
          elements: [
            { type: 'image', zipPath: 'ppt/media/a.png', mediaPath: 'media/a.png' },
          ],
        },
      ],
    };
    applyMediaPathsToIR(ir, new Map([['ppt/media/a.png', 'media/a_renamed.png']]));
    expect(ir.slides[0].elements[0].mediaPath).toBe('media/a_renamed.png');
  });
});
