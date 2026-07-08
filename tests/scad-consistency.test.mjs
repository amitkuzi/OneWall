// gridfinity.scad ↔ assets/gridfinity.js consistency checks.
// OpenSCAD isn't installed on this machine, so instead of rendering
// we verify: balanced delimiters, every module used is defined, and
// the spec constants match the JS module exactly.
// Run: node tests/scad-consistency.test.mjs
import { readFileSync } from 'fs';
import { GF } from '../assets/gridfinity.js';

const src = readFileSync(new URL('../gridfinity.scad', import.meta.url), 'utf8');
let pass = 0, fail = 0;
const ok = (cond, msg) => {
  if (cond) { pass++; console.log('  ✓', msg); }
  else { fail++; console.error('  ✗', msg); }
};

// 1. balanced delimiters (comments stripped)
const code = src.replace(/\/\/[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '');
for (const [o, c, name] of [['{', '}', 'braces'], ['(', ')', 'parens'], ['[', ']', 'brackets']]) {
  const no = code.split(o).length - 1, nc = code.split(c).length - 1;
  ok(no === nc, `${name} balanced (${no}/${nc})`);
}

// 2. constants mirror the JS module
const num = name => {
  const m = code.match(new RegExp(`${name}\\s*=\\s*([\\d.]+)`));
  return m ? parseFloat(m[1]) : NaN;
};
ok(num('PITCH') === GF.PITCH, `PITCH = ${GF.PITCH}`);
ok(num('HU') === GF.HU, `HU = ${GF.HU}`);
ok(num('FOOT_GAP') === GF.FOOT_GAP, `FOOT_GAP = ${GF.FOOT_GAP}`);
ok(num('BASE_C1') === GF.BASE.C1, `BASE_C1 = ${GF.BASE.C1}`);
ok(num('BASE_S') === GF.BASE.S, `BASE_S = ${GF.BASE.S}`);
ok(num('BASE_C2') === GF.BASE.C2, `BASE_C2 = ${GF.BASE.C2}`);
ok(num('clearance') === GF.CLEAR, `default clearance = ${GF.CLEAR}`);

// 3. every module invoked is defined
const defined = new Set([...code.matchAll(/module\s+(\w+)/g)].map(m => m[1]));
const builtins = new Set(['union', 'difference', 'hull', 'translate', 'offset',
  'square', 'linear_extrude', 'for', 'if', 'intersection', 'rotate', 'circle',
  'cube', 'cylinder', 'mirror', 'scale', 'color', 'echo']);
const called = new Set(
  [...code.matchAll(/(?:^|[\s{};)])(\w+)\s*\(/gm)].map(m => m[1])
    .filter(n => !builtins.has(n))
    .filter(n => !/^(function|module|max|min|len|abs|floor|ceil|round|concat|str)$/.test(n))
);
const fns = new Set([...code.matchAll(/function\s+(\w+)/g)].map(m => m[1]));
for (const n of called)
  ok(defined.has(n) || fns.has(n), `'${n}' is defined`);

// 4. customizer multipliers present
ok(/units_x\s*=\s*1;\s*\/\/\s*\[0\.5, 1, 2, 4\]/.test(src), 'units_x offers 0.5/1/2/4');
ok(/cell_mult\s*=\s*1;\s*\/\/\s*\[0\.5, 1, 2, 4\]/.test(src), 'cell_mult offers 0.5/1/2/4');

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
