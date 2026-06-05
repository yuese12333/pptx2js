/**
 * graphicFrame 辅助：识别表格 / 图表等 graphicData URI
 */
const { attr, child } = require('./xml-utils');

const URI_TABLE =
  'http://schemas.openxmlformats.org/drawingml/2006/table';
const URI_CHART =
  'http://schemas.openxmlformats.org/drawingml/2006/chart';

/**
 * @param {object} graphicFrame
 * @returns {string|undefined}
 */
function getGraphicUri(graphicFrame) {
  const graphicData = child(child(graphicFrame, 'a:graphic'), 'a:graphicData');
  return attr(graphicData, 'uri');
}

/**
 * @param {object} graphicFrame
 * @returns {boolean}
 */
function isTableFrame(graphicFrame) {
  return getGraphicUri(graphicFrame) === URI_TABLE;
}

/**
 * @param {object} graphicFrame
 * @returns {boolean}
 */
function isChartFrame(graphicFrame) {
  return getGraphicUri(graphicFrame) === URI_CHART;
}

/**
 * @param {object} graphicFrame
 * @returns {boolean}
 */
function isSmartArtFrame(graphicFrame) {
  const uri = getGraphicUri(graphicFrame);
  return Boolean(uri && uri.includes('diagram'));
}

/**
 * @param {object} graphicFrame
 * @returns {object|null} p:xfrm 节点
 */
function getGraphicXfrm(graphicFrame) {
  return child(graphicFrame, 'p:xfrm');
}

module.exports = {
  URI_TABLE,
  URI_CHART,
  getGraphicUri,
  isTableFrame,
  isChartFrame,
  isSmartArtFrame,
  getGraphicXfrm,
};
