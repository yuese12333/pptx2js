/**
 * SmartArt 退化处理（design.html §4.2）
 */
const { attr, child, textContent } = require('./xml-utils');
const { getGraphicXfrm } = require('./graphic');
const { boundsFromXfrm } = require('./utils/bounds');

/**
 * @param {object} graphicFrame
 * @param {object} ctx
 * @returns {import('./extractor').SlideEntity}
 */
function extractSmartArt(graphicFrame, ctx) {
  const bounds = boundsFromXfrm(getGraphicXfrm(graphicFrame), ctx.offset);

  // 层① 缓存图片：SmartArt 缓存图片的 rels 结构因 PPT 版本差异较大，暂不实现
  // 直接走层② 文本提取

  const texts = extractSmartArtTexts(graphicFrame, ctx);
  if (texts.length) {
    return {
      slideIndex: ctx.slideIndex,
      slidePath: ctx.slidePath,
      decision: 'DEGRADE',
      kind: 'text',
      bounds,
      text: {
        runs: texts.map((t, i) => ({
          text: `${i + 1}. ${t}`,
          options: { fontSize: 12 },
        })),
      },
      degradeReason: 'SmartArt 退化为文本列表',
    };
  }

  return {
    slideIndex: ctx.slideIndex,
    slidePath: ctx.slidePath,
    decision: 'DEGRADE',
    kind: 'text',
    bounds,
    text: {
      runs: [
        {
          text: '[SmartArt 无法解析]',
          options: { fontSize: 12, color: '888888' },
        },
      ],
    },
    degradeReason: 'SmartArt 无可提取文本',
  };
}

/**
 * @param {object} graphicFrame
 * @param {object} ctx
 * @returns {string[]}
 */
function extractSmartArtTexts(graphicFrame, ctx) {
  const graphicData = child(child(graphicFrame, 'a:graphic'), 'a:graphicData');
  const relIds = child(graphicData, 'dgm:relIds');
  const dgmRelId = relIds && (attr(relIds, 'r:dm') ?? attr(relIds, 'dm'));
  const dataPath = dgmRelId && ctx.relIndex.resolve(ctx.slidePath, dgmRelId);
  if (!dataPath || !ctx.parsed[dataPath]) return [];

  const texts = [];
  collectTextNodes(ctx.parsed[dataPath], texts);
  return [...new Set(texts)];
}

/**
 * @param {object} node
 * @param {string[]} out
 */
function collectTextNodes(node, out) {
  if (!node || typeof node !== 'object') return;
  if (node.tag === 'a:t') {
    const t = textContent(node);
    if (t) out.push(t);
    return;
  }
  for (const c of node.children || []) {
    collectTextNodes(c, out);
  }
}

module.exports = { extractSmartArt, extractSmartArtTexts };
