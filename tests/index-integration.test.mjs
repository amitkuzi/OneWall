// index.html ↔ Gridfinity integration checks.
// Extracts the inline ES-module script, verifies it PARSES as valid
// JavaScript (node --check), and statically verifies the wiring:
// import, mode switch, GUI folder, session round-trip, STL naming.
// Run: node tests/index-integration.test.mjs
import { readFileSync, writeFileSync, mkdtempSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { execFileSync } from 'child_process';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
let pass = 0, fail = 0;
const ok = (cond, msg) => {
  if (cond) { pass++; console.log('  ✓', msg); }
  else { fail++; console.error('  ✗', msg); }
};

// 1. extract the main module script and syntax-check it
const mods = [...html.matchAll(/<script type="module">([\s\S]*?)<\/script>/g)];
ok(mods.length === 1, 'exactly one inline module script');
const js = mods[0][1];
const tmp = join(mkdtempSync(join(tmpdir(), 'ow-')), 'main.mjs');
writeFileSync(tmp, js);
let syntaxOK = true, syntaxErr = '';
try { execFileSync(process.execPath, ['--check', tmp], { stdio: 'pipe' }); }
catch (e) { syntaxOK = false; syntaxErr = String(e.stderr || e.message); }
ok(syntaxOK, 'inline module script parses as valid JS' +
   (syntaxErr ? ` — ${syntaxErr.split('\n')[0]}` : ''));

// 2. wiring
ok(/from '\.\/assets\/gridfinity\.js'/.test(js), 'imports ./assets/gridfinity.js');
ok(/const MODE = \{ mode: 'onewall' \}/.test(js), 'MODE state defaults to onewall');
ok(/gui\.add\(MODE, 'mode', \['onewall', 'gridfinity'\]\)/.test(js), 'mode dropdown in GUI');
ok(/function applyMode\(\)/.test(js), 'applyMode() defined');
ok(/fGf\.hide\(\)/.test(js), 'gridfinity folder hidden on load');
ok(/buildGridfinityGeometry/.test(js) &&
   /MODE\.mode === 'gridfinity'\s*\?\s*buildGridfinityGeometry\(\)/.test(js),
   'rebuild() branches on mode');

// 3. GUI offers the required multipliers
ok(/'units_x', 0\.5, 8, 0\.5/.test(js) && /'units_y', 0\.5, 8, 0\.5/.test(js),
   'bin size sliders span 0.5–8 units in 0.5 steps');
ok(/LEG_OPTS = \[0\.5, 1, 2\]/.test(js) && /'leg_mult', LEG_OPTS/.test(js),
   'leg size options are 0.5 / 1 / 2');
ok(/const legOK =/.test(js) && /const snapLegs =/.test(js),
   'invalid bin/leg combos are blocked (snap to valid)');
ok(/'cell_mult', UNIT_OPTS/.test(js), 'plate cell size uses multipliers');
ok(/'cells_x', 0\.5, 8, 0\.05/.test(js) && /'cells_y', 0\.5, 8, 0\.05/.test(js),
   'plate cell counts accept fractions (half cells and finer)');
ok(/'height_units', 1, 12, 0\.5/.test(js), 'height in 0.5 steps of 7 mm units');
ok(/'ribs', 0, 48, 1/.test(js), 'spiral rib control present');

// 4. session round-trip includes gridfinity state
ok(/mode:\s*MODE\.mode/.test(js) && /gridfinity: \{ \.\.\.GP \}/.test(js),
   'session snapshot stores mode + GP');
ok(/data\.gridfinity/.test(js) && /data\.mode === 'onewall'/.test(js),
   'session restore reads mode + GP back');

// 5. STL export awareness
ok(/gridfinity_bin_\$\{GP\.units_x\}/.test(js), 'bin STL filename encodes size');
ok(/gridfinity_plate_/.test(js), 'plate STL filename branch present');
ok(/MODE\.mode === 'gridfinity'\)\s*\?\s*null : makeSigCarveGeometry\(\)/.test(js),
   'signature carve skipped for all gridfinity parts');

// 5b. STEP export shares the carve + naming with STL
ok(/from '\.\/assets\/step-exporter\.js'/.test(js), 'imports ./assets/step-exporter.js');
ok(/function exportBaseName\(\)/.test(js), 'filename stem factored out for both writers');
ok(/async function prepareExportRoot\(/.test(js), 'carve factored out for both writers');
ok((js.match(/prepareExportRoot\(/g) || []).length === 3,
   'STL and STEP both go through prepareExportRoot()');
ok((js.match(/(?<!function )makeSigCarveGeometry\(\)/g) || []).length === 1,
   'signature carve has exactly one call site');
ok(/exportBaseName\(\) \+ '\.stl'/.test(js) && /name \+ '\.step'/.test(js),
   'both exports derive their filename from the shared stem');
ok(/\.name\('Download STEP \(faceted\)'\)/.test(js),
   'GUI button says "faceted" so nobody expects smooth NURBS');
ok(/owTrack\('step_export'/.test(js) || /trackExport\('step_export'/.test(js),
   'STEP export is tracked separately from STL');
ok(/finally \{\s*disposeExportRoot\(prep\);/.test(js),
   'STEP export disposes carved geometry even when the write throws');

// 6. normal/lite style, lip, dividers
ok(/'style',\s*\['normal',\s*'lite'\]/.test(js), 'style dropdown offers normal/lite');
ok(/style:\s*'normal'/.test(js), 'style defaults to normal');
ok(/add\(GP,\s*'lip'\)/.test(js), 'stacking lip toggle present');
ok(/add\(GP,\s*'div_x',\s*0,\s*8,\s*1\)/.test(js) &&
   /add\(GP,\s*'div_y',\s*0,\s*8,\s*1\)/.test(js), 'divider sliders present');
ok(/add\(GP,\s*'wall_t'/.test(js), 'wall thickness control present');
ok(/_lite/.test(js), 'STL filename marks lite style');

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
