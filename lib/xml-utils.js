/**
 * OOXML 节点访问工具
 * 配合自定义 xml-parser.js 使用
 *
 * 节点结构：{ tag, attrs, children: OONode[], text }
 *
 * 迁移对照表：
 *   旧: child(node, 'a:r')          → 新: child(node, 'a:r')       ← 不变
 *   旧: asArray(node['a:r'])         → 新: children(node, 'a:r')    ← 主要变化
 *   旧: attr(node, 'w')             → 新: attr(node, 'w')           ← 不变
 *   旧: textContent(node['a:t'])    → 新: textContent(child(node,'a:t')) ← 不变
 */

/**
 * 取第一个匹配 tag 的子节点
 * @param {import('./xml-parser').OONode|null|undefined} node
 * @param {string} tag
 * @returns {import('./xml-parser').OONode|undefined}
 */
function child(node, tag) {
  if (!node || !node.children) return undefined;
  return node.children.find(c => c.tag === tag);
}

/**
 * 取所有匹配 tag 的子节点（始终返回数组，消除 xml2js 单/多不一致）
 * @param {import('./xml-parser').OONode|null|undefined} node
 * @param {string} tag
 * @returns {import('./xml-parser').OONode[]}
 */
function children(node, tag) {
  if (!node || !node.children) return [];
  return node.children.filter(c => c.tag === tag);
}

/**
 * 取节点的有序子节点列表（保留所有 tag，用于顺序敏感场景如 a:p）
 * @param {import('./xml-parser').OONode|null|undefined} node
 * @returns {import('./xml-parser').OONode[]}
 */
function childNodes(node) {
  if (!node || !node.children) return [];
  return node.children;
}

/**
 * 取属性值
 * @param {import('./xml-parser').OONode|null|undefined} node
 * @param {string} name
 * @returns {string|undefined}
 */
function attr(node, name) {
  if (!node || !node.attrs) return undefined;
  return node.attrs[name];
}

/**
 * 取文本内容
 * @param {import('./xml-parser').OONode|null|undefined} node
 * @returns {string}
 */
function textContent(node) {
  if (node == null) return '';
  if (typeof node === 'string') return node;
  if (typeof node === 'number') return String(node);
  return node.text ?? '';
}

/**
 * 兼容旧版 asArray（对迁移中未改完的调用点提供临时支持）
 * 新代码应直接用 children(node, tag) 代替 asArray(node[tag])
 * @param {*} value
 * @returns {Array}
 */
function asArray(value) {
  if (value == null) return [];
  return Array.isArray(value) ? value : [value];
}

/**
 * 取第一个匹配多个 tag 之一的子节点
 * @param {import('./xml-parser').OONode|null|undefined} node
 * @param {string[]} tags
 * @returns {import('./xml-parser').OONode|undefined}
 */
function firstChild(node, tags) {
  if (!node || !node.children) return undefined;
  for (const tag of tags) {
    const found = node.children.find(c => c.tag === tag);
    if (found != null) return found;
  }
  return undefined;
}

/**
 * parseXml 返回文档根 OONode；若已是目标 tag 则直接返回，否则取同名子节点
 * @param {import('./xml-parser').OONode|null|undefined} doc
 * @param {...string} tags
 * @returns {import('./xml-parser').OONode|undefined}
 */
function documentRoot(doc, ...tags) {
  if (!doc) return undefined;
  if (tags.includes(doc.tag)) return doc;
  for (const tag of tags) {
    const found = child(doc, tag);
    if (found) return found;
  }
  return undefined;
}

module.exports = {
  child,
  children,
  childNodes,
  attr,
  textContent,
  asArray,
  firstChild,
  documentRoot,
};