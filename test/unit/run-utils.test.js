const {
  compressRunOptions,
  compressTextRuns,
  compressCellBorder,
} = require('../../lib/run-utils');

describe('run-utils', () => {
  it('compressRunOptions 剔除默认黑色与简化 underline', () => {
    expect(compressRunOptions({ color: '000000', underline: { style: 'sng' } })).toEqual({
      underline: true,
    });
  });

  it('compressTextRuns 合并相邻同样式并吸收换行 run', () => {
    const merged = compressTextRuns([
      { text: '左对齐', options: { fontSize: 14 } },
      { text: '\r\n', options: { fontSize: 14, bullet: true } },
      { text: '下一行', options: { fontSize: 14 } },
    ]);
    expect(merged).toHaveLength(1);
    expect(merged[0].text).toContain('左对齐');
    expect(merged[0].text).toContain('下一行');
  });

  it('compressCellBorder 四边一致时合并简写', () => {
    const border = compressCellBorder({
      left: { color: 'FF0000', pt: 1 },
      right: { color: 'FF0000', pt: 1 },
      top: { color: 'FF0000', pt: 1 },
      bottom: { color: 'FF0000', pt: 1 },
    });
    expect(border).toEqual({ type: 'solid', color: 'FF0000', pt: 1 });
  });
});
