import { build as viteBuild } from 'vite';
import { build as bundle } from 'esbuild';
import { mkdir, realpath, rm, lstat } from 'node:fs/promises';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = await realpath(join(dirname(fileURLToPath(import.meta.url)), '..'));
const output = join(root, 'dist');
// Clean only this project's generated output, never a linked directory.
try {
  if ((await lstat(output)).isSymbolicLink() || relative(root, await realpath(output)) !== 'dist') throw new Error('Unsafe build output path');
  await rm(output, { recursive: true, force: true });
} catch (error) { if (error.code !== 'ENOENT') throw error; }
await mkdir(output, { recursive: true });
await viteBuild({ root });
await bundle({ absWorkingDir: root, entryPoints: ['server/sites/index.js'], outfile: 'dist/server/index.js', bundle: true, platform: 'browser', format: 'esm', target: 'es2022', loader: { '.html': 'text' }, minify: true, sourcemap: false });
console.log('Sites Worker and client built successfully.');
