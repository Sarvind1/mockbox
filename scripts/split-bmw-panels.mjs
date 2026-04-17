/**
 * split-bmw-panels.mjs
 * Splits the BMW X5M carpaint mesh into named panel meshes by triangle centroid position.
 * Outputs a new GLB with separate meshes: hood, roof, trunk, door_fl, door_fr, door_rl, door_rr,
 * fender_fl, fender_fr, bumper_front, bumper_rear, rocker_l, rocker_r, body_misc
 */

import { Document, NodeIO } from '@gltf-transform/core';
import { readFileSync, writeFileSync } from 'fs';

const INPUT  = 'public/models/2016_bmw_x5m.glb';
const OUTPUT = 'public/models/2016_bmw_x5m_panels.glb';
const TARGET_MAT = 'carpaint';

// ── Panel zone definitions ──────────────────────────────────────────────────
// All coordinates are NORMALIZED (0–1) relative to the body mesh bounding box:
//   nX: 0=left (-X) → 1=right (+X)
//   nY: 0=bottom    → 1=top
//   nZ: 0=front     → 1=rear
//
// Each zone is { name, test(nX, nY, nZ) → bool }.
// Zones are evaluated in order; first match wins. 'body_misc' is the fallback.

// BBox from analysis: X[-1.197..1.197] Y[0.002..1.677] Z[-2.744..2.572]
// nZ=0 = front bumper face, nZ=1 = rear bumper face
// nY=0 = underfloor, nY=1 = roofline
// nX=0 = left (driver), nX=1 = right (passenger)
const PANELS = [
  { name: 'bumper_front', test: (x,y,z) => z < 0.10 },
  { name: 'bumper_rear',  test: (x,y,z) => z > 0.90 },
  { name: 'hood',         test: (x,y,z) => y > 0.70 && z >= 0.10 && z < 0.35 },
  // Roof raised to 0.84 so upper door frames aren't stolen
  { name: 'roof',         test: (x,y,z) => y > 0.84 && z >= 0.35 && z <= 0.68 },
  { name: 'trunk',        test: (x,y,z) => y > 0.62 && z > 0.68 && z <= 0.90 },
  { name: 'fender_fl',    test: (x,y,z) => x < 0.25 && y > 0.42 && z >= 0.10 && z < 0.32 },
  { name: 'fender_fr',    test: (x,y,z) => x > 0.75 && y > 0.42 && z >= 0.10 && z < 0.32 },
  // Doors: y range extended up to 0.86, z ranges don't overlap (fl ends at 0.50, rl starts at 0.50)
  { name: 'door_fl',      test: (x,y,z) => x < 0.22 && y >= 0.25 && y <= 0.86 && z >= 0.28 && z < 0.50 },
  { name: 'door_fr',      test: (x,y,z) => x > 0.78 && y >= 0.25 && y <= 0.86 && z >= 0.28 && z < 0.50 },
  { name: 'door_rl',      test: (x,y,z) => x < 0.22 && y >= 0.25 && y <= 0.86 && z >= 0.50 && z <= 0.76 },
  { name: 'door_rr',      test: (x,y,z) => x > 0.78 && y >= 0.25 && y <= 0.86 && z >= 0.50 && z <= 0.76 },
  { name: 'rocker_l',     test: (x,y,z) => x < 0.20 && y < 0.35 && z > 0.12 && z < 0.88 },
  { name: 'rocker_r',     test: (x,y,z) => x > 0.80 && y < 0.35 && z > 0.12 && z < 0.88 },
  { name: 'body_misc',    test: () => true },
];

// ── Helpers ─────────────────────────────────────────────────────────────────

function getVec3(arr, idx) {
  return [arr[idx * 3], arr[idx * 3 + 1], arr[idx * 3 + 2]];
}

function centroid(a, b, c) {
  return [(a[0]+b[0]+c[0])/3, (a[1]+b[1]+c[1])/3, (a[2]+b[2]+c[2])/3];
}

// ── Main ────────────────────────────────────────────────────────────────────

const io = new NodeIO();
const doc = await io.read(INPUT);

// Find target mesh + primitive
let targetPrim = null;
let targetMeshNode = null;
let targetMeshObj = null;

for (const mesh of doc.getRoot().listMeshes()) {
  for (const prim of mesh.listPrimitives()) {
    const mat = prim.getMaterial();
    if (mat && mat.getName() === TARGET_MAT) {
      targetPrim = prim;
      targetMeshObj = mesh;
      // find node referencing this mesh
      for (const node of doc.getRoot().listNodes()) {
        if (node.getMesh() === mesh) { targetMeshNode = node; break; }
      }
      break;
    }
  }
  if (targetPrim) break;
}

if (!targetPrim) {
  console.error(`Material "${TARGET_MAT}" not found`);
  process.exit(1);
}

const posAccess = targetPrim.getAttribute('POSITION');
const normAccess = targetPrim.getAttribute('NORMAL');
const uvAccess = targetPrim.getAttribute('TEXCOORD_0');
const idxAccess = targetPrim.getIndices();

const positions = posAccess.getArray();
const normals   = normAccess?.getArray();
const uvs       = uvAccess?.getArray();
const indices   = idxAccess?.getArray();
const vertCount = positions.length / 3;
const triCount  = indices ? indices.length / 3 : vertCount / 3;

console.log(`Mesh: ${vertCount} verts, ${triCount} triangles`);

// Compute bounding box of entire body mesh
let minX=Infinity, minY=Infinity, minZ=Infinity;
let maxX=-Infinity, maxY=-Infinity, maxZ=-Infinity;
for (let i = 0; i < vertCount; i++) {
  const [x,y,z] = getVec3(positions, i);
  if (x<minX) minX=x; if (x>maxX) maxX=x;
  if (y<minY) minY=y; if (y>maxY) maxY=y;
  if (z<minZ) minZ=z; if (z>maxZ) maxZ=z;
}
const extX=maxX-minX, extY=maxY-minY, extZ=maxZ-minZ;
console.log(`BBox: X[${minX.toFixed(3)}..${maxX.toFixed(3)}] Y[${minY.toFixed(3)}..${maxY.toFixed(3)}] Z[${minZ.toFixed(3)}..${maxZ.toFixed(3)}]`);

// For each triangle: compute centroid → normalize → assign zone
// Collect: panelTris[panelName] = array of original tri indices
const panelTris = {};
PANELS.forEach(p => panelTris[p.name] = []);

for (let t = 0; t < triCount; t++) {
  const i0 = indices ? indices[t*3+0] : t*3+0;
  const i1 = indices ? indices[t*3+1] : t*3+1;
  const i2 = indices ? indices[t*3+2] : t*3+2;
  const v0 = getVec3(positions, i0);
  const v1 = getVec3(positions, i1);
  const v2 = getVec3(positions, i2);
  const [cx,cy,cz] = centroid(v0,v1,v2);
  const nX = (cx-minX)/extX;
  const nY = (cy-minY)/extY;
  const nZ = (cz-minZ)/extZ;

  for (const panel of PANELS) {
    if (panel.test(nX,nY,nZ)) {
      panelTris[panel.name].push(t);
      break;
    }
  }
}

PANELS.forEach(p => {
  const n = panelTris[p.name].length;
  if (n > 0) console.log(`  ${p.name.padEnd(14)}: ${n} tris`);
});

// Build new nodes for each non-empty panel
const scene = doc.getRoot().listScenes()[0];
const mat = targetPrim.getMaterial();

// Find the direct parent of the carpaint node so panels stay in the same coordinate space
let parentContainer = null;
for (const node of doc.getRoot().listNodes()) {
  if (node.listChildren().some(c => c === targetMeshNode)) {
    parentContainer = node;
    break;
  }
}
console.log(`Carpaint node parent: ${parentContainer ? parentContainer.getName() : 'scene root'}`);

for (const panel of PANELS) {
  const tris = panelTris[panel.name];
  if (tris.length === 0) continue;

  // Build new flat (non-indexed) position and normal arrays for this panel
  const vtxCount = tris.length * 3;
  const newPos  = new Float32Array(vtxCount * 3);
  const newNorm = normals ? new Float32Array(vtxCount * 3) : null;

  tris.forEach((triIdx, i) => {
    const vi0 = indices ? indices[triIdx*3+0] : triIdx*3+0;
    const vi1 = indices ? indices[triIdx*3+1] : triIdx*3+1;
    const vi2 = indices ? indices[triIdx*3+2] : triIdx*3+2;
    for (const [slot, vi] of [[0,vi0],[1,vi1],[2,vi2]]) {
      newPos[(i*3+slot)*3+0] = positions[vi*3+0];
      newPos[(i*3+slot)*3+1] = positions[vi*3+1];
      newPos[(i*3+slot)*3+2] = positions[vi*3+2];
      if (newNorm) {
        newNorm[(i*3+slot)*3+0] = normals[vi*3+0];
        newNorm[(i*3+slot)*3+1] = normals[vi*3+1];
        newNorm[(i*3+slot)*3+2] = normals[vi*3+2];
      }
    }
  });

  // Generate planar-projected UVs so a texture fills the entire panel without clipping.
  // Compute area-weighted average normal, drop the dominant axis, project remaining two,
  // then normalize to [0,1]². This guarantees the full image fills the panel.
  let nx=0, ny=0, nz=0;
  for (let i = 0; i < tris.length; i++) {
    const b = i * 3;
    const x0=newPos[b*3], y0=newPos[b*3+1], z0=newPos[b*3+2];
    const x1=newPos[(b+1)*3], y1=newPos[(b+1)*3+1], z1=newPos[(b+1)*3+2];
    const x2=newPos[(b+2)*3], y2=newPos[(b+2)*3+1], z2=newPos[(b+2)*3+2];
    const ex=x1-x0, ey=y1-y0, ez=z1-z0;
    const fx=x2-x0, fy=y2-y0, fz=z2-z0;
    nx += ey*fz - ez*fy;
    ny += ez*fx - ex*fz;
    nz += ex*fy - ey*fx;
  }
  const nlen = Math.sqrt(nx*nx + ny*ny + nz*nz) || 1;
  nx/=nlen; ny/=nlen; nz/=nlen;
  // Drop the dominant axis — project onto the remaining two
  const aX=Math.abs(nx), aY=Math.abs(ny), aZ=Math.abs(nz);
  let uIdx, vIdx;
  if (aX >= aY && aX >= aZ) { uIdx=2; vIdx=1; }      // side face  → u=Z, v=Y
  else if (aY >= aX && aY >= aZ) { uIdx=0; vIdx=2; } // top/bottom → u=X, v=Z
  else                           { uIdx=0; vIdx=1; } // front/rear → u=X, v=Y

  const planarUV = new Float32Array(vtxCount * 2);
  for (let j = 0; j < vtxCount; j++) {
    planarUV[j*2+0] = newPos[j*3 + uIdx];
    planarUV[j*2+1] = newPos[j*3 + vIdx];
  }
  let pMin0=Infinity, pMax0=-Infinity, pMin1=Infinity, pMax1=-Infinity;
  for (let k=0; k<planarUV.length; k+=2) {
    if(planarUV[k]<pMin0)pMin0=planarUV[k]; if(planarUV[k]>pMax0)pMax0=planarUV[k];
    if(planarUV[k+1]<pMin1)pMin1=planarUV[k+1]; if(planarUV[k+1]>pMax1)pMax1=planarUV[k+1];
  }
  const r0=pMax0-pMin0||1, r1=pMax1-pMin1||1;
  for (let k=0; k<planarUV.length; k+=2) {
    planarUV[k]   = (planarUV[k]  -pMin0)/r0;
    planarUV[k+1] = (planarUV[k+1]-pMin1)/r1;
  }

  const newPrim = doc.createPrimitive();
  newPrim.setMaterial(mat);

  const posAcc = doc.createAccessor().setArray(newPos).setType('VEC3');
  newPrim.setAttribute('POSITION', posAcc);
  if (newNorm) {
    const normAcc = doc.createAccessor().setArray(newNorm).setType('VEC3');
    newPrim.setAttribute('NORMAL', normAcc);
  }
  const uvAcc = doc.createAccessor().setArray(planarUV).setType('VEC2');
  newPrim.setAttribute('TEXCOORD_0', uvAcc);

  const newMesh = doc.createMesh(panel.name);
  newMesh.addPrimitive(newPrim);

  const newNode = doc.createNode(panel.name);
  newNode.setMesh(newMesh);
  // Copy the original node's local transform (vertices are in its local space)
  if (targetMeshNode) {
    newNode.setTranslation(targetMeshNode.getTranslation());
    newNode.setRotation(targetMeshNode.getRotation());
    newNode.setScale(targetMeshNode.getScale());
  }
  // Add to the same parent as the original carpaint node, not the root scene
  if (parentContainer) {
    parentContainer.addChild(newNode);
  } else {
    scene.addChild(newNode);
  }
}

// Remove original carpaint mesh node from scene
if (targetMeshNode) {
  targetMeshNode.detach();
}

await io.write(OUTPUT, doc);
console.log(`\n✅ Written: ${OUTPUT}`);
