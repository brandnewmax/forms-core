import * as esbuild from 'esbuild';
import { cp, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const distDir = path.join(__dirname, 'dist');

await mkdir(distDir, { recursive: true });

await esbuild.build({
  entryPoints: [path.join(__dirname, 'src/embed.ts')],
  bundle: true,
  outfile: path.join(distDir, 'embed.js'),
  format: 'iife',
  target: ['es2020', 'chrome90', 'firefox90', 'safari14', 'edge90'],
  minify: true,
  sourcemap: true,
  define: { 'process.env.NODE_ENV': '"production"' },
  loader: { '.css': 'text' },
});

await cp(
  path.join(__dirname, 'src/styles'),
  distDir,
  { recursive: true },
);

console.log('✅ Built dist/embed.js + 3 css files');
