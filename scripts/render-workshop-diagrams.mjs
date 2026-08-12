import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outDir = path.join(root, 'docs', 'diagrams', 'workshop');
const mmdc = 'npx';
const mmdcArgs = ['--yes', '@mermaid-js/mermaid-cli@11.4.0'];

/** @type {{ file: string; width?: number; height?: number }}[] */
const diagrams = [
  { file: 'workshop-a1-d1.mmd' },
  { file: 'workshop-a2-r2.mmd' },
  { file: 'workshop-a3-on-device.mmd', width: 2800 },
  { file: 'workshop-b-domain.mmd', width: 2200 },
  { file: 'workshop-c-services.mmd', width: 2600, height: 3200 },
  { file: 'workshop-d-ui.mmd', width: 2400 },
  { file: 'workshop-e-server.mmd', width: 2000 },
  { file: 'workshop-f-mapping.mmd', width: 2200 },
  { file: 'workshop-g-architecture.mmd', width: 2000 },
];

for (const { file, width, height } of diagrams) {
  const input = path.join(outDir, file);
  const output = input.replace(/\.mmd$/, '.png');
  const args = [
    ...mmdcArgs,
    '-i',
    input,
    '-o',
    output,
    '-b',
    'transparent',
  ];
  if (width) args.push('-w', String(width));
  if (height) args.push('-H', String(height));

  console.log(`Rendering ${file} → ${path.basename(output)}`);
  const result = spawnSync(mmdc, args, { cwd: root, stdio: 'inherit', shell: true });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

console.log('Done. PNGs in docs/diagrams/workshop/');
