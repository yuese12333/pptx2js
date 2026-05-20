/**
 * 项目唯一导出的 XML 解析器实例。
 * 全项目必须使用此入口，禁止在模块内自行实例化解析器。
 * @see design.html §4.6
 */
const xml2js = require('xml2js');

const PARSER_OPTIONS = {
  explicitArray: false,
  mergeAttrs: false,
  explicitCharkey: false,
  tagNameProcessors: [],
  attrNameProcessors: [],
  xmlns: false,
};

/**
 * @param {string} str
 * @returns {Promise<object>}
 */
function parseXml(str) {
  return xml2js.parseStringPromise(str, PARSER_OPTIONS);
}

module.exports = { parseXml, PARSER_OPTIONS };
