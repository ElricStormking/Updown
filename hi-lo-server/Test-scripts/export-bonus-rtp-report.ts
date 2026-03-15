import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { GameConfigService } from '../src/config/game-config.service';
import {
  bonusRtpSimulationDefaults,
  simulateAllBonusSlotRtpValidations,
  type BonusRtpValidationSummary,
  type BonusSlotRtpValidationResult,
} from '../src/game/digit-bonus-rtp-simulator';

type ReportFormat = 'json' | 'csv' | 'both';

type ReportOptions = {
  sampleCount: number;
  seed: number;
  format: ReportFormat;
  outputDir: string;
  prefix: string;
};

const DEFAULT_OUTPUT_DIR = path.resolve(
  process.cwd(),
  'Test-scripts',
  'logs',
  'bonus-rtp-report',
);
const DEFAULT_PREFIX = 'bonus-rtp-report';

const parseInteger = (value: string, label: string, min = 0) => {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < min) {
    throw new Error(`${label} must be an integer >= ${min}`);
  }
  return parsed;
};

const parseFormat = (value: string): ReportFormat => {
  if (value === 'json' || value === 'csv' || value === 'both') {
    return value;
  }
  throw new Error("format must be one of 'json', 'csv', or 'both'");
};

const parseArgs = (args: string[]): ReportOptions => {
  const options: ReportOptions = {
    sampleCount: bonusRtpSimulationDefaults.sampleCount,
    seed: bonusRtpSimulationDefaults.seed,
    format: 'both',
    outputDir: DEFAULT_OUTPUT_DIR,
    prefix: DEFAULT_PREFIX,
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === '--sample-count') {
      const value = args[index + 1];
      if (!value) throw new Error('Missing value for --sample-count');
      options.sampleCount = parseInteger(value, 'sample-count', 1);
      index += 1;
      continue;
    }
    if (arg.startsWith('--sample-count=')) {
      options.sampleCount = parseInteger(
        arg.slice('--sample-count='.length),
        'sample-count',
        1,
      );
      continue;
    }
    if (arg === '--seed') {
      const value = args[index + 1];
      if (!value) throw new Error('Missing value for --seed');
      options.seed = parseInteger(value, 'seed', 0);
      index += 1;
      continue;
    }
    if (arg.startsWith('--seed=')) {
      options.seed = parseInteger(arg.slice('--seed='.length), 'seed', 0);
      continue;
    }
    if (arg === '--format') {
      const value = args[index + 1];
      if (!value) throw new Error('Missing value for --format');
      options.format = parseFormat(value);
      index += 1;
      continue;
    }
    if (arg.startsWith('--format=')) {
      options.format = parseFormat(arg.slice('--format='.length));
      continue;
    }
    if (arg === '--output-dir') {
      const value = args[index + 1];
      if (!value) throw new Error('Missing value for --output-dir');
      options.outputDir = path.resolve(process.cwd(), value);
      index += 1;
      continue;
    }
    if (arg.startsWith('--output-dir=')) {
      options.outputDir = path.resolve(
        process.cwd(),
        arg.slice('--output-dir='.length),
      );
      continue;
    }
    if (arg === '--prefix') {
      const value = args[index + 1];
      if (!value) throw new Error('Missing value for --prefix');
      options.prefix = value.trim() || DEFAULT_PREFIX;
      index += 1;
      continue;
    }
    if (arg.startsWith('--prefix=')) {
      options.prefix = arg.slice('--prefix='.length).trim() || DEFAULT_PREFIX;
      continue;
    }
    throw new Error(`Unknown argument: ${arg}`);
  }

  return options;
};

const csvEscape = (value: unknown) => {
  const text = value === null || value === undefined ? '' : String(value);
  if (/[",\r\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
};

const toCsv = (headers: string[], rows: Array<Record<string, unknown>>) => {
  const lines = [headers.join(',')];
  for (const row of rows) {
    lines.push(headers.map((header) => csvEscape(row[header])).join(','));
  }
  return `${lines.join('\n')}\n`;
};

const buildSlotRows = (results: BonusSlotRtpValidationResult[]) =>
  results.map((result) => ({
    slotKey: result.slotKey,
    label: result.label,
    digitType: result.digitType,
    selection: result.selection ?? '',
    sampleCount: result.sampleCount,
    seed: result.seed,
    runtimeRollTotal: result.runtimeRollTotal,
    configuredBaseWeight: result.configuredBaseWeight,
    displayTotalCounts: result.displayTotalCounts,
    rtpTotalRoll: result.rtpTotalRoll,
    bonusWeightSum: result.bonusWeightSum,
    baseRatioPrimary: result.baseRatios.primary,
    baseRatioSecondary: result.baseRatios.secondary,
    baseRatioTertiary: result.baseRatios.tertiary,
    expectedBonusHitPct: result.expectedBonusHitPct,
    observedBonusHitPct: result.observedBonusHitPct,
    bonusHitSigmaPct: result.bonusHitSigmaPct,
    bonusHitAllowedDeltaPct: result.bonusHitAllowedDeltaPct,
    bonusHitZScore: result.bonusHitZScore,
    expectedRtpPct: result.expectedRtpPct,
    expectedRuntimeRtpPct: result.expectedRuntimeRtpPct,
    observedRtpPct: result.observedRtpPct,
    rtpStdError: result.rtpStdError,
    rtpAllowedDelta: result.rtpAllowedDelta,
    rtpZScore: result.rtpZScore,
    rtpFoolProofPct: result.rtpFoolProofPct ?? '',
    expectedExceedsRtpFoolProof: result.expectedExceedsRtpFoolProof,
    observedExceedsRtpFoolProof: result.observedExceedsRtpFoolProof,
    pass: result.pass,
    failureReasons: result.failureReasons.join(' | '),
  }));

const buildBucketRows = (results: BonusSlotRtpValidationResult[]) =>
  results.flatMap((result) =>
    result.bucketResults.map((bucket): Record<string, unknown> => ({
      slotKey: result.slotKey,
      label: result.label,
      digitType: result.digitType,
      selection: result.selection ?? '',
      bucketKey: bucket.bucketKey,
      ratio: bucket.ratio ?? '',
      expectedProbability: bucket.expectedProbability,
      expectedCount: bucket.expectedCount,
      observedCount: bucket.observedCount,
      sigma: bucket.sigma,
      allowedDelta: bucket.allowedDelta,
      zScore: bucket.zScore,
      pass: bucket.pass,
    })),
  );

const createJsonReport = (
  summary: BonusRtpValidationSummary,
  configVersion: string | undefined,
) => ({
  generatedAt: new Date().toISOString(),
  configVersion: configVersion ?? 'default',
  sampleCount: summary.sampleCount,
  seed: summary.seed,
  pass: summary.pass,
  totalSlots: summary.results.length,
  failedSlots: summary.results.filter((result) => !result.pass).length,
  results: summary.results,
});

const writeJsonReport = async (
  outputPath: string,
  summary: BonusRtpValidationSummary,
  configVersion: string | undefined,
) => {
  const payload = createJsonReport(summary, configVersion);
  await writeFile(outputPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
};

const writeCsvReports = async (
  slotsPath: string,
  bucketsPath: string,
  summary: BonusRtpValidationSummary,
) => {
  const slotRows = buildSlotRows(summary.results);
  const bucketRows = buildBucketRows(summary.results);

  await writeFile(
    slotsPath,
    toCsv(
      [
        'slotKey',
        'label',
        'digitType',
        'selection',
        'sampleCount',
        'seed',
        'runtimeRollTotal',
        'configuredBaseWeight',
        'displayTotalCounts',
        'rtpTotalRoll',
        'bonusWeightSum',
        'baseRatioPrimary',
        'baseRatioSecondary',
        'baseRatioTertiary',
        'expectedBonusHitPct',
        'observedBonusHitPct',
        'bonusHitSigmaPct',
        'bonusHitAllowedDeltaPct',
        'bonusHitZScore',
        'expectedRtpPct',
        'expectedRuntimeRtpPct',
        'observedRtpPct',
        'rtpStdError',
        'rtpAllowedDelta',
        'rtpZScore',
        'rtpFoolProofPct',
        'expectedExceedsRtpFoolProof',
        'observedExceedsRtpFoolProof',
        'pass',
        'failureReasons',
      ],
      slotRows,
    ),
    'utf8',
  );

  await writeFile(
    bucketsPath,
    toCsv(
      [
        'slotKey',
        'label',
        'digitType',
        'selection',
        'bucketKey',
        'ratio',
        'expectedProbability',
        'expectedCount',
        'observedCount',
        'sigma',
        'allowedDelta',
        'zScore',
        'pass',
      ],
      bucketRows,
    ),
    'utf8',
  );
};

const loadDefaultConfig = async () => {
  const prisma = {
    gameConfig: {
      findFirst: async () => null,
      findUnique: async () => null,
    },
  } as unknown as ConstructorParameters<typeof GameConfigService>[0];

  const service = new GameConfigService(prisma);
  return service.getActiveConfig();
};

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const config = await loadDefaultConfig();
  const summary = simulateAllBonusSlotRtpValidations(
    config,
    options.sampleCount,
    options.seed,
  );

  await mkdir(options.outputDir, { recursive: true });

  const jsonPath = path.join(options.outputDir, `${options.prefix}.json`);
  const slotsCsvPath = path.join(
    options.outputDir,
    `${options.prefix}.slots.csv`,
  );
  const bucketsCsvPath = path.join(
    options.outputDir,
    `${options.prefix}.buckets.csv`,
  );

  if (options.format === 'json' || options.format === 'both') {
    await writeJsonReport(jsonPath, summary, config.configVersion);
  }

  if (options.format === 'csv' || options.format === 'both') {
    await writeCsvReports(slotsCsvPath, bucketsCsvPath, summary);
  }

  const failedSlots = summary.results.filter((result) => !result.pass).length;
  console.log('Bonus RTP report generated.');
  console.log(`configVersion: ${config.configVersion ?? 'default'}`);
  console.log(`sampleCount: ${summary.sampleCount}`);
  console.log(`seed: ${summary.seed}`);
  console.log(`slotCount: ${summary.results.length}`);
  console.log(`validationPass: ${summary.pass}`);
  console.log(`failedSlots: ${failedSlots}`);

  if (options.format === 'json' || options.format === 'both') {
    console.log(`json: ${jsonPath}`);
  }
  if (options.format === 'csv' || options.format === 'both') {
    console.log(`slotsCsv: ${slotsCsvPath}`);
    console.log(`bucketsCsv: ${bucketsCsvPath}`);
  }

  if (!summary.pass) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error('Bonus RTP report export failed:', error);
  process.exitCode = 1;
});
