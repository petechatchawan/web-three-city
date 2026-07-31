export function expandGameSecondaryControls(root: ParentNode): HTMLDetailsElement {
  const controls = root.querySelector<HTMLDetailsElement>(
    '[data-testid="secondary-controls"]',
  );
  if (controls === null) throw new Error('game:missing-secondary-controls');
  controls.open = true;
  return controls;
}
