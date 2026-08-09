const fs = require('fs');
const path = require('path');

const distDir = path.join(__dirname, '..', 'dist');
const expoDir = path.join(distDir, '_expo');
const assetsDir = path.join(distDir, 'assets');

if (!fs.existsSync(distDir)) {
  console.error('dist/ directory not found. Run expo export first.');
  process.exit(1);
}

if (fs.existsSync(expoDir)) {
  fs.renameSync(expoDir, assetsDir);
  console.log('Renamed _expo -> assets');
}

const indexPath = path.join(distDir, 'index.html');
if (fs.existsSync(indexPath)) {
  let html = fs.readFileSync(indexPath, 'utf-8');
  html = html.replace(/(href|src)="\/([^"]*)"/g, '$1="./$2"');
  html = html.replace(/_expo\//g, 'assets/');
  fs.writeFileSync(indexPath, html, 'utf-8');
  console.log('index.html paths fixed.');
}

function replaceInFiles(dir) {
  if (!fs.existsSync(dir)) return;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      replaceInFiles(fullPath);
    } else if (entry.name.endsWith('.js')) {
      let content = fs.readFileSync(fullPath, 'utf-8');
      if (content.includes('_expo')) {
        content = content.replace(/_expo\//g, 'assets/');
        content = content.replace(/"_expo"/g, '"assets"');
        fs.writeFileSync(fullPath, content, 'utf-8');
        console.log(`Fixed references in ${path.relative(distDir, fullPath)}`);
      }
    }
  }
}

replaceInFiles(assetsDir);

const nojekyllPath = path.join(distDir, '.nojekyll');
fs.writeFileSync(nojekyllPath, '');
console.log('Created .nojekyll (disables Jekyll on GitHub Pages)');

const metaPath = path.join(distDir, 'metadata.json');
if (fs.existsSync(metaPath)) {
  let meta = fs.readFileSync(metaPath, 'utf-8');
  meta = meta.replace(/_expo\//g, 'assets/');
  fs.writeFileSync(metaPath, meta, 'utf-8');
  console.log('metadata.json paths fixed.');
}

console.log('GitHub Pages compatibility fix applied.');
