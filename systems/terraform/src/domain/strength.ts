export type TerraformStrength = "fine" | "normal" | "strong";

const STRENGTH_LEVELS: Readonly<Record<TerraformStrength, number>> = {
  fine: 1,
  normal: 4,
  strong: 16,
};

export function strengthLevels(strength: TerraformStrength): number {
  return STRENGTH_LEVELS[strength];
}
