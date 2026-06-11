const fs = require('fs');
const path = require('path');

function walk(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach(function(file) {
    file = dir + '/' + file;
    const stat = fs.statSync(file);
    if (stat && stat.isDirectory()) { 
      results = results.concat(walk(file));
    } else { 
      if (file.endsWith('.tsx')) results.push(file);
    }
  });
  return results;
}

const files = walk('src');
for (const file of files) {
  let content = fs.readFileSync(file, 'utf8');
  let changed = false;

  const liquidGlassClass = 'bg-white/[0.02] border border-white/10 shadow-[inset_0_1px_0_rgba(255,255,255,0.1)] backdrop-blur-xl transition-all duration-300 hover:bg-white/[0.04]';
  
  // Update standard panel wrappers
  const liquidPattern = /className="([^"]+)"\s*style=\{\{\s*background:\s*['"]#161B22['"],\s*border:\s*['"]1px solid #21262D['"]\s*\}\}/g;
  if (liquidPattern.test(content)) {
    content = content.replace(liquidPattern, (match, classes) => {
       let newClasses = classes.replace('rounded-xl', 'rounded-[2rem]');
       return `className="${newClasses} ${liquidGlassClass}"`;
    });
    changed = true;
  }

  // Update page wrappers
  const bgBasePattern = /className="([^"]+)"\s*style=\{\{\s*background:\s*['"]var\(--bg-base\)['"]\s*\}\}/g;
  if (bgBasePattern.test(content)) {
    content = content.replace(bgBasePattern, (match, classes) => {
       let newClasses = classes.replace('gap-6', 'gap-8').replace('p-7', 'p-8');
       return `className="${newClasses} bg-[#090909]"`;
    });
    changed = true;
  }

  // Update simple `#161B22` backgrounds (like skeletons)
  const simpleDarkBg = /style=\{\{\s*background:\s*['"]#161B22['"]\s*\}\}/g;
  if (simpleDarkBg.test(content)) {
    content = content.replace(simpleDarkBg, `className="bg-white/5 border border-white/5 backdrop-blur-md"`);
    changed = true;
  }

  // Text color replacements
  if (content.includes('var(--text-primary)')) {
    content = content.replace(/style=\{\{\s*color:\s*['"]var\(--text-primary\)['"]\s*\}\}/g, 'className="text-white"');
    changed = true;
  }
  if (content.includes('var(--text-secondary)')) {
    content = content.replace(/style=\{\{\s*color:\s*['"]var\(--text-secondary\)['"]\s*\}\}/g, 'className="text-white/60"');
    changed = true;
  }
  if (content.includes('var(--text-muted)')) {
    content = content.replace(/style=\{\{\s*color:\s*['"]var\(--text-muted\)['"],\s*letterSpacing:\s*['"]0.1em['"]\s*\}\}/g, 'className="text-white/50 tracking-[0.15em]"');
    changed = true;
  }

  // Header texts
  const headerTextPattern = /className="font-display font-bold text-\[28px\] leading-tight"\s*className="text-white"/g;
  if (headerTextPattern.test(content)) {
    content = content.replace(headerTextPattern, 'className="font-display font-medium text-4xl tracking-tight text-white"');
    changed = true;
  }

  const subheadPattern = /className="font-mono text-\[11px\] font-medium uppercase tracking-widest(?: mb-1)?"\s*className="text-white\/50 tracking-\[0.15em\]"/g;
  if (subheadPattern.test(content)) {
    content = content.replace(subheadPattern, 'className="font-mono text-[11px] font-medium uppercase tracking-[0.15em] text-white/50 mb-2"');
    changed = true;
  }

  // Sidebar specific
  const sidebarPattern = /className="([^"]+)"\s*style=\{\{\s*background:\s*['"]#161B22['"],\s*borderRight:\s*['"]1px solid #21262D['"]\s*\}\}/g;
  if (sidebarPattern.test(content)) {
    content = content.replace(sidebarPattern, `className="$1 bg-[#090909] border-r border-white/10"`);
    changed = true;
  }

  if (changed || content !== fs.readFileSync(file, 'utf8')) {
    fs.writeFileSync(file, content, 'utf8');
    console.log('Updated', file);
  }
}
