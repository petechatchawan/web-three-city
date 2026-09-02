import {
  strengthDeltaMeters,
  type TerraformStrength,
} from "@web-three-city/terraform";

const STRENGTH_ORDER: readonly TerraformStrength[] = Object.freeze([
  "fine",
  "normal",
  "strong",
]);

const STRENGTH_LABELS: Readonly<Record<TerraformStrength, string>> =
  Object.freeze({
    fine: "Fine",
    normal: "Normal",
    strong: "Strong",
  });

export const TERRAFORM_STRENGTH_OPTIONS = Object.freeze(
  STRENGTH_ORDER.map((strength) =>
    Object.freeze({
      value: strength,
      label: `${STRENGTH_LABELS[strength]} ${strengthDeltaMeters(strength)}m`,
      testId: `terraform-strength-${strength}`,
    }),
  ),
);
