/**
 * 转换流水线编排器
 */
const fs = require('fs');
const path = require('path');
const { parseXml } = require('./xml-parser');
const { unpack, buildRelationIndex } = require('./unpacker');
const { extractEntities } = require('./extractor');
const { mapToIR } = require('./mapper');
const { generateScript } = require('./codegen');
const {
  packageMedia,
  writeConversionLog,
  writeOutputReadme,
} = require('./packager');

/** @typedef {object} ConvertOptions
 * @property {string} [outputDir]
 * @property {boolean} [noMedia]
 * @property {boolean} [strictDegrade]
 * @property {boolean} [strictSkip]
 * @property {'minimal'|'info'|'verbose'} [logLevel]
 * @property {number} [maxFileSize]
 */

/** @typedef {object} ConvertResult
 * @property {string} outputDir
 * @property {string} scriptPath
 * @property {string} logPath
 * @property {object} log
 */

const DEFAULT_OUTPUT = './pptx2js-output';
const DEFAULT_MAX_FILE_SIZE = 50 * 1024 * 1024;

/**
 * @param {string} filePath
 * @param {ConvertOptions} [options]
 * @returns {Promise<ConvertResult>}
 */
async function convert(filePath, options = {}) {
  const resolvedPath = path.resolve(filePath);
  if (!fs.existsSync(resolvedPath)) {
    throw new Error(`源文件不存在: ${resolvedPath}`);
  }

  const stat = fs.statSync(resolvedPath);
  if (stat.size > (options.maxFileSize ?? DEFAULT_MAX_FILE_SIZE)) {
    // 大文件流式解析 — 实现阶段补充
  }

  const outputDir = path.resolve(options.outputDir ?? DEFAULT_OUTPUT);
  fs.mkdirSync(outputDir, { recursive: true });

  const archive = await unpack(resolvedPath);
  const relIndex = await buildRelationIndex(archive);

  /** @type {Record<string, object>} */
  const parsed = {};
  for (const [entryPath, content] of archive.files) {
    if (content === '__binary__') continue;
    if (entryPath.endsWith('.xml') || entryPath.endsWith('.rels')) {
      parsed[entryPath] = await parseXml(content);
    }
  }

  const ctx = { relIndex, parsed, sourcePath: resolvedPath };
  const entities = extractEntities(parsed, ctx);
  const ir = mapToIR(entities, ctx);
  const script = generateScript(ir, options);

  const scriptPath = path.join(outputDir, 'output.js');
  fs.writeFileSync(scriptPath, script, 'utf8');

  await packageMedia({ archive, ir }, outputDir, {
    noMedia: options.noMedia,
  });

  const log = buildConversionLog(resolvedPath, stat, entities, ir);
  writeConversionLog(outputDir, log);
  writeOutputReadme(outputDir, {
    sourcePath: resolvedPath,
    generatedAt: new Date().toISOString(),
  });

  if (options.strictDegrade && log.statistics.degraded > 0) {
    const err = new Error('存在退化项（--strict-degrade）');
    err.code = 'STRICT_DEGRADE';
    throw err;
  }
  if (options.strictSkip) {
    const errors = (log.omitted || []).filter((o) => o.severity === 'error');
    if (errors.length > 0) {
      const err = new Error('存在 error 级别跳过项（--strict-skip）');
      err.code = 'STRICT_SKIP';
      throw err;
    }
  }

  return {
    outputDir,
    scriptPath,
    logPath: path.join(outputDir, 'conversion.log'),
    log,
  };
}

/**
 * @param {string} sourcePath
 * @param {fs.Stats} stat
 * @param {import('./extractor').SlideEntity[][]} entities
 * @param {import('./mapper').IntermediateRepresentation} ir
 */
function buildConversionLog(sourcePath, stat, entities, ir) {
  let full = 0;
  let degraded = 0;
  let skipped = 0;
  for (const slide of entities) {
    for (const e of slide) {
      if (e.decision === 'FULL') full++;
      else if (e.decision === 'DEGRADE') degraded++;
      else skipped++;
    }
  }

  return {
    source: {
      path: sourcePath,
      size: stat.size,
      slideCount: ir.slides.length,
    },
    statistics: {
      slides: ir.slides.length,
      full,
      degraded,
      skipped,
    },
    slides: [],
    degraded: [],
    omitted: [],
    warnings: [
      {
        message: '转换流水线尚未完整实现，当前输出为占位脚本',
        severity: 'warn',
      },
    ],
  };
}

module.exports = { convert, DEFAULT_OUTPUT, DEFAULT_MAX_FILE_SIZE };
