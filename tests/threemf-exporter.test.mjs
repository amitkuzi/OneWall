// 3MF exporter checks — runs the real exporter, then unzips the
// result with a minimal reader written here (no dependencies) and
// validates both the ZIP container and the 3MF XML inside it.
// Run: node tests/threemf-exporter.test.mjs
import { exportThreeMF } from '../assets/threemf-exporter.js';

let pass = 0, fail = 0;
const ok = (cond, msg) => {
  if (cond) { pass++; console.log('  ✓', msg); }
  else { fail++; console.error('  ✗', msg); }
};

// ── Minimal THREE.Object3D stand-ins (same shape as the STEP test) ──
function attr(array) {
  return {
    count: array.length / 3,
    getX: i => array[i * 3],
    getY: i => array[i * 3 + 1],
    getZ: i => array[i * 3 + 2],
  };
}
function fakeMesh(positions, indices, matrix, name) {
  return {
    isMesh: true, name: name || '',
    geometry: {
      attributes: { position: attr(positions) },
      index: indices ? { count: indices.length, getX: i => indices[i] } : null,
    },
    matrixWorld: { elements: matrix || [1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1] },
    updateMatrixWorld() {},
    traverse(cb) { cb(this); },
  };
}
function fakeGroup(children) {
  return {
    isMesh: false,
    updateMatrixWorld() {},
    traverse(cb) { cb(this); children.forEach(c => cb(c)); },
  };
}

const CUBE_POS = [
  0,0,0,  1,0,0,  1,1,0,  0,1,0,
  0,0,1,  1,0,1,  1,1,1,  0,1,1,
];
const CUBE_IDX = [
  0,3,2, 0,2,1,   0,1,5, 0,5,4,
  4,5,6, 4,6,7,   1,2,6, 1,6,5,
  2,3,7, 2,7,6,   3,0,4, 3,4,7,
];

// ── Minimal STORED-entry ZIP reader ─────────────────────────
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    t[n] = c >>> 0;
  }
  return t;
})();
const crc32 = bytes => {
  let c = 0xFFFFFFFF;
  for (let i = 0; i < bytes.length; i++)
    c = CRC_TABLE[(c ^ bytes[i]) & 0xFF] ^ (c >>> 8);
  return (c ^ 0xFFFFFFFF) >>> 0;
};

function concat(parts) {
  const total = parts.reduce((s, p) => s + p.length, 0);
  const out = new Uint8Array(total);
  let o = 0;
  for (const p of parts) { out.set(p, o); o += p.length; }
  return out;
}

// Walks the central directory (the authoritative index in a ZIP) and
// returns { name -> {bytes, crcOK} } for every entry.
function unzip(bytes) {
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  // End of central directory: last 22 bytes when there is no comment.
  let eocd = -1;
  for (let i = bytes.length - 22; i >= 0; i--)
    if (dv.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
  if (eocd < 0) throw new Error('no end-of-central-directory record');

  const count = dv.getUint16(eocd + 10, true);
  let p = dv.getUint32(eocd + 16, true);
  const files = {};
  const dec = new TextDecoder();

  for (let i = 0; i < count; i++) {
    if (dv.getUint32(p, true) !== 0x02014b50)
      throw new Error('bad central directory header');
    const method  = dv.getUint16(p + 10, true);
    const crc     = dv.getUint32(p + 16, true);
    const size    = dv.getUint32(p + 24, true);
    const nameLen = dv.getUint16(p + 28, true);
    const extra   = dv.getUint16(p + 30, true);
    const comment = dv.getUint16(p + 32, true);
    const lho     = dv.getUint32(p + 42, true);
    const name    = dec.decode(bytes.subarray(p + 46, p + 46 + nameLen));

    if (dv.getUint32(lho, true) !== 0x04034b50)
      throw new Error('bad local file header for ' + name);
    const lNameLen = dv.getUint16(lho + 26, true);
    const lExtra   = dv.getUint16(lho + 28, true);
    const start    = lho + 30 + lNameLen + lExtra;
    const data     = bytes.subarray(start, start + size);

    files[name] = { bytes: data, method, crcOK: crc32(data) === crc,
                    text: dec.decode(data) };
    p += 46 + nameLen + extra + comment;
  }
  return files;
}

// ── 1. Container: a valid OPC package ───────────────────────
console.log('\nZIP container');
const single = exportThreeMF(fakeMesh(CUBE_POS, CUBE_IDX), { name: 'cube' });
const zipBytes = concat(single.parts);
ok(zipBytes[0] === 0x50 && zipBytes[1] === 0x4B,
   'file starts with the PK ZIP magic');

let files;
let readErr = '';
try { files = unzip(zipBytes); } catch (e) { readErr = e.message; }
ok(files, 'central directory parses' + (readErr ? ` — ${readErr}` : ''));

ok(files['[Content_Types].xml'], 'contains [Content_Types].xml');
ok(files['_rels/.rels'],         'contains _rels/.rels');
ok(files['3D/3dmodel.model'],    'contains 3D/3dmodel.model');
ok(Object.keys(files).length === 3, 'contains exactly the three OPC parts');
ok(Object.values(files).every(f => f.crcOK),
   'every entry CRC-32 matches its data');
ok(Object.values(files).every(f => f.method === 0),
   'every entry is STORED (no deflate dependency)');

ok(/3dmanufacturing-3dmodel\+xml/.test(files['[Content_Types].xml'].text),
   'content types declares the 3dmodel part type');
ok(/Target="\/3D\/3dmodel\.model"/.test(files['_rels/.rels'].text),
   'root relationship points at the model part');

// ── 2. The model XML ────────────────────────────────────────
console.log('\n3MF model XML');
const model = files['3D/3dmodel.model'].text;
ok(model.startsWith('<?xml version="1.0" encoding="UTF-8"?>'),
   'model part is a well-formed XML document');
ok(/<model unit="millimeter"/.test(model),
   'declares millimetre units — the whole reason to prefer 3MF over STL');
ok(/xmlns="http:\/\/schemas\.microsoft\.com\/3dmanufacturing\/core\/2015\/02"/
   .test(model), 'uses the 3MF core namespace');
ok(/<\/model>$/.test(model.trim()), 'model element is closed');
ok(/<resources>[\s\S]*<\/resources>[\s\S]*<build>[\s\S]*<\/build>/.test(model),
   'resources come before build, as the spec requires');

const verts = [...model.matchAll(/<vertex /g)].length;
const tris  = [...model.matchAll(/<triangle /g)].length;
ok(verts === 8,  'cube welds to 8 vertices');
ok(tris === 12,  'cube writes 12 triangles');
ok(single.vertices === 8 && single.triangles === 12,
   'reported counts match what was written');

// Every triangle index must resolve to a vertex that exists.
const idxOK = [...model.matchAll(/<triangle v1="(\d+)" v2="(\d+)" v3="(\d+)"\/>/g)]
  .every(m => [1,2,3].every(i => +m[i] < verts));
ok(idxOK, 'every triangle index is in range');

// ── 3. Positive octant ──────────────────────────────────────
console.log('\nbuild placement');
// Same cube shifted to -10 on every axis: the build transform must
// push it back into +x/+y/+z or slicers drop it through the bed.
const shifted = exportThreeMF(
  fakeMesh(CUBE_POS, CUBE_IDX, [1,0,0,0, 0,1,0,0, 0,0,1,0, -10,-10,-10,1]),
  { name: 'shifted' });
const sModel = concat(shifted.parts);
const sText  = unzip(sModel)['3D/3dmodel.model'].text;
const xform  = sText.match(/transform="([^"]+)"/)[1].split(/\s+/).map(Number);
ok(xform.length === 12, 'build item carries a 4×3 row-major transform');
ok(xform.slice(0, 9).join(',') === '1,0,0,0,1,0,0,0,1',
   'the basis is identity — world transforms are baked into the vertices');
ok(xform[9] === 10 && xform[10] === 10 && xform[11] === 10,
   'the translation lifts the negative model into the positive octant');

// ── 4. One object per mesh ──────────────────────────────────
console.log('\nmulti-part export');
const two = exportThreeMF(fakeGroup([
  fakeMesh(CUBE_POS, CUBE_IDX, null, 'tile_1x1'),
  fakeMesh(CUBE_POS, CUBE_IDX, [1,0,0,0, 0,1,0,0, 0,0,1,0, 50,0,0,1], 'tile_2x1'),
]), { name: 'plate' });
const tText = unzip(concat(two.parts))['3D/3dmodel.model'].text;
ok(two.objects === 2, 'two meshes report as two objects');
ok([...tText.matchAll(/<object /g)].length === 2,
   'each mesh becomes its own <object> — tiles stay separable in the slicer');
ok([...tText.matchAll(/<item /g)].length === 2, 'each object gets a build item');
ok(/id="1"/.test(tText) && /id="2"/.test(tText), 'object ids are 1-based and unique');
ok(/name="tile_1x1"/.test(tText) && /name="tile_2x1"/.test(tText),
   'mesh names carry through so tiles are identifiable in the slicer');
ok(two.triangles === 24, 'triangle count sums across objects');

// ── 5. Degenerates and edge cases ───────────────────────────
console.log('\nedge cases');
// A triangle whose corners weld together has no area — 3MF validators
// reject a repeated index, so it must be dropped, not written.
const withDegenerate = exportThreeMF(
  fakeMesh([...CUBE_POS], [...CUBE_IDX, 0, 0, 1], null), { name: 'degen' });
ok(withDegenerate.dropped === 1, 'a degenerate triangle is dropped');
ok(withDegenerate.triangles === 12, 'and does not reach the file');

let threw = '';
try { exportThreeMF(fakeGroup([]), { name: 'empty' }); }
catch (e) { threw = e.message; }
ok(/nothing to export/.test(threw),
   'an empty scene throws rather than writing a corrupt package');

// XML injection through a user-supplied name must not break the file.
const escaped = exportThreeMF(fakeMesh(CUBE_POS, CUBE_IDX), {
  name: 'a & b <script>', author: '"quoted"',
});
const eText = unzip(concat(escaped.parts))['3D/3dmodel.model'].text;
ok(/a &amp; b &lt;script&gt;/.test(eText) && !/<script>/.test(eText),
   'metadata is XML-escaped');
ok(/&quot;quoted&quot;/.test(eText), 'attribute quotes are escaped');

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
