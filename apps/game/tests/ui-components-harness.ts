import "../src/style.css";
import { createDialog } from "../src/ui/components/dialog";
import { createPopover } from "../src/ui/components/popover";
import { createSegmentedControl } from "../src/ui/components/segmented-control";
import { createTabs } from "../src/ui/components/tabs";
import { createContextSurface } from "../src/ui/patterns/context-surface";
import { createDialogHost } from "../src/ui/patterns/dialog-host";
import { createNotificationHost } from "../src/ui/patterns/notification-host";
import { createToolDock } from "../src/ui/patterns/tool-dock";
import { createButton } from "../src/ui/primitives/button";
import { createCheckbox } from "../src/ui/primitives/checkbox";
import { createRadio } from "../src/ui/primitives/radio";
import { createSlider } from "../src/ui/primitives/slider";
import type { GameToolDescriptor } from "../src/ui/tools/game-tool-contract";

const mount = document.querySelector<HTMLElement>("#ui-components-test");
if (mount === null) throw new Error("UI components test mount missing.");
mount.className = "ui-test-page";

const operation = createSegmentedControl<"raise" | "lower" | "flatten">({
  ariaLabel: "Terrain operation",
  items: [
    { value: "raise", label: "Raise" },
    { value: "lower", label: "Lower" },
    { value: "flatten", label: "Flatten" },
  ],
  onChange: (value) => {
    mount.dataset.operation = value;
  },
});
operation.render({ value: "raise", disabledValues: [] });

const checkbox = createCheckbox({
  id: "ui-component-checkbox",
  label: "Show grid",
  onChange: (checked) => {
    mount.dataset.checkbox = String(checked);
  },
});
const radioA = createRadio({
  id: "ui-component-radio-a",
  name: "density",
  value: "compact",
  label: "Compact",
  checked: true,
  onChange: (value) => {
    mount.dataset.radio = value;
  },
});
const radioB = createRadio({
  id: "ui-component-radio-b",
  name: "density",
  value: "expanded",
  label: "Expanded",
  onChange: (value) => {
    mount.dataset.radio = value;
  },
});
const slider = createSlider({
  id: "ui-component-slider",
  label: "Brush opacity",
  min: 0,
  max: 100,
  value: 50,
  onChange: (value) => {
    mount.dataset.slider = String(value);
  },
});

const tabAContent = document.createElement("p");
tabAContent.textContent = "Terrain controls";
const tabBContent = document.createElement("p");
tabBContent.textContent = "Road controls";
const tabs = createTabs({
  ariaLabel: "Tool details",
  items: [
    { id: "terrain", label: "Terrain tab", content: tabAContent },
    { id: "roads", label: "Roads tab", content: tabBContent },
  ],
  initialId: "terrain",
  onChange: (id) => {
    mount.dataset.tab = id;
  },
});

const popoverTrigger = createButton({ label: "Open options" });
const popoverBody = document.createElement("div");
popoverBody.textContent = "Popover content";
const popover = createPopover({
  trigger: popoverTrigger.element,
  content: popoverBody,
  ariaLabel: "Options",
});

const dialogBody = document.createElement("div");
dialogBody.textContent = "Delete city?";
const closeDialog = createButton({ label: "Cancel dialog" });
dialogBody.append(closeDialog.element);
const dialog = createDialog({ ariaLabel: "Delete city", content: dialogBody });
const openDialog = createButton({
  label: "Open dialog",
  onPress: () => dialog.open(),
});
closeDialog.element.addEventListener("click", () => dialog.close());

const terrain: GameToolDescriptor = {
  id: "terrain",
  label: "Terrain",
  icon: "terrain",
  shortcut: "T",
  order: 10,
};
const roads: GameToolDescriptor = {
  id: "roads",
  label: "Roads",
  icon: "roads",
  shortcut: "R",
  order: 20,
};
const zones: GameToolDescriptor = {
  id: "zones",
  label: "Zones",
  icon: "zones",
  shortcut: "Z",
  order: 30,
};
const toolDock = createToolDock({
  onToolPress: (id) => {
    mount.dataset.toolPress = id;
  },
});
toolDock.render({
  tools: [
    { descriptor: terrain, availability: { status: "available" } },
    {
      descriptor: roads,
      availability: { status: "locked", reason: "Requires milestone" },
    },
    { descriptor: zones, availability: { status: "hidden" } },
  ],
  activeToolId: "terrain",
});

const contextContent = document.createElement("div");
contextContent.textContent = "Terrain context controls";
const context = createContextSurface({
  onDismiss: () => {
    mount.dataset.contextDismissed = "true";
  },
});
context.render({
  open: true,
  label: "Terrain tools",
  mode: "compact",
  content: contextContent,
});

const worldUnderlay = document.createElement("div");
worldUnderlay.dataset.testid = "pattern-world-underlay";
worldUnderlay.textContent = "World";
const hostedDialogBody = document.createElement("div");
hostedDialogBody.textContent = "Hosted confirmation";
const hostedDialog = createDialog({
  ariaLabel: "Hosted confirmation",
  content: hostedDialogBody,
});
const dialogHost = createDialogHost({ worldUnderlay });
const openHostedDialog = createButton({
  label: "Open hosted dialog",
  onPress: () => dialogHost.open(hostedDialog),
});
const notificationHost = createNotificationHost();
const notify = createButton({
  label: "Notify",
  onPress: () => notificationHost.notify({ message: "City saved" }),
});

mount.append(
  operation.element,
  checkbox.element,
  radioA.element,
  radioB.element,
  slider.element,
  tabs.element,
  popoverTrigger.element,
  popover.element,
  openDialog.element,
  dialog.element,
  worldUnderlay,
  toolDock.element,
  context.element,
  openHostedDialog.element,
  dialogHost.element,
  notify.element,
  notificationHost.element,
);
mount.dataset.ready = "true";

window.addEventListener(
  "pagehide",
  () => {
    operation.dispose();
    checkbox.dispose();
    radioA.dispose();
    radioB.dispose();
    slider.dispose();
    tabs.dispose();
    popover.dispose();
    popoverTrigger.dispose();
    openDialog.dispose();
    closeDialog.dispose();
    dialog.dispose();
    toolDock.dispose();
    context.dispose();
    dialogHost.dispose();
    hostedDialog.dispose();
    openHostedDialog.dispose();
    notificationHost.dispose();
    notify.dispose();
  },
  { once: true },
);
