/**
 * ④ 映射引擎 — 实体 → 平台无关 IR
 */
const { getSlideSizeInches } = require('./presentation');

/**
 * @param {import('./extractor').SlideEntity[][]} entitiesBySlide
 * @param {{ parsed: Record<string, object> }} ctx
 */
function mapToIR(entitiesBySlide, ctx) {
  const layout = getSlideSizeInches(ctx.parsed);

  const slides = entitiesBySlide.map((entities, index) => {
    const elements = [];
    let background = null;

    for (const entity of entities) {
      if (entity.kind === 'background' && entity.shape) {
        background = { color: entity.shape.fill, decision: entity.decision };
        continue;
      }

      if (entity.kind === 'skip') {
        elements.push({
          type: 'skip',
          decision: entity.decision,
          skipReason: entity.skipReason,
          bounds: entity.bounds,
        });
        continue;
      }

      if (entity.kind === 'text' && entity.text) {
        elements.push({
          type: 'text',
          decision: entity.decision,
          bounds: entity.bounds,
          runs: entity.text.runs,
          degradeReason: entity.degradeReason,
        });
        continue;
      }

      if (entity.kind === 'image' && entity.image) {
        elements.push({
          type: 'image',
          decision: entity.decision,
          bounds: entity.bounds,
          mediaPath: `media/${entity.image.fileName}`,
          zipPath: entity.image.zipPath,
          degradeReason: entity.degradeReason,
        });
        continue;
      }

      if (entity.kind === 'table' && entity.table) {
        elements.push({
          type: 'table',
          decision: entity.decision,
          bounds: entity.bounds,
          rows: entity.table.rows,
          colWidths: entity.table.colWidths,
        });
        continue;
      }

      if (entity.kind === 'chart' && entity.chart) {
        elements.push({
          type: 'chart',
          decision: entity.decision,
          bounds: entity.bounds,
          chartType: entity.chart.type,
          data: entity.chart.data,
          title: entity.chart.title,
        });
        continue;
      }

      if (entity.kind === 'shape' && entity.shape) {
        elements.push({
          type: 'shape',
          decision: entity.decision,
          bounds: entity.bounds,
          shape: entity.shape.type,
          fill: entity.shape.fill,
          line: entity.shape.line,
          lineWidth: entity.shape.lineWidth,
          degradeReason: entity.degradeReason,
        });
      }
    }

    return { index, background, elements };
  });

  return { layout, slides };
}

module.exports = { mapToIR };
