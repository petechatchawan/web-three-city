import type { TerraformPlan } from '@web-three-city/terrain-core';
import { describe, expect, it, vi } from 'vitest';
import { routeTerraformRelease } from './game-input.js';

const VALID_PLAN = Object.freeze({
  valid: true,
  invalidReason: null,
}) as TerraformPlan;

describe('routeTerraformRelease', () => {
  it('never calls commit for Road-blocked or no-change releases', () => {
    const commit = vi.fn<(plan: TerraformPlan) => void>();
    const reject = vi.fn();

    routeTerraformRelease({ kind: 'rejected', reason: 'terraform:road-occupied' }, commit, reject);
    routeTerraformRelease({ kind: 'no-change' }, commit, reject);

    expect(commit).not.toHaveBeenCalled();
    expect(reject).toHaveBeenNthCalledWith(1, 'terraform:road-occupied');
    expect(reject).toHaveBeenNthCalledWith(2, 'terraform:no-change');
  });

  it('calls commit exactly once for a valid release', () => {
    const commit = vi.fn<(plan: TerraformPlan) => void>();

    routeTerraformRelease({ kind: 'commit', plan: VALID_PLAN }, commit, vi.fn());

    expect(commit).toHaveBeenCalledOnce();
    expect(commit).toHaveBeenCalledWith(VALID_PLAN);
  });

  it('ignores a release from a cancelled or non-owning pointer', () => {
    const commit = vi.fn<(plan: TerraformPlan) => void>();
    const reject = vi.fn();

    routeTerraformRelease({ kind: 'ignored' }, commit, reject);

    expect(commit).not.toHaveBeenCalled();
    expect(reject).not.toHaveBeenCalled();
  });
});
