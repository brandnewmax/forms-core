#!/usr/bin/env node
import { cp, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '../../..');
const embedDist = path.join(repoRoot, 'packages/embed/dist');
const publicDir = path.join(__dirname, '..', 'public');

// Merge, don't destroy — public/admin/ contains committed admin HTML/CSS that
// must survive. cp with force:true overwrites embed.js + CSS but leaves
// non-embed assets intact.
await mkdir(publicDir, { recursive: true });
await cp(embedDist, publicDir, { recursive: true, force: true });

console.log(`✅ Merged ${embedDist} → ${publicDir} (admin assets preserved)`);
