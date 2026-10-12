import fs from 'node:fs/promises';
import path from 'node:path';
const root = path.resolve(import.meta.dirname, '..');
let html = await fs.readFile(path.join(root, 'dist/index.html'), 'utf8');
const script = html.match(/<script\b[^>]*src="([^"]+)"[^>]*><\/script>/);
const stylesheet = html.match(/<link\b[^>]*href="([^"]+\.css)"[^>]*>/);
if (!script || !stylesheet) throw new Error('Expected one Vite entry script and stylesheet.');
const code = await fs.readFile(path.resolve(root, 'dist', script[1]), 'utf8');
const css = await fs.readFile(path.resolve(root, 'dist', stylesheet[1]), 'utf8');
for (const selector of ['.br-root', '.br-panel', '.br-toolbar', '.br-row', '.br-footer']) {
  if (!css.includes(`${selector}{`) && !css.includes(`${selector} {`)) {
    throw new Error(`Demo stylesheet is missing component styles: ${selector}`);
  }
}
html = html.replace(script[0], () => `<script type="module">${code.replace(/<\/script/gi, '<\\/script')}</script>`);
html = html.replace(stylesheet[0], () => `<style>${css}</style>`);
await fs.writeFile(path.join(root, 'demo.html'), html);
console.log('Standalone demo generated: demo.html');
