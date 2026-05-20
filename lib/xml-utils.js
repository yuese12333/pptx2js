/**
 * xml2js 对象树访问工具（配合 lib/xml-parser.js 统一配置）
 */

/**
 * @param {*} value
 * @returns {Array}
 */
function asArray(value) {
  if (value == null) return [];
  return Array.isArray(value) ? value : [value];
}

/**
 * @param {object|null|undefined} node
 * @returns {Record<string, string>}
 */
function attrs(node) {
  if (node == null) return {};
  if (node.$) return node.$;
  return node;
}

/**
 * @param {object|null|undefined} node
 * @param {string} name
 * @returns {string|undefined}
 */
function attr(node, name) {
  return attrs(node)[name];
}

/**
 * @param {object|null|undefined} node
 * @param {string} key
 * @returns {*}
 */
function child(node, key) {
  if (node == null) return undefined;
  return node[key];
}

/**
 * @param {object|null|undefined} node
 * @param {string[]} keys
 * @returns {*}
 */
function firstChild(node, keys) {
  for (const key of keys) {
    const v = child(node, key);
    if (v != null) return v;
  }
  return undefined;
}

/**
 * @param {object|null|undefined} node
 * @returns {string}
 */
function textContent(node) {
  if (node == null) return '';
  if (typeof node === 'string') return node;
  if (typeof node === 'number') return String(node);
  if (node._ != null) return String(node._);
  return '';
}

module.exports = { asArray, attrs, attr, child, firstChild, textContent };
