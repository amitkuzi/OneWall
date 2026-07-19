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
ok(/buildGridfinityParts/.test(js) &&
   /if \(MODE\.mode === 'gridfinity'\) \{[\s\S]*?buildGridfinityParts\(\)/.test(js),
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
ok((js.match(/prepareExportRoot\(/g) || []).length === 4,
   'STL, STEP and 3MF all go through prepareExportRoot()');
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

// 7. build-plate fitting — GUI, cache and preview wiring
ok(/planPlateTiles as gfPlanTiles/.test(js) && /BUILD_PLATES, PLATE_MARGIN/.test(js),
   'imports the build-plate planner and registry');
ok(/fit_plate: false/.test(js), 'plate splitting is off by default');
ok(/add\(GP, 'fit_plate'\)/.test(js), 'split toggle present in the GUI');
// Printer selection is general, not gridfinity-specific: it must hang
// off the root GUI, not inside the baseplate folder.
ok(/const fPrinter = gui\.addFolder\('Printer'\)/.test(js),
   'printer folder is a top-level GUI folder');
ok(/fPrinter\.add\(PRINTER, 'id', plateOptions\(\)\)/.test(js),
   'printer dropdown lives in the top-level folder');
ok(/fPrinter\.add\(PRINTER, 'margin'/.test(js), 'edge margin control present');
ok(/fPrinter\.add\(PRINTER, 'show_bed'\)/.test(js), 'canvas indicator toggle present');
ok(!/fGfFit\.add\(PRINTER/.test(js) && !/fGfPlate\.add\(PRINTER/.test(js),
   'no printer control is left behind under the baseplate folder');
ok(/const PRINTER = \{/.test(js) && !/printer: 'elegoo/.test(js),
   'printer state moved out of the gridfinity params object');

// Build-plate indicator on the canvas
ok(/const bedGroup = new THREE\.Group\(\)/.test(js), 'bed indicator group exists');
ok(/function updateBedIndicator\(beds\)/.test(js), 'bed indicator has an update path');
ok(/updateBedIndicator\(beds\)/.test(js), 'rebuild() refreshes the indicator');
ok(/rectLoop\(b\.w - 2 \* m, b\.d - 2 \* m/.test(js),
   'the usable area (bed minus margin) is drawn, not just the bed outline');
ok(/if \(!PRINTER\.show_bed \|\| !beds/.test(js),
   'the indicator honours its toggle and an absent bed list');

// Packing tiles onto plates — the feature that saves print jobs
ok(/packBuildPlates as gfPackPlates/.test(js), 'imports the bed packer');
ok(/add\(GP, 'layout', \['assembled', 'packed'\]\)/.test(js),
   'arrangement switch offers assembled and packed');
ok(/layout: 'assembled'/.test(js), 'layout defaults to assembled');
ok(/pack\.jobs/.test(js) && /print job/.test(js),
   'the stats line reports print jobs, not just tile count');
ok(/pack\.unplaced\.length/.test(js), 'unplaceable tiles are surfaced');
ok(/Float32Array\.from\(res\.positions\)/.test(js),
   'cached tile geometry is copied before transform — no double-translate');
ok(/const cache = new Map\(\)/.test(js) && /meshFor/.test(js),
   'identical tile sizes are built once and reused');
ok(/data\.printer/.test(js) && /data\.gridfinity\.plate_margin/.test(js),
   'sessions written before the printer move still restore their printer');
ok(/const PLATE_STORE_KEY = 'ow_build_plates'/.test(js),
   'custom plates cache under a namespaced localStorage key');
ok(/function loadCustomPlates\(\)/.test(js) && /function saveCustomPlates\(/.test(js),
   'cache read and write are both defined');
ok(/catch \(e\) \{[\s\S]{0,120}return \[\];/.test(js),
   'an unreadable cache degrades to the built-ins instead of throwing');
ok(/function refreshPrinterList\(\)/.test(js) && /printerCtrl = printerCtrl\.options\(/.test(js),
   'adding a printer rebuilds the dropdown (lil-gui replaces the controller)');
ok(/plateForm\.addEventListener\('submit'/.test(js),
   'the add-plate dialog is wired to a form submit, not a chain of prompts');
ok(/while \(allPlates\(\)\.some\(p => p\.id === id\)\)/.test(js),
   'duplicate printer names get unique ids instead of overwriting');
ok(/buildPlates: customPlates/.test(js) && /Array\.isArray\(data\.buildPlates\)/.test(js),
   'custom printers round-trip through the session JSON');
ok(/function buildGridfinityParts\(\)/.test(js) && /const partMeshes = \[\]/.test(js),
   'the preview holds one mesh per tile');
ok(/gfBuildPlate\(\{ \.\.\.base, xs: t\.xs, ys: t\.ys \}\)/.test(js),
   'each tile is built as a baseplate from its own cell lists');
ok(/plan\.oversized/.test(js) && /plan\.tooTall/.test(js),
   'oversize and height warnings surface in the stats line');
ok(/_fit\$\{lastPlan\.cols\}x\$\{lastPlan\.rows\}/.test(js),
   'a split plate gets its own filename so it cannot collide with the whole one');

// 8. 3MF export
ok(/from '\.\/assets\/threemf-exporter\.js'/.test(js),
   'imports ./assets/threemf-exporter.js');
ok(/async function export3MF\(\)/.test(js), 'export3MF() defined');
ok(/downloadBlob\(blob, name \+ '\.3mf'\)/.test(js),
   '3MF download derives its filename from the shared stem');
ok(/type: 'model\/3mf'/.test(js), 'blob carries the 3MF MIME type');
ok(/\.name\('Download 3MF \(mm, multi-part\)'\)/.test(js),
   'GUI button says what 3MF buys over STL');
ok(/trackExport\('threemf_export'/.test(js),
   '3MF export is tracked separately');
ok(/finally \{\s*disposeExportRoot\(prep\);[\s\S]{0,40}\}\s*\}\s*\n\s*gui\.add\(\{ exportSTL/.test(js)
   || (js.match(/finally \{\s*disposeExportRoot\(prep\);/g) || []).length === 2,
   '3MF export disposes carved geometry even when the write throws');

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
