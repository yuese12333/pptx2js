/**
 * 颜色规范化（含主题色解析）。
 * 实现阶段补充 theme 解析逻辑。
 */

/**
 * @param {object} _theme
 * @param {object} _clrNode - OOXML 颜色节点（如 a:solidFill）
 * @returns {string|null} 十六进制颜色，如 "FF0000"
 */
function resolveColor(_theme, _clrNode) {
  return null;
}

module.exports = { resolveColor };
