// inspect-glb.mjs -- zero-dependency GLB inspector
import { readFileSync } from "fs";

const buf = readFileSync(process.argv[2]);
const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);

// GLB header: magic(4) + version(4) + length(4)
const magic = dv.getUint32(0, true);
if (magic !== 0x46546C67) throw new Error("Not a GLB file");
const version = dv.getUint32(4, true);
const totalLen = dv.getUint32(8, true);
console.log(`GLB v${version}, ${totalLen} bytes`);

// Chunk 0 should be JSON (type 0x4E4F534A)
const c0Len = dv.getUint32(12, true);
const c0Type = dv.getUint32(16, true);
if (c0Type !== 0x4E4F534A) throw new Error("First chunk is not JSON");

const json = JSON.parse(
  new TextDecoder().decode(buf.slice(20, 20 + c0Len))
);

// Print material names
console.log("\n== Materials ==");
(json.materials || []).forEach((m, i) =>
  console.log(`  [${i}] ${m.name || "(unnamed)"} transmission=${m.extensions?.KHR_materials_transmission?.transmissionFactor ?? (m.pbrMetallicRoughness ? 0 : 'n/a')}`)
);

// Print mesh names and their material indices
console.log("\n== Meshes ==");
(json.meshes || []).forEach((mesh, i) => {
  console.log(`  [${i}] ${mesh.name || "(unnamed)"}`);
  (mesh.primitives || []).forEach((p, j) => {
    const matIdx = p.material ?? "none";
    const matName =
      matIdx !== "none" ? json.materials?.[matIdx]?.name : "none";
    const attrs = Object.keys(p.attributes || {}).join(", ");
    console.log(`       prim[${j}] mat=${matName} (${matIdx}) attrs=[${attrs}]`);
  });
});

// Print node hierarchy
console.log("\n== Nodes ==");
(json.nodes || []).forEach((n, i) => {
  const meshRef = n.mesh !== undefined ? ` -> mesh[${n.mesh}]` : "";
  const children = n.children ? ` children=[${n.children}]` : "";
  const scale = n.scale ? ` scale=[${n.scale}]` : "";
  console.log(`  [${i}] ${n.name || "(unnamed)"}${meshRef}${children}${scale}`);
});
