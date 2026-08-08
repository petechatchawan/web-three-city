import { describe, expect, it } from 'vitest';
import { createDialogNavigation, type PrimaryDialogRoute } from './dialog-navigation.js';

const overview: PrimaryDialogRoute = { kind: 'system', key: 'overview', title: 'City' };
const economy: PrimaryDialogRoute = { kind: 'system', key: 'economy', title: 'Economy' };

describe('dialog navigation', () => {
  it('replaces the primary stack on open and navigates back in LIFO order', () => {
    const navigation = createDialogNavigation();
    navigation.open(overview);
    navigation.push(economy);
    expect(navigation.active()).toEqual(economy);
    expect(navigation.back()).toEqual(overview);
    expect(navigation.back()).toBeNull();
    expect(navigation.active()).toBeNull();
  });

  it('opening another primary route discards the previous stack', () => {
    const navigation = createDialogNavigation();
    navigation.open(overview);
    navigation.push(economy);
    const inspect: PrimaryDialogRoute = { kind: 'inspect', key: 'terrain', title: 'Terrain' };
    navigation.open(inspect);
    expect(navigation.back()).toBeNull();
  });
});
