import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const tokens = readFileSync(resolve(process.cwd(), 'src/ui/foundation/tokens.css'), 'utf8');

describe('city-ui light theme tokens', () => {
  it('keeps the light theme surface palette', () => {
    expect(tokens).toContain('--city-ui-surface: rgba(255 255 255 / 0.88)');
    expect(tokens).toContain('--city-ui-surface-raised: #ffffff');
  });

  it('keeps the light theme foreground palette', () => {
    expect(tokens).toContain('--city-ui-text: #1a2236');
    expect(tokens).toContain('--city-ui-muted: #4a5878');
    expect(tokens).toContain('--city-ui-accent: #2563eb');
    expect(tokens).toContain('--city-ui-danger: #dc2626');
  });

  it('defines the zone category tokens', () => {
    expect(tokens).toContain('--city-ui-zone-residential: #16a34a');
    expect(tokens).toContain('--city-ui-zone-commercial: #2563eb');
    expect(tokens).toContain('--city-ui-zone-industrial: #d97706');
  });

  it('removes the legacy dark palette values', () => {
    expect(tokens).not.toMatch(/#f5f8fa|#b8c6ce|#63d5b4|#ffb3a7/);
    expect(tokens).not.toContain('rgb(16 28 37');
    expect(tokens).not.toContain('rgb(28 44 55');
  });
});
