const { generateScript, escapeJs } = require('../../lib/codegen');

describe('codegen', () => {
  it('escapeJs 转义特殊字符', () => {
    expect(escapeJs("a'b\nc")).toBe("a\\'b\\nc");
  });

  it('生成含文本与版式的脚本', () => {
    const script = generateScript({
      layout: { width: 10, height: 7.5 },
      slides: [
        {
          index: 0,
          background: { color: 'FFFFFF' },
          elements: [
            {
              type: 'text',
              bounds: { x: 1, y: 1, w: 8, h: 1 },
              runs: [{ text: 'Hi', options: { fontSize: 24, color: '333333' } }],
            },
          ],
        },
      ],
    });

    expect(script).toContain("defineLayout({ name: 'PPTX_IMPORT'");
    expect(script).toContain("addText(");
    expect(script).toContain('Hi');
    expect(script).not.toContain('TODO');
  });
});
