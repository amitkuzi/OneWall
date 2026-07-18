// STEP exporter checks — runs the real exporter on known solids and
// validates the emitted ISO-10303-21 text structurally.
// Run: node tests/step-exporter.test.mjs
import { exportSTEP } from '../assets/step-exporter.js';

let pass = 0, fail = 0;
const ok = (cond, msg) => {
  if (cond) { pass++; console.log('  ✓', msg); }
  else { fail++; console.error('  ✗', msg); }
};

// ── Minimal THREE.Object3D stand-ins ────────────────────────
// The exporter only touches traverse/isMesh/geometry/matrixWorld, so
// faking that surface keeps the test dependency-free and runnable in
// plain Node (three is loaded from a CDN in the browser).
function attr(array) {
  return {
    count: array.length / 3,
    getX: i => array[i * 3],
    getY: i => array[i * 3 + 1],
    getZ: i => array[i * 3 + 2],
  };
}
function fakeMesh(positions, indices, matrix) {
  return {
    isMesh: true,
    geometry: {
      attributes: { position: attr(positions) },
      index: indices ? { count: indices.length, getX: i => indices[i] } : null,
    },
    matrixWorld: { elements: matrix || [1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1] },
    updateMatrixWorld() {},
    traverse(cb) { cb(this); },
  };
}

// Unit cube: 8 corners, 12 triangles, outward winding.
const CUBE_POS = [
  0,0,0,  1,0,0,  1,1,0,  0,1,0,
  0,0,1,  1,0,1,  1,1,1,  0,1,1,
];
const CUBE_IDX = [
  0,3,2, 0,2,1,   // -Z
  4,5,6, 4,6,7,   // +Z
  0,1,5, 0,5,4,   // -Y
  1,2,6, 1,6,5,   // +X
  2,3,7, 2,7,6,   // +Y
  3,0,4, 3,4,7,   // -X
];

const cube = exportSTEP(fakeMesh(CUBE_POS, CUBE_IDX), { name: 'cube' });
const text = cube.parts.join('');

// ── 1. File envelope ────────────────────────────────────────
ok(text.startsWith('ISO-10303-21;'), 'starts with ISO-10303-21 magic');
ok(text.trimEnd().endsWith('END-ISO-10303-21;'), 'ends with END-ISO-10303-21');
ok(/HEADER;[\s\S]*ENDSEC;[\s\S]*DATA;[\s\S]*ENDSEC;/.test(text),
   'HEADER and DATA sections both terminated');
ok(/FILE_SCHEMA\(\('AUTOMOTIVE_DESIGN \{ 1 0 10303 214 1 1 1 1 \}'\)\)/.test(text),
   'declares the AP214 schema');
ok(/SI_UNIT\(\.MILLI\.,\.METRE\.\)/.test(text), 'length unit is millimetres');

// ── 2. Entity ids are unique and densely numbered ───────────
const defs = [...text.matchAll(/^#(\d+)=/gm)].map(m => +m[1]);
ok(new Set(defs).size === defs.length, 'no duplicate entity ids');
ok(Math.min(...defs) === 1 && Math.max(...defs) === defs.length,
   `entity ids run 1..${defs.length} with no gaps`);

// ── 3. Every reference resolves ─────────────────────────────
const defined = new Set(defs);
const refs = new Set([...text.matchAll(/#(\d+)(?!=)/g)].map(m => +m[1]));
const dangling = [...refs].filter(r => !defined.has(r));
ok(dangling.length === 0,
   `no dangling references${dangling.length ? ' — ' + dangling.slice(0,5) : ''}`);

// ── 4. Topology: the cube must come out closed ──────────────
const count = re => (text.match(re) || []).length;
const nVerts = count(/=VERTEX_POINT\(/g);
const nEdges = count(/=EDGE_CURVE\(/g);
const nFaces = count(/=ADVANCED_FACE\(/g);
ok(nVerts === 8, `8 welded vertices, not 36 (got ${nVerts})`);
ok(nFaces === 12, `12 faces (got ${nFaces})`);
// Euler characteristic V - E + F = 2 holds only if every edge is shared
// by exactly two faces — i.e. the shell actually closed.
ok(nVerts - nEdges + nFaces === 2,
   `Euler V-E+F=2 → shell is closed (${nVerts}-${nEdges}+${nFaces})`);
ok(nEdges === 18, `18 shared edges, not 36 unshared (got ${nEdges})`);
ok(cube.triangles === 12 && cube.vertices === 8, 'reported counts match');

// ── 5. Each edge is referenced by exactly two ORIENTED_EDGEs,
//       once forward and once reversed ────────────────────────
const oriented = [...text.matchAll(/=ORIENTED_EDGE\('',\*,\*,#(\d+),\.([TF])\.\)/g)];
ok(oriented.length === 36, `36 oriented edges (got ${oriented.length})`);
const senses = new Map();
for (const [, e, s] of oriented) {
  if (!senses.has(e)) senses.set(e, []);
  senses.get(e).push(s);
}
ok([...senses.values()].every(v => v.length === 2 && v[0] !== v[1]),
   'every edge used once forward and once reversed (consistent winding)');

// ── 6. Numeric literals are STEP-legal reals ────────────────
const tuples = [...text.matchAll(/(?:CARTESIAN_POINT|DIRECTION)\('',\(([^)]*)\)\)/g)];
ok(tuples.length > 0, 'coordinate tuples emitted');
const badReal = tuples
  .flatMap(m => m[1].split(','))
  .find(n => !/^-?\d+\.\d*$/.test(n.trim()));
ok(badReal === undefined,
   `all reals carry a decimal point${badReal ? ` — got "${badReal}"` : ''}`);

// ── 7. Plane axes are unit length and mutually perpendicular ─
const dirs = [...text.matchAll(/=DIRECTION\('',\(([^)]*)\)\)/g)]
  .map(m => m[1].split(',').map(Number));
const badLen = dirs.find(d => Math.abs(Math.hypot(...d) - 1) > 1e-4);
ok(badLen === undefined,
   `every DIRECTION is a unit vector${badLen ? ` — got ${badLen}` : ''}`);

// ── 8. World matrix is applied ──────────────────────────────
const moved = exportSTEP(
  fakeMesh(CUBE_POS, CUBE_IDX, [1,0,0,0, 0,1,0,0, 0,0,1,0, 10,20,30,1]),
  { name: 'moved' });
ok(/CARTESIAN_POINT\('',\(10\.,20\.,30\.\)\)/.test(moved.parts.join('')),
   'matrixWorld translation applied to output coordinates');

// ── 9. Degenerate triangles are dropped, not emitted ────────
const withSliver = exportSTEP(fakeMesh(
  [...CUBE_POS, 5,5,5, 6,5,5, 7,5,5],       // 3 collinear points
  [...CUBE_IDX, 8,9,10],
), { name: 'sliver' });
ok(withSliver.skipped === 1, `collinear triangle skipped (got ${withSliver.skipped})`);
ok(withSliver.triangles === 12, 'sliver excluded from the face list');

// ── 10. Non-indexed geometry works too (STLExporter-style soup) ─
const soup = [];
for (const i of CUBE_IDX) soup.push(CUBE_POS[i*3], CUBE_POS[i*3+1], CUBE_POS[i*3+2]);
const nonIndexed = exportSTEP(fakeMesh(soup, null), { name: 'soup' });
ok(nonIndexed.triangles === 12 && nonIndexed.vertices === 8,
   'non-indexed input welds to the same 8 vertices / 12 faces');

// ── 11. Names are escaped, not injected ─────────────────────
const quoted = exportSTEP(fakeMesh(CUBE_POS, CUBE_IDX), { name: "it's a ✓ bin" });
const qtext = quoted.parts.join('');
ok(/MANIFOLD_SOLID_BREP\('it''s a _ bin'/.test(qtext),
   'apostrophe doubled and non-ASCII replaced in names');

// ── 12. Welding-collapsed triangles are counted, not swallowed ──
// Two corners inside the weld tolerance become one vertex, so the
// triangle degenerates during welding rather than before it. The
// gridfinity baseplate sheds ~1500 of these, so under-reporting them
// would hide a sixth of the mesh going missing.
const collapsing = exportSTEP(fakeMesh(
  [...CUBE_POS, 5,5,5, 5.00001,5,5, 6,6,6],
  [...CUBE_IDX, 8,9,10],
), { name: 'collapse' });
ok(collapsing.collapsed === 1,
   `weld-collapsed triangle counted (got ${collapsing.collapsed})`);
ok(collapsing.triangles === 12, 'collapsed triangle excluded from faces');
ok(cube.collapsed === 0 && cube.skipped === 0,
   'a clean mesh reports zero collapsed and zero skipped');

// ── 13. Non-manifold edges never share one EDGE_CURVE ───────
// Three triangles hinged on a single edge — the shape the gridfinity
// socket rings actually produce. STEP forbids an EdgeCurve in a
// CLOSED_SHELL from carrying more than two faces, so the exporter has
// to hand out private curves there instead of sharing.
const FIN_POS = [0,0,0, 1,0,0, 0,1,0, 0,-1,0, 0,0,1];
const FIN_IDX = [0,1,2, 0,1,3, 0,1,4];
const fin = exportSTEP(fakeMesh(FIN_POS, FIN_IDX), { name: 'fin' });
const ftext = fin.parts.join('');
ok(fin.nonManifoldEdges === 1,
   `hinge edge reported as non-manifold (got ${fin.nonManifoldEdges})`);
ok(fin.openEdges === 6, `6 open border edges reported (got ${fin.openEdges})`);
const finUse = new Map();
for (const [, e] of ftext.matchAll(/=ORIENTED_EDGE\('',\*,\*,#(\d+),\.[TF]\.\)/g)) {
  finUse.set(e, (finUse.get(e) || 0) + 1);
}
ok([...finUse.values()].every(n => n <= 2),
   'no EDGE_CURVE is referenced by more than two faces');
ok(fin.triangles === 3, 'all three fin faces still exported');
const fdefined = new Set([...ftext.matchAll(/^#(\d+)=/gm)].map(m => +m[1]));
ok([...new Set([...ftext.matchAll(/#(\d+)(?!=)/g)].map(m => +m[1]))]
     .every(r => fdefined.has(r)),
   'non-manifold output still has no dangling references');
ok(cube.nonManifoldEdges === 0 && cube.openEdges === 0,
   'a clean closed mesh reports no non-manifold or open edges');

// ── 14. Empty input fails loudly rather than writing junk ───
let threw = false;
try { exportSTEP({ updateMatrixWorld() {}, traverse() {} }, { name: 'empty' }); }
catch { threw = true; }
ok(threw, 'empty scene throws instead of emitting an empty shell');

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
