// ════════════════════════════════════════════════════════════
//  3MF (3D Manufacturing Format) exporter — core spec, ZIP/store
// ════════════════════════════════════════════════════════════
//
// WHY 3MF: STL carries one anonymous triangle soup with no units, so
// a split baseplate arrives in the slicer as a single fused blob the
// user has to cut apart again. 3MF is millimetre-native and holds
// several named objects in one file, so the tiles of a split plate
// land as separate parts that arrange and print independently.
//
// WHY A HAND-ROLLED ZIP: a 3MF is an OPC package (a ZIP). Pulling in
// a compression library for it would be the only runtime dependency
// in the project, so instead we write STORED (uncompressed) entries —
// legal ZIP, read by every slicer. The file is bigger than a deflated
// one; the XML is also what makes 3MF human-inspectable, and nobody
// is emailing these around.
//
// Runs in the browser against THREE objects and in Node against the
// same minimal duck-typed surface the tests use.

// ── CRC-32 (IEEE 802.3), the checksum ZIP entries carry ─────
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    t[n] = c >>> 0;
  }
  return t;
})();

// Fed one chunk at a time so a multi-megabyte entry never has to be
// materialized as a single buffer. Seed/return value is the running
// CRC in its pre-final (un-inverted) form.
function crc32Update(crc, bytes) {
  let c = crc;
  for (let i = 0; i < bytes.length; i++)
    c = CRC_TABLE[(c ^ bytes[i]) & 0xFF] ^ (c >>> 8);
  return c >>> 0;
}

const utf8 = new TextEncoder();

// ── ZIP writer (STORE only) ─────────────────────────────────
// Collects entries as chunk lists, then emits local headers, the
// central directory and the EOCD record. Output is an array of
// Uint8Array suitable for `new Blob(parts)`.
class ZipStore {
  constructor(date = new Date()) {
    this.entries = [];
    // MS-DOS packed date/time: 2-second resolution, epoch 1980.
    this.dosTime = ((date.getHours() << 11) | (date.getMinutes() << 5)
                 | (date.getSeconds() >> 1)) & 0xFFFF;
    this.dosDate = (((date.getFullYear() - 1980) << 9)
                 | ((date.getMonth() + 1) << 5) | date.getDate()) & 0xFFFF;
  }

  // `chunks` may be strings or Uint8Arrays; strings are UTF-8 encoded.
  add(name, chunks) {
    const list = (Array.isArray(chunks) ? chunks : [chunks])
      .map(c => typeof c === 'string' ? utf8.encode(c) : c);
    let crc = 0xFFFFFFFF, size = 0;
    for (const b of list) { crc = crc32Update(crc, b); size += b.length; }
    this.entries.push({
      name: utf8.encode(name), chunks: list,
      crc: (crc ^ 0xFFFFFFFF) >>> 0, size,
    });
    return this;
  }

  build() {
    const parts = [];
    let offset = 0;
    const push = b => { parts.push(b); offset += b.length; };

    for (const e of this.entries) {
      const h = new DataView(new ArrayBuffer(30));
      h.setUint32(0, 0x04034b50, true);   // local file header signature
      h.setUint16(4, 20, true);           // version needed to extract (2.0)
      h.setUint16(6, 0, true);            // flags
      h.setUint16(8, 0, true);            // method: 0 = stored
      h.setUint16(10, this.dosTime, true);
      h.setUint16(12, this.dosDate, true);
      h.setUint32(14, e.crc, true);
      h.setUint32(18, e.size, true);      // compressed size
      h.setUint32(22, e.size, true);      // uncompressed size
      h.setUint16(26, e.name.length, true);
      h.setUint16(28, 0, true);           // extra field length
      e.offset = offset;
      push(new Uint8Array(h.buffer));
      push(e.name);
      for (const c of e.chunks) push(c);
    }

    const cdStart = offset;
    for (const e of this.entries) {
      const h = new DataView(new ArrayBuffer(46));
      h.setUint32(0, 0x02014b50, true);   // central directory signature
      h.setUint16(4, 20, true);           // version made by
      h.setUint16(6, 20, true);           // version needed
      h.setUint16(8, 0, true);
      h.setUint16(10, 0, true);
      h.setUint16(12, this.dosTime, true);
      h.setUint16(14, this.dosDate, true);
      h.setUint32(16, e.crc, true);
      h.setUint32(20, e.size, true);
      h.setUint32(24, e.size, true);
      h.setUint16(28, e.name.length, true);
      h.setUint16(30, 0, true);           // extra
      h.setUint16(32, 0, true);           // comment
      h.setUint16(34, 0, true);           // disk number
      h.setUint16(36, 0, true);           // internal attrs
      h.setUint32(38, 0, true);           // external attrs
      h.setUint32(42, e.offset, true);
      push(new Uint8Array(h.buffer));
      push(e.name);
    }

    const eocd = new DataView(new ArrayBuffer(22));
    eocd.setUint32(0, 0x06054b50, true);  // end of central directory
    eocd.setUint16(8,  this.entries.length, true);
    eocd.setUint16(10, this.entries.length, true);
    eocd.setUint32(12, offset - cdStart, true);
    eocd.setUint32(16, cdStart, true);
    push(new Uint8Array(eocd.buffer));

    return parts;
  }
}

// ── Number / string formatting ──────────────────────────────
// 4 decimals is 0.1 µm — two orders of magnitude finer than any
// printer resolves, and it keeps the XML from doubling in size on
// float noise like 20.999999999999996.
function N(v) {
  if (!Number.isFinite(v)) v = 0;
  if (Object.is(v, -0)) v = 0;
  const s = v.toFixed(4);
  return s.includes('.') ? s.replace(/0+$/, '').replace(/\.$/, '') : s;
}

function X(str) {
  return String(str == null ? '' : str)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ── Mesh collection ─────────────────────────────────────────
// One 3MF object per THREE Mesh: that is the whole point of choosing
// 3MF here, so the tiles of a split baseplate stay separable in the
// slicer instead of fusing into one body the way STL forces.
const WELD_TOL = 1e-4;

function collectMeshes(root) {
  const meshes = [];
  root.updateMatrixWorld(true);
  root.traverse(o => {
    if (o.isMesh && o.geometry && o.geometry.attributes.position) meshes.push(o);
  });

  const out = [];
  for (const mesh of meshes) {
    const geom = mesh.geometry;
    const pos  = geom.attributes.position;
    const idx  = geom.index;
    const m    = mesh.matrixWorld.elements;
    const count = idx ? idx.count : pos.count;

    const coords = [];
    const tris   = [];
    const lookup = new Map();
    const q = 1 / WELD_TOL;
    let dropped = 0;

    const weld = i => {
      const x0 = pos.getX(i), y0 = pos.getY(i), z0 = pos.getZ(i);
      const x = m[0] * x0 + m[4] * y0 + m[8]  * z0 + m[12];
      const y = m[1] * x0 + m[5] * y0 + m[9]  * z0 + m[13];
      const z = m[2] * x0 + m[6] * y0 + m[10] * z0 + m[14];
      const key = `${Math.round(x * q)},${Math.round(y * q)},${Math.round(z * q)}`;
      let w = lookup.get(key);
      if (w === undefined) {
        w = coords.length / 3;
        coords.push(x, y, z);
        lookup.set(key, w);
      }
      return w;
    };

    for (let i = 0; i < count; i += 3) {
      const a = weld(idx ? idx.getX(i)     : i);
      const b = weld(idx ? idx.getX(i + 1) : i + 1);
      const c = weld(idx ? idx.getX(i + 2) : i + 2);
      // 3MF validators reject a triangle whose three indices are not
      // distinct, so degenerates are dropped rather than written out
      // and counted so the caller can report them.
      if (a === b || b === c || a === c) { dropped++; continue; }
      tris.push(a, b, c);
    }

    if (tris.length) out.push({ name: mesh.name || '', coords, tris, dropped });
  }
  return out;
}

// ── Package parts ───────────────────────────────────────────
const CONTENT_TYPES =
  '<?xml version="1.0" encoding="UTF-8"?>\n' +
  '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
  '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
  '<Default Extension="model" ContentType="application/vnd.ms-package.3dmanufacturing-3dmodel+xml"/>' +
  '</Types>';

const RELS =
  '<?xml version="1.0" encoding="UTF-8"?>\n' +
  '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
  '<Relationship Id="rel0" Target="/3D/3dmodel.model" ' +
  'Type="http://schemas.microsoft.com/3dmanufacturing/2013/01/3dmodel"/>' +
  '</Relationships>';

const CORE_NS = 'http://schemas.microsoft.com/3dmanufacturing/core/2015/02';

/**
 * Serialize an Object3D (Mesh or Group) to a 3MF package.
 *
 * Every Mesh in the tree becomes its own <object> with a <build> item,
 * so a split baseplate opens in the slicer as one arrangeable part per
 * tile. The whole build is shifted into the positive octant — the 3MF
 * spec puts the build volume there, and slicers that do not re-centre
 * on import would otherwise drop half the model off the bed.
 *
 * Returns chunks suitable for `new Blob(parts)`.
 *
 * @param {THREE.Object3D} root
 * @param {{name?:string, app?:string, author?:string}} opts
 * @returns {{parts:Uint8Array[], objects:number, triangles:number,
 *            vertices:number, dropped:number}}
 */
export function exportThreeMF(root, opts = {}) {
  const name = opts.name || 'model';
  const app  = opts.app  || 'OneWall';

  const meshes = collectMeshes(root);
  if (!meshes.length) {
    throw new Error('nothing to export — no usable triangles found');
  }

  // Global bbox → the offset that puts the build in +x/+y/+z.
  let minX = Infinity, minY = Infinity, minZ = Infinity;
  for (const mesh of meshes)
    for (let i = 0; i < mesh.coords.length; i += 3) {
      if (mesh.coords[i]     < minX) minX = mesh.coords[i];
      if (mesh.coords[i + 1] < minY) minY = mesh.coords[i + 1];
      if (mesh.coords[i + 2] < minZ) minZ = mesh.coords[i + 2];
    }
  const ox = -minX, oy = -minY, oz = -minZ;

  const chunks = [];
  let buf = '';
  const emit = s => {
    buf += s;
    // Flush in ~64 KB slabs: keeps peak memory flat on a 100k-triangle
    // plate without paying a function call per triangle.
    if (buf.length >= 65536) { chunks.push(utf8.encode(buf)); buf = ''; }
  };

  emit('<?xml version="1.0" encoding="UTF-8"?>\n'
     + `<model unit="millimeter" xml:lang="en-US" xmlns="${CORE_NS}">`
     + `<metadata name="Application">${X(app)}</metadata>`
     + `<metadata name="Title">${X(name)}</metadata>`
     + (opts.author ? `<metadata name="Designer">${X(opts.author)}</metadata>` : '')
     + '<resources>');

  let triangles = 0, vertices = 0, dropped = 0;
  meshes.forEach((mesh, i) => {
    emit(`<object id="${i + 1}" type="model"`
       + (mesh.name ? ` name="${X(mesh.name)}"` : '') + '><mesh><vertices>');
    for (let v = 0; v < mesh.coords.length; v += 3)
      emit(`<vertex x="${N(mesh.coords[v])}" y="${N(mesh.coords[v + 1])}"`
         + ` z="${N(mesh.coords[v + 2])}"/>`);
    emit('</vertices><triangles>');
    for (let t = 0; t < mesh.tris.length; t += 3)
      emit(`<triangle v1="${mesh.tris[t]}" v2="${mesh.tris[t + 1]}"`
         + ` v3="${mesh.tris[t + 2]}"/>`);
    emit('</triangles></mesh></object>');
    triangles += mesh.tris.length / 3;
    vertices  += mesh.coords.length / 3;
    dropped   += mesh.dropped;
  });

  emit('</resources><build>');
  // Row-major 4×3: the 3×3 basis is identity (world transforms are
  // already baked into the vertices) and the last row is the shift
  // into the positive octant.
  const xform = `1 0 0 0 1 0 0 0 1 ${N(ox)} ${N(oy)} ${N(oz)}`;
  meshes.forEach((_, i) =>
    emit(`<item objectid="${i + 1}" transform="${xform}"/>`));
  emit('</build></model>');
  if (buf) chunks.push(utf8.encode(buf));

  const parts = new ZipStore()
    .add('[Content_Types].xml', CONTENT_TYPES)
    .add('_rels/.rels', RELS)
    .add('3D/3dmodel.model', chunks)
    .build();

  return { parts, objects: meshes.length, triangles, vertices, dropped };
}
