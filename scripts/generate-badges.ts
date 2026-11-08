#!/usr/bin/env ts-node
// scripts/generate-badges.ts
// CLI script to regenerate deterministic SVG badges into public/badges

import * as path from 'path';
import { generateAllBadges } from '../src/lib/badges/badge-catalog';

const outputDir = path.resolve(process.cwd(), 'public/badges');
console.log(`Generating repository badges into ${outputDir}...`);
const generated = generateAllBadges(outputDir);
console.log(`Successfully generated ${Object.keys(generated).length} SVG badges.`);
