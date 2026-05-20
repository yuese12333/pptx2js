#!/usr/bin/env node
/**
 * CLI 入口 — 对 lib/convert 的薄封装，不含独立业务逻辑。
 */
const path = require('path');
const chalk = require('chalk');
const { Command } = require('commander');
const { convert, DEFAULT_OUTPUT, DEFAULT_MAX_FILE_SIZE } = require('../lib');

const program = new Command();

program
  .name('pptx2js')
  .description('将 .pptx 文件转换为可运行的 PptxGenJS 生成脚本')
  .version(require('../package.json').version)
  .argument('<input>', '源 PPTX 文件路径')
  .option('-o, --output <dir>', '输出目录', DEFAULT_OUTPUT)
  .option('--no-media', '不提取媒体文件')
  .option('--strict-degrade', '任意退化项触发非零退出码')
  .option('--strict-skip', 'severity:error 级别的跳过项触发非零退出码')
  .option(
    '--log-level <level>',
    '日志详细程度：minimal / info / verbose',
    'info'
  )
  .option(
    '--max-file-size <bytes>',
    '超过此阈值时切换为逐幻灯片流式解析',
    String(DEFAULT_MAX_FILE_SIZE)
  )
  .action(async (input, opts) => {
    const logLevel = opts.logLevel;
    const verbose = logLevel === 'verbose';

    try {
      if (verbose) {
        console.log(chalk.gray(`输入: ${path.resolve(input)}`));
        console.log(chalk.gray(`输出: ${path.resolve(opts.output)}`));
      }

      const result = await convert(input, {
        outputDir: opts.output,
        // Commander: --no-media → opts.media（默认 true，加 --no-media 后为 false）
        noMedia: !opts.media,
        strictDegrade: opts.strictDegrade,
        strictSkip: opts.strictSkip,
        logLevel,
        maxFileSize: parseInt(opts.maxFileSize, 10),
      });

      console.log(chalk.green('转换完成'));
      console.log(chalk.gray(`  脚本: ${result.scriptPath}`));
      console.log(chalk.gray(`  日志: ${result.logPath}`));

      const { statistics, warnings } = result.log;
      if (logLevel !== 'minimal') {
        console.log(
          chalk.gray(
            `  统计: ${statistics.slides} 张幻灯片, ` +
              `精确 ${statistics.full}, 退化 ${statistics.degraded}, 跳过 ${statistics.skipped}`
          )
        );
      }
      if (warnings?.length && logLevel === 'verbose') {
        for (const w of warnings) {
          console.log(chalk.yellow(`  ⚠ ${w.message}`));
        }
      }
    } catch (err) {
      console.error(chalk.red(err.message || String(err)));
      process.exit(1);
    }
  });

program.parse();
