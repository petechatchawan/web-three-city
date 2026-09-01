import "../src/style.css";
import { createSurface } from "../src/ui/components/surface";
import { createBadge } from "../src/ui/primitives/badge";
import { createButton } from "../src/ui/primitives/button";
import { createEmptyState } from "../src/ui/primitives/empty-state";
import { createField } from "../src/ui/primitives/field";
import { createIcon } from "../src/ui/primitives/icon";
import { createInput } from "../src/ui/primitives/input";
import { createSwitch } from "../src/ui/primitives/switch";

const mount = document.querySelector<HTMLElement>("#ui-primitives-test");
if (mount === null) throw new Error("UI primitives test mount missing.");
mount.className = "ui-test-page";

const card = createSurface({
  tone: "panel",
  title: "Create city",
  description: "Primitive contract",
});
const terrainIcon = createIcon("terrain");
const nameInput = createInput({
  id: "city-name-test",
  name: "cityName",
  placeholder: "City name",
});
const field = createField({
  label: "City name",
  control: nameInput,
  description: "Required",
});
const primary = createButton({
  label: "Create",
  variant: "primary",
  testId: "ui-primary",
});
const secondary = createButton({
  label: "Cancel",
  variant: "secondary",
  testId: "ui-secondary",
});
const badge = createBadge({ label: "Ready", tone: "neutral" });
const toggle = createSwitch({
  id: "debug-grid-test",
  label: "Gameplay grid",
  testId: "ui-switch",
});
const empty = createEmptyState({
  title: "No cities yet",
  description: "Create a city to get started.",
});

card.content.append(
  terrainIcon,
  field.element,
  badge,
  toggle.element,
  primary.element,
  secondary.element,
  empty,
);
mount.append(card.element);
mount.dataset.ready = "true";

window.addEventListener(
  "pagehide",
  () => {
    primary.dispose();
    secondary.dispose();
    toggle.dispose();
  },
  { once: true },
);
