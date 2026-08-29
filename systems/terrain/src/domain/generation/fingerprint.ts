import type { ProductionTerrainField } from "./production-field";

const FNV_OFFSET = 14695981039346656037n;
const FNV_PRIME = 1099511628211n;
const HEX_WIDTH = 16;

function updateFnv1a(hash: bigint, byte: number): bigint {
  return BigInt.asUintN(64, (hash ^ BigInt(byte)) * FNV_PRIME);
}

export function fingerprintProductionTerrainField(
  field: ProductionTerrainField,
): string {
  const headerBuffer = new ArrayBuffer(8);
  const headerView = new DataView(headerBuffer);
  headerView.setUint32(0, field.vertexWidth, true);
  headerView.setUint32(4, field.vertexHeight, true);

  let hash = FNV_OFFSET;
  for (const byte of new Uint8Array(headerBuffer)) {
    hash = updateFnv1a(hash, byte);
  }

  const valueBuffer = new ArrayBuffer(4);
  const valueView = new DataView(valueBuffer);
  const valueBytes = new Uint8Array(valueBuffer);

  for (let z = 0; z < field.vertexHeight; z += 1) {
    for (let x = 0; x < field.vertexWidth; x += 1) {
      valueView.setInt32(0, field.elevationAt(x, z), true);
      for (const byte of valueBytes) {
        hash = updateFnv1a(hash, byte);
      }
    }
  }

  return `0x${hash.toString(16).toUpperCase().padStart(HEX_WIDTH, "0")}`;
}
