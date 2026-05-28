import type { EvalCliOptions, EvalMode } from './types';

export function parseEvalCliOptions(argv = process.argv.slice(2)): EvalCliOptions {
  const options: EvalCliOptions = {
    mode: 'fixture',
    writeReport: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--write-report') {
      options.writeReport = true;
      continue;
    }
    if (arg === '--mode') {
      options.mode = parseMode(argv[index + 1]);
      index += 1;
      continue;
    }
    if (arg.startsWith('--mode=')) {
      options.mode = parseMode(arg.slice('--mode='.length));
      continue;
    }
    if (arg === '--baseline') {
      options.baseline = argv[index + 1];
      index += 1;
      continue;
    }
    if (arg.startsWith('--baseline=')) {
      options.baseline = arg.slice('--baseline='.length);
      continue;
    }
    if (arg === '--report') {
      options.report = argv[index + 1];
      index += 1;
      continue;
    }
    if (arg.startsWith('--report=')) {
      options.report = arg.slice('--report='.length);
    }
  }

  return options;
}

function parseMode(value: string | undefined): EvalMode {
  if (value === 'fixture' || value === 'real' || value === 'compare') {
    return value;
  }

  throw new Error(`Unsupported eval mode: ${value ?? '<missing>'}`);
}
