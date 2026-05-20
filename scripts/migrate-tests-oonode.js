/**
 * One-off: sync parseXml + OONode test access (UTF-8 safe)
 */
const fs = require('fs');
const path = require('path');

const testDir = path.join(__dirname, '../test');

function patchFile(filePath) {
  let s = fs.readFileSync(filePath, 'utf8');
  const orig = s;

  s = s.replace(/\bawait parseXml\b/g, 'parseXml');
  s = s.replace(
    /\(parseXml\(frameXml\)\)\['p:graphicFrame'\]/g,
    "documentRoot(parseXml(frameXml), 'p:graphicFrame')"
  );
  s = s.replace(
    /const doc = parseXml\(frameXml\);\s*\n\s*const frame = doc\['p:graphicFrame'\];/g,
    "const { documentRoot } = require('../../lib/xml-utils');\n    const frame = documentRoot(parseXml(frameXml), 'p:graphicFrame');"
  );
  s = s.replace(
    /extractTextRuns\(doc\['a:txBody'\]/g,
    'extractTextRuns(parseXml(txBodyXml)'
  );
  s = s.replace(
    /const doc = parseXml\(txBodyXml\);\s*\n\s*const runs = extractTextRuns\(parseXml\(txBodyXml\)/g,
    'const runs = extractTextRuns(parseXml(txBodyXml)'
  );
  s = s.replace(
    /const doc = parseXml\(txBodyXml\);\s*\n\s*const txBody = doc\['a:txBody'\];/g,
    'const txBody = parseXml(txBodyXml);'
  );
  s = s.replace(
    /resolveFillColor\(\s*\{\s*'a:gradFill': doc\['a:gradFill'\]\s*\}/g,
    'resolveFillColor(doc'
  );
  s = s.replace(
    /resolveFillColor\(\{\s*'a:gradFill': grad\s*\}/g,
    'resolveFillColor(doc'
  );
  s = s.replace(
    /const grad = doc\['a:gradFill'\];\s*\n\s*const \{ color, degraded \} = resolveFillColor\(doc/g,
    'const doc = parseXml(xml);\n    const { color, degraded } = resolveFillColor(doc'
  );

  if (s.includes("documentRoot(parseXml(frameXml)") && !s.includes('documentRoot')) {
    const req = "const { documentRoot } = require('../../lib/xml-utils');\n";
    if (!s.includes("require('../../lib/xml-utils')")) {
      s = s.replace(/(const \{ parseXml \}[^\n]+\n)/, `$1${req}`);
    }
  }

  if (s !== orig) {
    fs.writeFileSync(filePath, s, 'utf8');
    console.log('patched', path.relative(testDir, filePath));
  }
}

function walk(dir) {
  for (const name of fs.readdirSync(dir)) {
    const p = path.join(dir, name);
    if (fs.statSync(p).isDirectory()) walk(p);
    else if (name.endsWith('.test.js')) patchFile(p);
  }
}

walk(testDir);
