export interface ShapeAtlasFixture {
  readonly id: `F-${string}`;
  readonly name: string;
  readonly width: 8;
  readonly height: 8;
  readonly heightLevels: Uint8Array;
}

function matrix(rows: readonly (readonly number[])[]): Uint8Array {
  if (rows.length !== 8 || rows.some((row) => row.length !== 8)) {
    throw new Error('shape-atlas:invalid-matrix');
  }
  return Uint8Array.from(rows.flat());
}

const FLAT = matrix(Array.from({ length: 8 }, () => Array<number>(8).fill(1)));
const SINGLE_HIGH = FLAT.slice();
SINGLE_HIGH[4 * 8 + 4] = 2;
const SINGLE_LOW = new Uint8Array(64).fill(2);
SINGLE_LOW[4 * 8 + 4] = 1;
const RAMP = matrix(Array.from({ length: 8 }, (_, z) => Array<number>(8).fill(z < 4 ? 2 : 1)));
const PLATEAU = matrix(
  Array.from({ length: 8 }, (_, z) =>
    Array.from({ length: 8 }, (_, x) => (x >= 2 && x <= 5 && z >= 2 && z <= 5 ? 2 : 1)),
  ),
);
const RIDGE = matrix(
  Array.from({ length: 8 }, (_, z) => Array.from({ length: 8 }, (_, x) => ((x + z) % 2 === 0 ? 2 : 1))),
);
const VALLEY = matrix(
  Array.from({ length: 8 }, (_, z) => Array.from({ length: 8 }, (_, x) => ((x + z) % 2 === 0 ? 1 : 2))),
);
const BASIN = matrix(
  Array.from({ length: 8 }, (_, z) =>
    Array.from({ length: 8 }, (_, x) => (x >= 2 && x <= 5 && z >= 2 && z <= 5 ? 1 : 2)),
  ),
);
const STAIRCASE = matrix(
  Array.from({ length: 8 }, (_, z) => Array<number>(8).fill(z < 3 ? 3 : z < 6 ? 2 : 1)),
);
const SADDLE = matrix(
  Array.from({ length: 8 }, (_, z) => Array.from({ length: 8 }, (_, x) => (x < 4 === z < 4 ? 2 : 1))),
);
const SEAM = matrix(Array.from({ length: 8 }, (_, z) => Array<number>(8).fill(z < 4 ? 2 : 1)));
const BOUNDARY = matrix(
  Array.from({ length: 8 }, (_, z) =>
    Array.from({ length: 8 }, (_, x) => (x === 0 || z === 0 || x === 7 || z === 7 ? 2 : 1)),
  ),
);

export const SHAPE_ATLAS_FIXTURES: readonly ShapeAtlasFixture[] = Object.freeze([
  { id: 'F-01', name: 'Flat', width: 8, height: 8, heightLevels: FLAT },
  { id: 'F-02', name: 'Single Raised Vertex', width: 8, height: 8, heightLevels: SINGLE_HIGH },
  { id: 'F-03', name: 'Single Lowered Vertex', width: 8, height: 8, heightLevels: SINGLE_LOW },
  { id: 'F-04', name: 'Cardinal Ramp Band', width: 8, height: 8, heightLevels: RAMP },
  { id: 'F-05', name: 'Raised Plateau', width: 8, height: 8, heightLevels: PLATEAU },
  { id: 'F-06', name: 'Diagonal Ridge', width: 8, height: 8, heightLevels: RIDGE },
  { id: 'F-07', name: 'Diagonal Valley', width: 8, height: 8, heightLevels: VALLEY },
  { id: 'F-08', name: 'Basin', width: 8, height: 8, heightLevels: BASIN },
  { id: 'F-09', name: 'Staircase', width: 8, height: 8, heightLevels: STAIRCASE },
  { id: 'F-10', name: 'Saddle/Twist', width: 8, height: 8, heightLevels: SADDLE },
  { id: 'F-11', name: 'Chunk Seam', width: 8, height: 8, heightLevels: SEAM },
  { id: 'F-12', name: 'Map Boundary Skirt', width: 8, height: 8, heightLevels: BOUNDARY },
]);
