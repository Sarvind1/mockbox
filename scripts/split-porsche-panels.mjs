/**
 * split-porsche-panels.mjs
 * Splits the Porsche 911 Targa 4S carpaint meshes into named panel meshes by triangle centroid position.
 */

import { Document, NodeIO } from '@gltf-transform/core';
import { readFileSync, writeFileSync } from 'fs';

const INPUT  = 'public/models/porsche_911.glb';
const OUTPUT = 'public/models/porsche_911_panels.glb';
const TARGET_MAT = 'PAINT_COLOR_4';

// ── Panel zone definitions ──────────────────────────────────────────────────
const PANELS = [
  { name: 'bumper_front', test: (x,y,z) => z < 0.10 },
  { name: 'bumper_rear',  test: (x,y,z) => z > 0.90 },
  { name: 'hood',         test: (x,y,z) => y > 0.65 && z >= 0.08 && z < 0.30 },
  { name: 'engine_lid',   test: (x,y,z) => y > 0.55 && z > 0.72 && z <= 0.92 },
  { name: 'roof',         test: (x,y,z) => y > 0.76 && z >= 0.30 && z <= 0.72 },
  { name: 'fender_fl',    test: (x,y,z) => x < 0.22 && y > 0.42 && z >= 0.08 && z < 0.32 },
  { name: 'fender_fr',    test: (x,y,z) => x > 0.72 && y > 0.42 && z >= 0.08 && z < 0.32 },
  { name: 'rear_quarter_l', test: (x,y,z) => x < 0.22 && y > 0.35 && z > 0.68 && z <= 0.92 },
  { name: 'rear_quarter_r', test: (x,y,z) => x > 0.72 && y > 0.35 && z > 0.68 && z <= 0.92 },
  { name: 'door_l',       test: (x,y,z) => x < 0.22 && y >= 0.25 && y <= 0.86 && z >= 0.28 && z <= 0.72 },
  { name: 'door_r',       test: (x,y,z) => x > 0.72 && y >= 0.25 && y <= 0.86 && z >= 0.28 && z <= 0.72 },
  { name: 'rocker_l',     test: (x,y,z) => x < 0.20 && y < 0.35 && z > 0.12 && z < 0.88 },
  { name: 'rocker_r',     test: (x,y,z) => x > 0.74 && y < 0.35 && z > 0.12 && z < 0.88 },
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

// 1. Collect ALL primitives from ALL meshes with material name TARGET_MAT
const targetPrims = [];  // array of { prim, meshNode }
for (const mesh of doc.getRoot().listMeshes()) {
  for (const prim of mesh.listPrimitives()) {
    const mat = prim.getMaterial();
    if (mat && mat.getName() === TARGET_MAT) {
      // find node referencing this mesh
      for (const node of doc.getRoot().listNodes()) {
        if (node.getMesh() === mesh) {
          targetPrims.push({ prim, meshNode: node });
          break;
        }
      }
    }
  }
}

if (targetPrims.length === 0) {
  console.error(`Material "${TARGET_MAT}" not found`);
  process.exit(1);
}

console.log(`Found ${targetPrims.length} primitives with material "${TARGET_MAT}"`);

// 2. Combine their vertices to compute a single shared bounding box
let minX=Infinity, minY=Infinity, minZ=Infinity;
let maxX=-Infinity, maxY=-Infinity, maxZ=-Infinity;

for (const { prim } of targetPrims) {
  const posAccess = prim.getAttribute('POSITION');
  const positions = posAccess.getArray();
  const vertCount = positions.length / 3;
  for (let i = 0; i < vertCount; i++) {
    const [x,y,z] = getVec3(positions, i);
    if (x<minX) minX=x; if (x>maxX) maxX=x;
    if (y<minY) minY=y; if (y>maxY) maxY=y;
    if (z<minZ) minZ=z; if (z>maxZ) maxZ=z;
  }
}

const extX=maxX-minX, extY=maxY-minY, extZ=maxZ-minZ;
console.log(`BBox: X[${minX.toFixed(3)}..${maxX.toFixed(3)}] Y[${minY.toFixed(3)}..${maxY.toFixed(3)}] Z[${minZ.toFixed(3)}..${maxZ.toFixed(3)}]`);

// 3. Assign each triangle (from any of the 4 source meshes) to a panel zone
const panelTris = {};
PANELS.forEach(p => panelTris[p.name] = []);

targetPrims.forEach(({ prim }, primIdx) => {
  const posAccess = prim.getAttribute('POSITION');
  const idxAccess = prim.getIndices();
  const positions = posAccess.getArray();
  const indices   = idxAccess?.getArray();
  const vertCount = positions.length / 3;
  const triCount  = indices ? indices.length / 3 : vertCount / 3;

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
        panelTris[panel.name].push({ primIdx, triIdx: t });
        break;
      }
    }
  }
});

PANELS.forEach(p => {
  const n = panelTris[p.name].length;
  if (n > 0) console.log(`  ${p.name.padEnd(14)}: ${n} tris`);
});

// 4. Build new panel meshes from the combined triangle pool
const scene = doc.getRoot().listScenes()[0];
const mat = targetPrims[0].prim.getMaterial();

// Find the direct parent of the FIRST carpaint node
const firstTargetNode = targetPrims[0].meshNode;
let parentContainer = null;
for (const node of doc.getRoot().listNodes()) {
  if (node.listChildren().some(c => c === firstTargetNode)) {
    parentContainer = node;
    break;
  }
}
console.log(`Carpaint node parent: ${parentContainer ? parentContainer.getName() : 'scene root'}`);

for (const panel of PANELS) {
  const tris = panelTris[panel.name];
  if (tris.length === 0) continue;

  const vtxCount = tris.length * 3;
  const newPos  = new Float32Array(vtxCount * 3);
  const newNorm = new Float32Array(vtxCount * 3);
  let hasNormals = true;

  tris.forEach(({ primIdx, triIdx }, i) => {
    const { prim } = targetPrims[primIdx];
    const positions = prim.getAttribute('POSITION').getArray();
    const normals   = prim.getAttribute('NORMAL')?.getArray();
    const indices   = prim.getIndices()?.getArray();

    const vi0 = indices ? indices[triIdx*3+0] : triIdx*3+0;
    const vi1 = indices ? indices[triIdx*3+1] : triIdx*3+1;
    const vi2 = indices ? indices[triIdx*3+2] : triIdx*3+2;

    for (const [slot, vi] of [[0,vi0],[1,vi1],[2,vi2]]) {
      newPos[(i*3+slot)*3+0] = positions[vi*3+0];
      newPos[(i*3+slot)*3+1] = positions[vi*3+1];
      newPos[(i*3+slot)*3+2] = positions[vi*3+2];
      if (normals) {
        newNorm[(i*3+slot)*3+0] = normals[vi*3+0];
        newNorm[(i*3+slot)*3+1] = normals[vi*3+1];
        newNorm[(i*3+slot)*3+2] = normals[vi*3+2];
      } else {
        hasNormals = false;
      }
    }
  });

  // Planar-projected UVs
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
  const aX=Math.abs(nx), aY=Math.abs(ny), aZ=Math.abs(nz);
  let uIdx, vIdx;
  if (aX >= aY && aX >= aZ) { uIdx=2; vIdx=1; }
  else if (aY >= aX && aY >= aZ) { uIdx=0; vIdx=2; }
  else                           { uIdx=0; vIdx=1; }

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
  newPrim.setAttribute('POSITION', doc.createAccessor().setArray(newPos).setType('VEC3'));
  if (hasNormals) {
    newPrim.setAttribute('NORMAL', doc.createAccessor().setArray(newNorm).setType('VEC3'));
  }
  newPrim.setAttribute('TEXCOORD_0', doc.createAccessor().setArray(planarUV).setType('VEC2'));

  const newMesh = doc.createMesh(panel.name);
  newMesh.addPrimitive(newPrim);

  const newNode = doc.createNode(panel.name);
  newNode.setMesh(newMesh);
  
  // Copy transform from the first original node
  newNode.setTranslation(firstTargetNode.getTranslation());
  newNode.setRotation(firstTargetNode.getRotation());
  newNode.setScale(firstTargetNode.getScale());

  if (parentContainer) {
    parentContainer.addChild(newNode);
  } else {
    scene.addChild(newNode);
  }
}

// 5. Detach ALL original PAINT_COLOR_4 mesh nodes
targetPrims.forEach(({ meshNode }) => {
  meshNode.detach();
});

await io.write(OUTPUT, doc);
console.log(`\n✅ Written: ${OUTPUT}`);
