/**
 * ④ 映射引擎
 * 将提取实体翻译为平台无关 IR；EMU→英寸、颜色规范化、Z-order 排序。
 */

/**
 * @typedef {object} IntermediateRepresentation
 * @property {object[]} slides
 * @property {object} layout
 */

/**
 * @param {import('./extractor').SlideEntity[][]} entities
 * @param {object} _ctx
 * @returns {IntermediateRepresentation}
 */
function mapToIR(entities, _ctx) {
  return {
    slides: entities.map((slideEntities, i) => ({
      index: i,
      elements: slideEntities,
    })),
    layout: {},
  };
}

module.exports = { mapToIR };
