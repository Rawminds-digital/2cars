import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';

const minifyJs = (content) => content
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/(^|[^:])\/\/.*$/gm, '$1')
  .replace(/\n+/g, '\n')
  .replace(/\s{2,}/g, ' ')
  .trim();

const minifyCss = (content) => content
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/\s+/g, ' ')
  .replace(/\s*([{}:;,])\s*/g, '$1')
  .replace(/;}/g, '}')
  .trim();

mkdirSync('dist', { recursive: true });

const js = readFileSync('app.js', 'utf8');
writeFileSync('dist/app.js', minifyJs(js), 'utf8');

const css = readFileSync('styles.css', 'utf8');
writeFileSync('dist/styles.css', minifyCss(css), 'utf8');

['index.html', 'about.html', 'privacy.html', 'terms.html', 'contact.html'].forEach((file) => {
  copyFileSync(file, `dist/${file}`);
});
