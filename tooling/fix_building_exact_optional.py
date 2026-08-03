from pathlib import Path

path = Path('apps/game/src/game-input.ts')
source = path.read_text(encoding='utf-8')
old = """    getZoneSnapshot: options.getZoneSnapshot,
    getBuildingSnapshot: options.getBuildingSnapshot,
    onState(state): void {
"""
new = """    getZoneSnapshot: options.getZoneSnapshot,
    ...(options.getBuildingSnapshot === undefined
      ? {}
      : { getBuildingSnapshot: options.getBuildingSnapshot }),
    onState(state): void {
"""
if old not in source:
    raise RuntimeError('exact-optional:missing-game-input-forwarding')
path.write_text(source.replace(old, new, 1), encoding='utf-8')
print('Fixed Building optional provider forwarding')
