import type { RciDefinitionRegistries } from '@web-three-city/rci-core';
import type { CommittedWorld } from '../../application/committed-world.js';
import type { DialogHost } from '../dialog/dialog-host.js';
import { createInspectProjection } from './inspect-projections.js';
import type { InspectTarget } from './inspect-target.js';

export function openInspectDialog(
  host: DialogHost,
  getWorld: () => CommittedWorld,
  registries: RciDefinitionRegistries,
  target: InspectTarget,
): void {
  host.open({ kind: 'inspect', key: target.kind, title: 'Inspect' }, (body) => {
    const projection = createInspectProjection(getWorld(), target, registries);
    const heading = document.createElement('h3');
    heading.textContent = projection.title;
    body.append(heading);
    for (const item of projection.fields ?? []) {
      const row = document.createElement('p');
      const label = document.createElement('span');
      const value = document.createElement('strong');
      label.textContent = item.label;
      value.textContent = item.value;
      row.append(label, value);
      body.append(row);
    }
  });
}
