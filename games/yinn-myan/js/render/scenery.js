// Real surroundings from data/scenery.json (tools/scenery.py): Overture/OSM building footprints with
// real or estimated heights, trees at the crowns found in the Meta/WRI canopy height map, OSM water,
// parks and compounds with their road-facing walls, Mapillary-detected billboards, landmark labels.
// Nothing here is placed at random; the RNG only picks facade textures and paint colours, which the
// open data doesn't have.
import * as THREE from 'three';

const PAL = [[0.93, 0.9, 0.82], [0.86, 0.84, 0.78], [0.78, 0.83, 0.8], [0.9, 0.82, 0.7], [0.8, 0.83, 0.86],
  [0.93, 0.88, 0.72], [0.84, 0.74, 0.66], [0.96, 0.95, 0.92], [0.72, 0.78, 0.8], [0.88, 0.86, 0.82]];
const TOWER = [[0.78, 0.84, 0.88], [0.86, 0.87, 0.88], [0.7, 0.77, 0.83], [0.92, 0.92, 0.9]];

export function buildScenery({ scene, road, SC, TEX, R, canvasTex, signTex, M }) {
  const { frameAt, projectAny } = road;
  const lists = { shop: { P: [], U: [], C: [], I: [] }, up: [0, 1, 2, 3].map(() => ({ P: [], U: [], C: [], I: [] })), roof: { P: [], U: [], C: [], I: [] } };

  // prism walls from a footprint; walls face outward whatever the winding
  function prism(L, pts, y0, h, col, uw, uh, u0) {
    let cx = 0, cz = 0; pts.forEach((p) => { cx += p[0]; cz += p[1]; }); cx /= pts.length; cz /= pts.length; let u = u0 || 0;
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i], b = pts[(i + 1) % pts.length]; const len = Math.hypot(b[0] - a[0], b[1] - a[1]); if (len < 0.05) continue;
      const base = L.P.length / 3; L.P.push(a[0], y0, a[1], b[0], y0, b[1], b[0], y0 + h, b[1], a[0], y0 + h, a[1]);
      const u1 = u + len / uw; L.U.push(u, 0, u1, 0, u1, h / uh, u, h / uh); u = u1; for (let k = 0; k < 4; k++) L.C.push(col[0], col[1], col[2]);
      const ex = b[0] - a[0], ez = b[1] - a[1]; const mx = (a[0] + b[0]) / 2 - cx, mz = (a[1] + b[1]) / 2 - cz; const out = (ez * mx - ex * mz) > 0;
      if (out) L.I.push(base, base + 1, base + 2, base, base + 2, base + 3); else L.I.push(base, base + 2, base + 1, base, base + 3, base + 2);
    }
  }
  function cap(L, pts, y, shade) {
    let tris; try { tris = THREE.ShapeUtils.triangulateShape(pts.map((p) => new THREE.Vector2(p[0], p[1])), []); } catch (e) { return; }
    const base = L.P.length / 3; for (const p of pts) { L.P.push(p[0], y, p[1]); L.U.push(p[0] / 8, p[1] / 8); L.C.push(shade[0], shade[1], shade[2]); }
    for (const t of tris) {
      const a = pts[t[0]], b = pts[t[1]], c = pts[t[2]]; const cr = (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
      if (cr < 0) L.I.push(base + t[0], base + t[1], base + t[2]); else L.I.push(base + t[0], base + t[2], base + t[1]);
    }
  }
  function mk(L, mat, cast = true) {
    if (!L.P.length) return; const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(L.P, 3));
    if (L.U) g.setAttribute('uv', new THREE.Float32BufferAttribute(L.U, 2)); if (L.C) g.setAttribute('color', new THREE.Float32BufferAttribute(L.C, 3));
    g.setIndex(L.I); g.computeVertexNormals(); const m = new THREE.Mesh(g, mat); m.castShadow = cast; m.receiveShadow = true; scene.add(m); return m;
  }

  // ---------- buildings ----------
  const TANK_G = new THREE.CylinderGeometry(0.8, 0.8, 1.4, 10), TANK_M = new THREE.MeshStandardMaterial({ color: 0x2b5ea8, roughness: 0.6 });
  const named = [];
  for (const b of SC.buildings) {
    const tall = b.h > 24;
    const col = (tall ? TOWER : PAL)[(R() * (tall ? TOWER.length : PAL.length)) | 0];
    const roofShade = [0.72 + R() * 0.15, 0.71 + R() * 0.15, 0.68 + R() * 0.15];
    const gh = Math.min(3.6, b.h);
    if (b.shop) prism(lists.shop, b.p, 0, gh, [1, 1, 1], 48, 3.6, (R() * 8 | 0) / 8);
    else prism(lists.up[(R() * 4) | 0], b.p, 0, gh, col, 4.2, 3.1);
    if (b.h > gh + 0.1) prism(lists.up[tall ? (R() < 0.5 ? 0 : 1) : (R() * 4) | 0], b.p, gh, b.h - gh, col, 4.2, 3.1);
    cap(lists.roof, b.p, b.h, roofShade);
    if (b.est && b.h < 12 && R() < 0.5) { // rooftop water tank, as on most Yangon low-rise
      let cx = 0, cz = 0; b.p.forEach((p) => { cx += p[0]; cz += p[1]; }); const t = new THREE.Mesh(TANK_G, TANK_M); t.position.set(cx / b.p.length, b.h + 0.7, cz / b.p.length); t.castShadow = true; scene.add(t);
    }
    if (b.n) named.push(b);
  }
  TEX.shops.wrapS = THREE.RepeatWrapping;
  mk(lists.shop, new THREE.MeshStandardMaterial({ map: TEX.shops, vertexColors: true, roughness: 0.8 }));
  lists.up.forEach((L, i) => mk(L, new THREE.MeshStandardMaterial({ map: TEX.upper[i], vertexColors: true, roughness: 0.85 })));
  mk(lists.roof, new THREE.MeshStandardMaterial({ map: TEX.roof, vertexColors: true, roughness: 0.95 }));

  // name boards on named buildings, on the wall nearest the road (high up on towers so you see them from afar)
  for (const b of named) {
    let best = null;
    for (let i = 0; i < b.p.length; i++) {
      const a = b.p[i], c = b.p[(i + 1) % b.p.length]; const len = Math.hypot(c[0] - a[0], c[1] - a[1]); if (len < 4) continue;
      const q = projectAny((a[0] + c[0]) / 2, (a[1] + c[1]) / 2); if (!q) continue; const sc = Math.abs(q.d); if (!best || sc < best.sc) best = { a, c, len, sc, q };
    }
    if (!best || best.sc > 260) continue;
    const w = Math.min(best.len * 0.85, Math.max(4, b.n.length * 0.32), b.h > 24 ? 16 : 9);
    const tex = signTex(b.n, '#f4f1e8', '#1c2a3a', 768, 128, '700 60px Barlow, Padauk, Arial, sans-serif');
    const pl = new THREE.Mesh(new THREE.PlaneGeometry(w, w / 6), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.5, emissive: 0x111111 }));
    const mx = (best.a[0] + best.c[0]) / 2, mz = (best.a[1] + best.c[1]) / 2; const f = frameAt(best.q.s); const toRoad = best.q.d > 0 ? -1 : 1;
    const nx = f.nx * toRoad, nz = f.nz * toRoad;
    const y = b.h > 24 ? b.h - w / 6 : Math.min(b.h - 0.6, 5.2);
    pl.position.set(mx + nx * 0.12, y, mz + nz * 0.12); pl.rotation.y = Math.atan2(nx, nz); scene.add(pl);
  }

  // ---------- trees (one per detected crown: real height and spread) ----------
  const trunkG = new THREE.CylinderGeometry(0.16, 0.3, 1, 7); trunkG.translate(0, 0.5, 0);
  const crownG = new THREE.SphereGeometry(1, 9, 6);
  { const p = crownG.attributes.position;
    for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), z = p.getZ(i); const k = 0.84 + 0.16 * Math.sin(x * 5.1 + y * 3.7) * Math.cos(z * 4.3 - y * 2.9) + 0.07 * Math.sin(x * 13 + z * 11); p.setXYZ(i, x * k, y * k, z * k); }
    crownG.computeVertexNormals(); }
  const leafTex = canvasTex(256, 256, (g, w, h) => { g.fillStyle = '#8a8a8a'; g.fillRect(0, 0, w, h); for (let i = 0; i < 2600; i++) { const v = 60 + R() * 170 | 0; g.fillStyle = `rgba(${v},${v},${v},.85)`; g.beginPath(); g.ellipse(R() * w, R() * h, 2 + R() * 5, 1.5 + R() * 3, R() * 3, 0, 7); g.fill(); } });
  leafTex.repeat.set(3, 2);
  const T = SC.trees, n = T.length;
  const trunk = new THREE.InstancedMesh(trunkG, new THREE.MeshStandardMaterial({ color: 0x4e4134, roughness: 0.95 }), n);
  const crown = new THREE.InstancedMesh(crownG, new THREE.MeshStandardMaterial({ color: 0xffffff, map: leafTex, roughness: 0.85 }), n * 2);
  trunk.castShadow = crown.castShadow = true; crown.receiveShadow = true;
  const o = new THREE.Object3D(), col = new THREE.Color(); let ci = 0;
  T.forEach(([x, z, h, r, ox = 0, oz = 0], i) => {
    // (ox, oz): crown centre relative to the trunk, for big trees whose crown hangs over the road
    const crownH = Math.min(h * 0.55, r * 1.3 + 1); const trunkH = Math.max(1.6, h - crownH * 1.4);
    const lean = (v) => Math.max(-0.22, Math.min(0.22, Math.atan2(v, trunkH))); // a gentle lean toward the crown, never more than ~12°
    o.position.set(x, 0, z); o.rotation.set(lean(oz), 0, -lean(ox));
    o.scale.set(Math.max(0.6, r / 4), trunkH, Math.max(0.6, r / 4)); o.updateMatrix(); trunk.setMatrixAt(i, o.matrix);
    const parts = h < 7 ? 1 : 2;
    for (let k = 0; k < parts; k++) {
      const a = R() * 6.28, off = k === 0 ? 0 : r * 0.35;
      o.position.set(x + ox + Math.cos(a) * off, h - crownH * (k === 0 ? 0.55 : 0.85), z + oz + Math.sin(a) * off);
      const sc = k === 0 ? 1 : 0.75; o.scale.set(r * sc, crownH * 0.6 * sc, r * sc); o.rotation.set(0, R() * 6, 0); o.updateMatrix(); crown.setMatrixAt(ci, o.matrix);
      col.setHSL(0.22 + R() * 0.06, 0.4 + R() * 0.15, 0.27 + R() * 0.1); crown.setColorAt(ci, col); ci++;
    }
  });
  crown.count = ci;
  scene.add(trunk, crown);

  // ---------- areas: water, green, compounds ----------
  const AM = {
    water: new THREE.MeshPhysicalMaterial({ color: 0x2f4a4e, roughness: 0.06, metalness: 0.0, clearcoat: 1, clearcoatRoughness: 0.05 }),
    green: new THREE.MeshStandardMaterial({ color: 0x5e7a3a, roughness: 1 }),
    compound: new THREE.MeshStandardMaterial({ color: 0x7a7c55, roughness: 1 }),
  };
  const AY = { water: -0.35, green: -0.07, compound: -0.09 };
  const AL = { water: { P: [], I: [] }, green: { P: [], I: [] }, compound: { P: [], I: [] } };
  for (const a of SC.areas) {
    let tris; try { tris = THREE.ShapeUtils.triangulateShape(a.p.map((p) => new THREE.Vector2(p[0], p[1])), []); } catch (e) { continue; }
    const L = AL[a.k], base = L.P.length / 3, y = AY[a.k];
    for (const p of a.p) L.P.push(p[0], y, p[1]);
    for (const t of tris) {
      const A = a.p[t[0]], B = a.p[t[1]], C = a.p[t[2]]; const cr = (B[0] - A[0]) * (C[1] - A[1]) - (B[1] - A[1]) * (C[0] - A[0]);
      if (cr < 0) L.I.push(base + t[0], base + t[1], base + t[2]); else L.I.push(base + t[0], base + t[2], base + t[1]);
    }
  }
  for (const k of Object.keys(AL)) { AL[k].U = null; AL[k].C = null; mk(AL[k], AM[k], false); }

  // compound walls facing the road (2.2 m, cream with a darker base)
  { const P = [], I = [], C = [];
    for (const w of SC.walls) for (let i = 0; i < w.p.length - 1; i++) {
      const a = w.p[i], b = w.p[i + 1]; const base = P.length / 3;
      P.push(a[0], 0, a[1], b[0], 0, b[1], b[0], 2.2, b[1], a[0], 2.2, a[1]); I.push(base, base + 1, base + 2, base, base + 2, base + 3);
      C.push(0.55, 0.52, 0.46, 0.55, 0.52, 0.46, 0.9, 0.86, 0.74, 0.9, 0.86, 0.74);
    }
    if (P.length) mk({ P, I, C, U: null }, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, side: THREE.DoubleSide })); }

  // ---------- billboards where Mapillary detected advertisements ----------
  const adTex = canvasTex(512, 200, (g, w, h) => { // plain panel: we know a billboard stands here, not what it shows today
    const gr = g.createLinearGradient(0, 0, w, h); gr.addColorStop(0, '#24415e'); gr.addColorStop(1, '#5b7c99'); g.fillStyle = gr; g.fillRect(0, 0, w, h);
    g.fillStyle = 'rgba(255,255,255,.12)'; for (let i = 0; i < 6; i++) g.fillRect(R() * w, R() * h, 40 + R() * 160, 10 + R() * 40);
    g.strokeStyle = '#dcdcdc'; g.lineWidth = 8; g.strokeRect(4, 4, w - 8, h - 8);
  });
  adTex.wrapS = adTex.wrapT = THREE.ClampToEdgeWrapping;
  const adM = new THREE.MeshStandardMaterial({ map: adTex, roughness: 0.6, side: THREE.DoubleSide });
  for (const [x, z, s, d] of SC.billboards) {
    const f = frameAt(s); const toRoad = d > 0 ? -1 : 1; const g = new THREE.Group();
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.32, 7, 10), M.metal); post.position.y = 3.5; post.castShadow = true;
    const panel = new THREE.Mesh(new THREE.PlaneGeometry(9, 3.6), adM); panel.position.y = 8.6; panel.castShadow = true;
    const frame = new THREE.Mesh(new THREE.BoxGeometry(9.3, 3.9, 0.3), M.dark); frame.position.set(0, 8.6, -0.2);
    g.add(post, panel, frame); g.position.set(x, 0, z);
    // face the road at an angle, the way roadside boards are turned toward oncoming traffic
    g.rotation.y = Math.atan2(f.nx * toRoad, f.nz * toRoad) + (d > 0 ? -0.6 : 0.6); scene.add(g);
  }

  // ---------- labels for landmarks without a mapped footprint ----------
  for (const p of SC.pois) {
    const q = projectAny(p.x, p.z); if (!q) continue; const f = frameAt(q.s); const toRoad = q.d > 0 ? -1 : 1;
    const g = new THREE.Group(); const tex = signTex(p.n, '#1d4f91', '#ffffff', 512, 96);
    const pl = new THREE.Mesh(new THREE.PlaneGeometry(2.8, 0.55), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.5, side: THREE.DoubleSide })); pl.position.y = 3.2;
    const po = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 3.3, 6), M.metal); po.position.y = 1.65; g.add(pl, po);
    const d = (Math.abs(q.d) < road.curbAt(q.s) + 1) ? Math.sign(q.d) * (road.curbAt(q.s) + 1.5) : q.d;
    g.position.set(f.x + f.nx * d, 0.18, f.z + f.nz * d); g.rotation.y = Math.atan2(f.nx * toRoad, f.nz * toRoad); scene.add(g);
  }
  return { buildings: SC.buildings.length, trees: n };
}
