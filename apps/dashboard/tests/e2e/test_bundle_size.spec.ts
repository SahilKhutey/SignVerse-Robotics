import { test, expect } from '@playwright/test';
import { fileURLToPath } from 'url';
import fs from 'fs';
import path from 'path';
import zlib from 'zlib';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const distAssetsPath = path.resolve(__dirname, '../../dist/assets');

function getGzippedSize(filePath: string): number {
  const fileBuffer = fs.readFileSync(filePath);
  const gzipped = zlib.gzipSync(fileBuffer);
  return gzipped.length;
}

test.describe('Vite Bundle Size Budgets', () => {
  // Test 6: Vite production build. Total JS bundle (gzipped) must be < 2048 KB.
  test('dashboard_bundle_under_2mb_gzipped', async () => {
    expect(fs.existsSync(distAssetsPath)).toBe(true);

    const files = fs.readdirSync(distAssetsPath);
    let totalJSGzippedBytes = 0;

    for (const file of files) {
      if (file.endsWith('.js')) {
        const fullPath = path.join(distAssetsPath, file);
        totalJSGzippedBytes += getGzippedSize(fullPath);
      }
    }

    const bundleSizeKB = totalJSGzippedBytes / 1024;
    console.log(`Total gzipped JS bundle size: ${bundleSizeKB.toFixed(2)} KB`);

    expect(bundleSizeKB).toBeLessThan(2048);
  });

  // Test 7: Three.js + R3F chunk isolated via Rollup. Gzipped < 600 KB.
  test('three_js_chunk_under_600kb', async () => {
    expect(fs.existsSync(distAssetsPath)).toBe(true);

    const files = fs.readdirSync(distAssetsPath);
    let threejsChunkSizeKB = 0;
    let foundChunk = false;

    for (const file of files) {
      if (file.endsWith('.js')) {
        const fullPath = path.join(distAssetsPath, file);
        const content = fs.readFileSync(fullPath, 'utf8');
        
        // Scan for three.js signatures
        if (content.includes('WebGLRenderer') || content.includes('THREE') || file.includes('three') || file.includes('fiber') || file.includes('drei')) {
          const gzippedSize = getGzippedSize(fullPath);
          const sizeKB = gzippedSize / 1024;
          
          if (sizeKB > threejsChunkSizeKB) {
            threejsChunkSizeKB = sizeKB;
            foundChunk = true;
          }
        }
      }
    }

    console.log(`Three.js/R3F chunk size (gzipped): ${threejsChunkSizeKB.toFixed(2)} KB`);
    expect(foundChunk).toBe(true);
    expect(threejsChunkSizeKB).toBeLessThan(600);
  });
});
