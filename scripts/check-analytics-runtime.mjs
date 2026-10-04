import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

// Compile the real server entry points and load them in native Node, as Vercel does.
// Vite/Vitest can resolve imports that fail in this runtime.
const output = mkdtempSync(join(tmpdir(), 'food-fit-api-runtime-'));
try {
  const compile = spawnSync(process.execPath, [resolve('node_modules/typescript/bin/tsc'),
    'api/analytics/runs.ts', 'api/analytics/feedback.ts', '--outDir', output,
    '--module', 'ESNext', '--moduleResolution', 'bundler', '--target', 'ES2022',
    '--resolveJsonModule', '--esModuleInterop', '--skipLibCheck', '--jsx', 'react-jsx'], { encoding: 'utf8' });
  if (compile.status !== 0) throw new Error(compile.stdout + compile.stderr);
  writeFileSync(join(output, 'package.json'), '{"type":"module"}');
  const entry = pathToFileURL(join(output, 'api/analytics/runs.js')).href;
  const feedback = pathToFileURL(join(output, 'api/analytics/feedback.js')).href;
  const smoke = spawnSync(process.execPath, ['--input-type=module', '-e', `
    const runs = await import(${JSON.stringify(entry)});
    const feedback = await import(${JSON.stringify(feedback)});
    const response = await runs.default.fetch(new Request('https://example.test/api/analytics/runs'));
    const body = await response.json();
    if (response.status !== 503 || body.runSchemaVersion !== 2 || body.exerciseEnergyVersion !== 3)
      throw new Error('Unconfigured API capability response failed');
    const method = await feedback.default.fetch(new Request('https://example.test/api/analytics/feedback'));
    if (method.status !== 405) throw new Error('Feedback method check failed');
    console.log('Native Node analytics runtime passed: both entries loaded, schema 2, exercise 3');
  `], { encoding: 'utf8', env: { ...process.env, ANALYTICS_ENABLED: 'false' } });
  process.stdout.write(smoke.stdout);
  process.stderr.write(smoke.stderr);
  if (smoke.status !== 0) process.exitCode = 1;
} finally { rmSync(output, { recursive: true, force: true }); }
