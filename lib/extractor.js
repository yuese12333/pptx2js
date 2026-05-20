/**
 * ③ 实体提取器
 * 遍历幻灯片 spTree，能力检查矩阵标记 FULL / DEGRADE / SKIP；完成三层属性合并。
 */

/** @typedef {'FULL' | 'DEGRADE' | 'SKIP'} ConversionDecision */

/**
 * @typedef {object} SlideEntity
 * @property {number} slideIndex
 * @property {ConversionDecision} decision
 * @property {object} raw
 * @property {object} mergedProps
 */

/**
 * @param {object} _parsed - 预解析后的 XML 对象树
 * @param {object} _ctx
 * @returns {SlideEntity[][]}
 */
function extractEntities(_parsed, _ctx) {
  return [];
}

module.exports = { extractEntities };
