#!/usr/bin/env node
import { cp, rm, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '../../..');
const embedDist = path.join(repoRoot, 'packages/embed/dist');
const publicDir = path.join(__dirname, '..', 'public');

await rm(publicDir, { recursive: true, force: true });
await mkdir(publicDir, { recursive: true });
await cp(embedDist, publicDir, { recursive: true });

console.log(`✅ Synced ${embedDist} → ${publicDir}`);
