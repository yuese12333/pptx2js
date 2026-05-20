/**
 * 转换流水线编排器
 */
const fs = require('fs');
const path = require('path');
const { parseXml } = require('./xml-parser');
const { unpack } = require('./unpacker');
const { buildRelationIndex } = require('./rels');
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
  const maxSize = options.maxFileSize ?? DEFAULT_MAX_FILE_SIZE;
  if (stat.size > maxSize) {
    throw new Error(
      `源文件超过大小限制 (${stat.size} > ${maxSize} 字节)。请拆分 PPT 或使用 --max-file-size 提高上限。`
    );
  }

  const outputDir = path.resolve(options.outputDir ?? DEFAULT_OUTPUT);
  fs.mkdirSync(outputDir, { recursive: true });

  const archive = await unpack(resolvedPath);

  /** @type {Record<string, object>} */
  const parsed = {};
  for (const [entryPath, content] of archive.files) {
    if (content === '__binary__') continue;
    if (/\.(xml|rels)$/i.test(entryPath)) {
      parsed[entryPath] = parseXml(content);
    }
  }

  const relIndex = buildRelationIndex(parsed);
  const ctx = { relIndex, parsed, sourcePath: resolvedPath };
  const entities = extractEntities(ctx);
  const ir = mapToIR(entities, ctx);

  await packageMedia({ archive, ir }, outputDir, {
    noMedia: options.noMedia,
  });

  const script = generateScript(ir, options);
  const scriptPath = path.join(outputDir, 'output.js');
  fs.writeFileSync(scriptPath, script, 'utf8');

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
 * @param {import('./extractor').SlideEntity[][]} entitiesBySlide
 * @param {import('./mapper').IntermediateRepresentation} ir
 */
function buildConversionLog(sourcePath, stat, entitiesBySlide, ir) {
  let full = 0;
  let degraded = 0;
  let skipped = 0;

  /** @type {object[]} */
  const slides = [];
  /** @type {object[]} */
  const degradedList = [];
  /** @type {object[]} */
  const omitted = [];
  /** @type {object[]} */
  const warnings = [];

  entitiesBySlide.forEach((entities, slideIndex) => {
    /** @type {object[]} */
    const slideItems = [];

    for (const entity of entities) {
      const bounds = entity.bounds;
      const base = {
        slideIndex,
        elementBounds: bounds,
        kind: entity.kind,
        decision: entity.decision,
      };

      if (entity.decision === 'FULL') full++;
      else if (entity.decision === 'DEGRADE') degraded++;
      else skipped++;

      slideItems.push(base);

      if (entity.decision === 'DEGRADE' && entity.degradeReason) {
        degradedList.push({
          ...base,
          reason: entity.degradeReason,
          severity: 'warn',
        });
      }

      if (entity.decision === 'SKIP') {
        omitted.push({
          ...base,
          type: entity.kind,
          reason: entity.skipReason,
          severity: entity.skipReason?.includes('尚未支持') ? 'warn' : 'error',
        });
      }
    }

    slides.push({ slideIndex, items: slideItems });
  });

  if (ir.slides.length === 0) {
    warnings.push({
      message: '未解析到任何幻灯片，请检查 presentation.xml 与关系文件',
      severity: 'warn',
    });
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
    slides,
    degraded: degradedList,
    omitted,
    warnings,
  };
}

module.exports = { convert, DEFAULT_OUTPUT, DEFAULT_MAX_FILE_SIZE };
