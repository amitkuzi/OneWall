// ════════════════════════════════════════════════════════════
//  STEP (ISO 10303-21) exporter — faceted B-Rep, AP214
// ════════════════════════════════════════════════════════════
//
// WHY FACETED: the OneWall geometry is a procedurally generated
// triangle mesh (rings of points swept up the wall, plus a CSG
// carve for the signature). There is no B-Rep anywhere in the
// pipeline, so there are no analytic surfaces to write out. This
// exporter emits every triangle as its own planar ADVANCED_FACE.
// The result is a valid, universally importable STEP solid — but
// it lands in CAD as a faceted body, NOT as an editable
// parametric feature tree. The GUI label says "faceted" so nobody
// downloads this expecting smooth NURBS.
//
// WHY ADVANCED_BREP AND NOT THE SMALLER FORMS: POLY_LOOP-based
// FACETED_BREP is ~3x smaller and AP242 TESSELLATED_FACE_SET is
// ~15x smaller, but both are unevenly supported by importers.
// MANIFOLD_SOLID_BREP + ADVANCED_FACE + EDGE_LOOP is the shape
// every real CAD kernel emits, so it is the one every CAD kernel
// reads. We pay the file size for that.

const AP214 = 'AUTOMOTIVE_DESIGN { 1 0 10303 214 1 1 1 1 }';

// Weld tolerance in mm. Vertices closer than this collapse to one
// STEP VERTEX_POINT so adjacent triangles share an EDGE_CURVE —
// that sharing is what makes the solid come in closed rather than
// as loose surfaces, and it roughly halves the edge count.
const WELD_TOL = 1e-4;

// STEP reals must carry a decimal point: `1.` is legal, `1` is not.
function R(v) {
  if (!Number.isFinite(v)) v = 0;
  if (Object.is(v, -0)) v = 0;
  let s = v.toFixed(6);
  if (s.indexOf('.') >= 0) {
    s = s.replace(/0+$/, '');
    if (s.endsWith('.')) return s;
  }
  return s;
}

// STEP strings are single-quoted with '' as the escape. The format
// predates Unicode; anything non-ASCII goes out as '_' rather than
// risking an encoding the importer will reject.
function S(str) {
  return String(str == null ? '' : str)
    .replace(/[^\x20-\x7E]/g, '_')
    .replace(/'/g, "''");
}

function stepTimestamp(d = new Date()) {
  const p = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
       + `T${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

// Flatten an Object3D tree into one welded, indexed triangle soup in
// world space. Handles both a bare Mesh (the CSG carve result) and a
// Group (the live preview root), matching what STLExporter walks.
function collectTriangles(root) {
  const meshes = [];
  root.updateMatrixWorld(true);
  root.traverse(o => {
    if (o.isMesh && o.geometry && o.geometry.attributes.position) meshes.push(o);
  });

  const coords = [];          // flat xyz of welded vertices
  const tris   = [];          // flat vertex-index triples
  const lookup = new Map();   // quantized position key -> welded index
  const q = 1 / WELD_TOL;
  let collapsed = 0;          // triangles that welding reduced to a line

  const v = { x: 0, y: 0, z: 0 };
  for (const mesh of meshes) {
    const geom = mesh.geometry;
    const pos  = geom.attributes.position;
    const idx  = geom.index;
    const m    = mesh.matrixWorld.elements;
    const count = idx ? idx.count : pos.count;

    const weld = i => {
      const x0 = pos.getX(i), y0 = pos.getY(i), z0 = pos.getZ(i);
      // Inline the matrix apply — this runs ~100k times per export
      // and Vector3 allocation showed up in profiles.
      v.x = m[0] * x0 + m[4] * y0 + m[8]  * z0 + m[12];
      v.y = m[1] * x0 + m[5] * y0 + m[9]  * z0 + m[13];
      v.z = m[2] * x0 + m[6] * y0 + m[10] * z0 + m[14];
      const key = `${Math.round(v.x * q)},${Math.round(v.y * q)},${Math.round(v.z * q)}`;
      let w = lookup.get(key);
      if (w === undefined) {
        w = coords.length / 3;
        coords.push(v.x, v.y, v.z);
        lookup.set(key, w);
      }
      return w;
    };

    for (let i = 0; i < count; i += 3) {
      const a = weld(idx ? idx.getX(i)     : i);
      const b = weld(idx ? idx.getX(i + 1) : i + 1);
      const c = weld(idx ? idx.getX(i + 2) : i + 2);
      // A welded triangle with a repeated corner has collapsed to a
      // line — it has no normal, so PLANE would be undefined. These
      // are counted, not swallowed: the gridfinity baseplate alone
      // sheds ~1500 of them, and silently dropping a sixth of the
      // mesh is exactly the kind of thing an export must own up to.
      if (a === b || b === c || a === c) { collapsed++; continue; }
      tris.push(a, b, c);
    }
  }

  // Drop slivers — corners distinct but collinear, so there is no
  // usable normal and PLANE would be degenerate. This has to happen
  // before edges are classified, otherwise a sliver's edges inflate
  // the usage counts and a genuinely manifold edge gets miscounted.
  const kept = [];
  let skipped = 0;
  for (let t = 0; t < tris.length; t += 3) {
    const a = tris[t], b = tris[t+1], c = tris[t+2];
    const ux = coords[b*3] - coords[a*3];
    const uy = coords[b*3+1] - coords[a*3+1];
    const uz = coords[b*3+2] - coords[a*3+2];
    const wx = coords[c*3] - coords[a*3];
    const wy = coords[c*3+1] - coords[a*3+1];
    const wz = coords[c*3+2] - coords[a*3+2];
    const nl = Math.hypot(uy*wz - uz*wy, uz*wx - ux*wz, ux*wy - uy*wx);
    if (nl < 1e-12 || Math.hypot(ux, uy, uz) < 1e-12) { skipped++; continue; }
    kept.push(a, b, c);
  }
  return { coords, tris: kept, collapsed, skipped };
}

/**
 * Serialize an Object3D (Mesh or Group) to a faceted STEP AP214 solid.
 *
 * Returns an array of string chunks suitable for `new Blob(parts)` —
 * the caller never materializes the whole file as one string, which
 * matters because a 30k-triangle export runs to tens of megabytes.
 *
 * @param {THREE.Object3D} root
 * @param {{name?:string, filename?:string, author?:string, org?:string}} opts
 * @returns {{parts:string[], triangles:number, vertices:number, skipped:number,
 *            collapsed:number, nonManifoldEdges:number, openEdges:number}}
 */
export function exportSTEP(root, opts = {}) {
  const name     = opts.name     || 'model';
  const filename = opts.filename || `${name}.step`;
  const author   = opts.author   || '';
  const org      = opts.org      || '';

  const { coords, tris, collapsed, skipped } = collectTriangles(root);
  const nVerts = coords.length / 3;
  if (tris.length === 0) {
    throw new Error('nothing to export — no usable triangles found');
  }

  const parts = [];
  let buf = [];
  let id  = 0;
  const next = () => ++id;
  // Batch the line array into the parts list so neither grows without
  // bound; 4096 lines per chunk keeps peak memory flat.
  const emit = line => {
    buf.push(line);
    if (buf.length >= 4096) { parts.push(buf.join('\n') + '\n'); buf = []; }
  };
  const flush = () => {
    if (buf.length) { parts.push(buf.join('\n') + '\n'); buf = []; }
  };

  parts.push(
    'ISO-10303-21;\n' +
    'HEADER;\n' +
    `FILE_DESCRIPTION(('${S(name)} faceted solid'),'2;1');\n` +
    `FILE_NAME('${S(filename)}','${stepTimestamp()}',('${S(author)}'),` +
      `('${S(org)}'),'OneWall STEP writer','OneWall','');\n` +
    `FILE_SCHEMA(('${AP214}'));\n` +
    'ENDSEC;\n' +
    'DATA;\n'
  );

  // ── Product / context boilerplate ──────────────────────────
  const appCtx = next();
  emit(`#${appCtx}=APPLICATION_CONTEXT('mechanical design');`);
  emit(`#${next()}=APPLICATION_PROTOCOL_DEFINITION('international standard',`
     + `'automotive_design',2000,#${appCtx});`);
  const prodCtx = next();
  emit(`#${prodCtx}=PRODUCT_CONTEXT('',#${appCtx},'mechanical');`);
  const product = next();
  emit(`#${product}=PRODUCT('${S(name)}','${S(name)}','',(#${prodCtx}));`);
  const pdf = next();
  emit(`#${pdf}=PRODUCT_DEFINITION_FORMATION('','',#${product});`);
  const pdCtx = next();
  emit(`#${pdCtx}=PRODUCT_DEFINITION_CONTEXT('part definition',#${appCtx},'design');`);
  const pd = next();
  emit(`#${pd}=PRODUCT_DEFINITION('design','',#${pdf},#${pdCtx});`);
  const pds = next();
  emit(`#${pds}=PRODUCT_DEFINITION_SHAPE('','',#${pd});`);

  // ── Units: millimetres, radians ────────────────────────────
  const lenUnit = next();
  emit(`#${lenUnit}=( LENGTH_UNIT() NAMED_UNIT(*) SI_UNIT(.MILLI.,.METRE.) );`);
  const angUnit = next();
  emit(`#${angUnit}=( NAMED_UNIT(*) PLANE_ANGLE_UNIT() SI_UNIT($,.RADIAN.) );`);
  const solUnit = next();
  emit(`#${solUnit}=( NAMED_UNIT(*) SI_UNIT($,.STERADIAN.) SOLID_ANGLE_UNIT() );`);
  const uncert = next();
  emit(`#${uncert}=UNCERTAINTY_MEASURE_WITH_UNIT(LENGTH_MEASURE(1.E-05),`
     + `#${lenUnit},'distance_accuracy_value','confusion accuracy');`);
  const geoCtx = next();
  emit(`#${geoCtx}=( GEOMETRIC_REPRESENTATION_CONTEXT(3) `
     + `GLOBAL_UNCERTAINTY_ASSIGNED_CONTEXT((#${uncert})) `
     + `GLOBAL_UNIT_ASSIGNED_CONTEXT((#${lenUnit},#${angUnit},#${solUnit})) `
     + `REPRESENTATION_CONTEXT('','3D') );`);

  // ── World origin placement ─────────────────────────────────
  const oPt = next();  emit(`#${oPt}=CARTESIAN_POINT('',(0.,0.,0.));`);
  const oZ  = next();  emit(`#${oZ}=DIRECTION('',(0.,0.,1.));`);
  const oX  = next();  emit(`#${oX}=DIRECTION('',(1.,0.,0.));`);
  const originAxis = next();
  emit(`#${originAxis}=AXIS2_PLACEMENT_3D('',#${oPt},#${oZ},#${oX});`);

  // ── Vertices ───────────────────────────────────────────────
  const vertexId = new Int32Array(coords.length / 3);
  for (let i = 0; i < coords.length; i += 3) {
    const p = next();
    emit(`#${p}=CARTESIAN_POINT('',(${R(coords[i])},${R(coords[i+1])},${R(coords[i+2])}));`);
    const vp = next();
    emit(`#${vp}=VERTEX_POINT('',#${p});`);
    vertexId[i / 3] = vp;
  }

  // ── Edge classification ────────────────────────────────────
  // A manifold edge belongs to exactly two faces, and STEP encodes
  // that by having both faces reference ONE EdgeCurve with opposite
  // ORIENTED_EDGE senses. The OneWall meshes are watertight but not
  // manifold — the gridfinity baseplate has ~600 edges where three
  // or more faces meet, an artefact of how the socket rings are
  // stitched. Sharing an EdgeCurve across three faces is invalid
  // STEP and importers reject the whole shell over it.
  //
  // So: share the edge where the mesh is manifold (>99% of edges),
  // and give each face its own private EdgeCurve on the edges where
  // it isn't. The result stays importable — CAD sews coincident
  // curves by proximity — and the counts come back to the caller so
  // the UI can say the shell is imperfect instead of implying it is
  // a clean solid.
  const usage = new Map();
  const ekey = (a, b) => Math.min(a, b) * nVerts + Math.max(a, b);
  for (let t = 0; t < tris.length; t += 3) {
    const a = tris[t], b = tris[t+1], c = tris[t+2];
    for (const [x, y] of [[a,b],[b,c],[c,a]]) {
      const k = ekey(x, y);
      usage.set(k, (usage.get(k) || 0) + 1);
    }
  }
  let nonManifoldEdges = 0, openEdges = 0;
  for (const n of usage.values()) {
    if (n > 2) nonManifoldEdges++;
    else if (n === 1) openEdges++;
  }

  // Emits the LINE + EDGE_CURVE running from vertex `from` to `to`.
  const writeEdge = (from, to) => {
    const ax = coords[from*3], ay = coords[from*3+1], az = coords[from*3+2];
    const bx = coords[to*3],   by = coords[to*3+1],   bz = coords[to*3+2];
    let dx = bx - ax, dy = by - ay, dz = bz - az;
    const len = Math.hypot(dx, dy, dz) || 1;
    dx /= len; dy /= len; dz /= len;
    const lp = next();
    emit(`#${lp}=CARTESIAN_POINT('',(${R(ax)},${R(ay)},${R(az)}));`);
    const ld = next();
    emit(`#${ld}=DIRECTION('',(${R(dx)},${R(dy)},${R(dz)}));`);
    const lv = next();
    emit(`#${lv}=VECTOR('',#${ld},${R(len)});`);
    const ln = next();
    emit(`#${ln}=LINE('',#${lp},#${lv});`);
    const ec = next();
    emit(`#${ec}=EDGE_CURVE('',#${vertexId[from]},#${vertexId[to]},#${ln},.T.);`);
    return ec;
  };

  // Returns the ORIENTED_EDGE id for the directed edge a->b.
  const edges = new Map();
  const orientedEdge = (a, b) => {
    const k = ekey(a, b);
    let curve, sense;
    if (usage.get(k) === 2) {
      curve = edges.get(k);
      if (curve === undefined) {
        curve = writeEdge(Math.min(a, b), Math.max(a, b));
        edges.set(k, curve);
      }
      sense = a < b ? '.T.' : '.F.';
    } else {
      // Private curve, built in this face's own direction.
      curve = writeEdge(a, b);
      sense = '.T.';
    }
    const oe = next();
    emit(`#${oe}=ORIENTED_EDGE('',*,*,#${curve},${sense});`);
    return oe;
  };

  // ── Faces ──────────────────────────────────────────────────
  const faceIds = [];
  for (let t = 0; t < tris.length; t += 3) {
    const a = tris[t], b = tris[t+1], c = tris[t+2];
    const ax = coords[a*3], ay = coords[a*3+1], az = coords[a*3+2];
    const bx = coords[b*3], by = coords[b*3+1], bz = coords[b*3+2];
    const cx = coords[c*3], cy = coords[c*3+1], cz = coords[c*3+2];

    let ux = bx - ax, uy = by - ay, uz = bz - az;
    const wx = cx - ax, wy = cy - ay, wz = cz - az;
    let nx = uy * wz - uz * wy;
    let ny = uz * wx - ux * wz;
    let nz = ux * wy - uy * wx;
    // collectTriangles() already rejected anything degenerate, so
    // both lengths are known non-zero here.
    const nl = Math.hypot(nx, ny, nz);
    const ul = Math.hypot(ux, uy, uz);
    nx /= nl; ny /= nl; nz /= nl;
    ux /= ul; uy /= ul; uz /= ul;

    // ref_direction must be perpendicular to the axis. u = b-a is,
    // by construction, since the normal is u x w.
    const pp = next();
    emit(`#${pp}=CARTESIAN_POINT('',(${R(ax)},${R(ay)},${R(az)}));`);
    const pn = next();
    emit(`#${pn}=DIRECTION('',(${R(nx)},${R(ny)},${R(nz)}));`);
    const pr = next();
    emit(`#${pr}=DIRECTION('',(${R(ux)},${R(uy)},${R(uz)}));`);
    const pa = next();
    emit(`#${pa}=AXIS2_PLACEMENT_3D('',#${pp},#${pn},#${pr});`);
    const plane = next();
    emit(`#${plane}=PLANE('',#${pa});`);

    const o1 = orientedEdge(a, b);
    const o2 = orientedEdge(b, c);
    const o3 = orientedEdge(c, a);
    const loop = next();
    emit(`#${loop}=EDGE_LOOP('',(#${o1},#${o2},#${o3}));`);
    const bound = next();
    emit(`#${bound}=FACE_OUTER_BOUND('',#${loop},.T.);`);
    const face = next();
    emit(`#${face}=ADVANCED_FACE('',(#${bound}),#${plane},.T.);`);
    faceIds.push(face);
  }

  // ── Shell, solid, shape representation ─────────────────────
  // CLOSED_SHELL takes the entire face list on one line. That line is
  // huge, so build it directly into parts instead of through emit().
  flush();
  const shell = next();
  parts.push(`#${shell}=CLOSED_SHELL('',(`);
  const CHUNK = 2000;
  for (let i = 0; i < faceIds.length; i += CHUNK) {
    const slice = faceIds.slice(i, i + CHUNK).map(f => '#' + f).join(',');
    parts.push(i === 0 ? slice : ',' + slice);
  }
  parts.push('));\n');

  const brep = next();
  emit(`#${brep}=MANIFOLD_SOLID_BREP('${S(name)}',#${shell});`);
  const shapeRep = next();
  emit(`#${shapeRep}=ADVANCED_BREP_SHAPE_REPRESENTATION('${S(name)}',`
     + `(#${originAxis},#${brep}),#${geoCtx});`);
  emit(`#${next()}=SHAPE_DEFINITION_REPRESENTATION(#${pds},#${shapeRep});`);
  flush();

  parts.push('ENDSEC;\nEND-ISO-10303-21;\n');

  return {
    parts,
    triangles: faceIds.length,
    vertices:  nVerts,
    skipped,            // collinear slivers dropped
    collapsed,          // triangles welding reduced to a line
    nonManifoldEdges,   // edges with 3+ faces — shell is not a clean solid
    openEdges,          // edges with 1 face — holes in the shell
  };
}
