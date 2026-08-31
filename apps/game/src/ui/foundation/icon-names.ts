export const UI_ICON_NAMES = [
  "terrain",
  "roads",
  "zones",
  "buildings",
  "menu",
  "close",
  "undo",
  "save",
  "chevron-left",
  "chevron-right",
  "refresh",
  "play",
  "pause",
  "warning",
  "info",
] as const;

export type UiIconName = (typeof UI_ICON_NAMES)[number];
