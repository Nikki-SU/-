const fs = require('fs');
const path = require('path');

const indexPath = path.join(__dirname, '..', 'dist', 'index.html');

if (!fs.existsSync(indexPath)) {
  console.error('index.html not found in dist/');
  process.exit(1);
}

let html = fs.readFileSync(indexPath, 'utf-8');

html = html.replace(/(href|src)="\/([^"]*)"/g, '$1="./$2"');

fs.writeFileSync(indexPath, html, 'utf-8');

console.log('Paths fixed for GitHub Pages compatibility.');
