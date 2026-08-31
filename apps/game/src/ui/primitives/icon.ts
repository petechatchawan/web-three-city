import type { UiIconName } from "../foundation/icon-names";

const SVG_NS = "http://www.w3.org/2000/svg";

type IconNode =
  | { readonly type: "path"; readonly d: string }
  | {
      readonly type: "line";
      readonly x1: number;
      readonly y1: number;
      readonly x2: number;
      readonly y2: number;
    }
  | {
      readonly type: "polyline";
      readonly points: string;
    }
  | {
      readonly type: "circle";
      readonly cx: number;
      readonly cy: number;
      readonly r: number;
    }
  | {
      readonly type: "rect";
      readonly x: number;
      readonly y: number;
      readonly width: number;
      readonly height: number;
      readonly rx?: number;
    };

const ICON_NODES: Readonly<Record<UiIconName, readonly IconNode[]>> = {
  terrain: [
    { type: "path", d: "M3 19 9 8l3 5 3-7 6 13Z" },
    { type: "path", d: "M8 19h8" },
  ],
  roads: [
    { type: "path", d: "M9 3 7 21" },
    { type: "path", d: "m15 3 2 18" },
    { type: "line", x1: 12, y1: 5, x2: 12, y2: 8 },
    { type: "line", x1: 12, y1: 11, x2: 12, y2: 14 },
    { type: "line", x1: 12, y1: 17, x2: 12, y2: 20 },
  ],
  zones: [
    { type: "rect", x: 3, y: 3, width: 7, height: 7, rx: 1 },
    { type: "rect", x: 14, y: 3, width: 7, height: 7, rx: 1 },
    { type: "rect", x: 3, y: 14, width: 7, height: 7, rx: 1 },
    { type: "rect", x: 14, y: 14, width: 7, height: 7, rx: 1 },
  ],
  buildings: [
    { type: "path", d: "M4 21V7l5-3v17" },
    { type: "path", d: "M9 21V3l11 4v14" },
    { type: "line", x1: 12, y1: 8, x2: 12, y2: 8 },
    { type: "line", x1: 16, y1: 9, x2: 16, y2: 9 },
    { type: "line", x1: 12, y1: 13, x2: 12, y2: 13 },
    { type: "line", x1: 16, y1: 14, x2: 16, y2: 14 },
  ],
  menu: [
    { type: "line", x1: 4, y1: 6, x2: 20, y2: 6 },
    { type: "line", x1: 4, y1: 12, x2: 20, y2: 12 },
    { type: "line", x1: 4, y1: 18, x2: 20, y2: 18 },
  ],
  close: [
    { type: "line", x1: 5, y1: 5, x2: 19, y2: 19 },
    { type: "line", x1: 19, y1: 5, x2: 5, y2: 19 },
  ],
  undo: [
    { type: "path", d: "M9 7 4 12l5 5" },
    { type: "path", d: "M5 12h8a6 6 0 0 1 6 6" },
  ],
  save: [
    { type: "path", d: "M5 3h12l2 2v16H5Z" },
    { type: "rect", x: 8, y: 3, width: 7, height: 6 },
    { type: "rect", x: 8, y: 14, width: 8, height: 7, rx: 1 },
  ],
  "chevron-left": [{ type: "polyline", points: "15 18 9 12 15 6" }],
  "chevron-right": [{ type: "polyline", points: "9 18 15 12 9 6" }],
  refresh: [
    { type: "path", d: "M20 11a8 8 0 0 0-14-5L4 8" },
    { type: "polyline", points: "4 3 4 8 9 8" },
    { type: "path", d: "M4 13a8 8 0 0 0 14 5l2-2" },
    { type: "polyline", points: "20 21 20 16 15 16" },
  ],
  play: [{ type: "path", d: "m8 5 11 7-11 7Z" }],
  pause: [
    { type: "rect", x: 6, y: 5, width: 4, height: 14, rx: 1 },
    { type: "rect", x: 14, y: 5, width: 4, height: 14, rx: 1 },
  ],
  warning: [
    { type: "path", d: "M12 3 2.5 20h19Z" },
    { type: "line", x1: 12, y1: 9, x2: 12, y2: 14 },
    { type: "line", x1: 12, y1: 17, x2: 12, y2: 17 },
  ],
  info: [
    { type: "circle", cx: 12, cy: 12, r: 9 },
    { type: "line", x1: 12, y1: 11, x2: 12, y2: 17 },
    { type: "line", x1: 12, y1: 8, x2: 12, y2: 8 },
  ],
};

export function createIcon(name: UiIconName): SVGSVGElement {
  const svg = document.createElementNS(SVG_NS, "svg");
  svg.classList.add("ui-icon");
  svg.dataset.uiIcon = name;
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("fill", "none");
  svg.setAttribute("stroke", "currentColor");
  svg.setAttribute("stroke-width", "2");
  svg.setAttribute("stroke-linecap", "round");
  svg.setAttribute("stroke-linejoin", "round");
  svg.setAttribute("aria-hidden", "true");
  svg.setAttribute("focusable", "false");

  for (const node of ICON_NODES[name]) {
    const element = document.createElementNS(SVG_NS, node.type);
    for (const [key, value] of Object.entries(node)) {
      if (key === "type" || value === undefined) continue;
      element.setAttribute(key, String(value));
    }
    svg.append(element);
  }

  return svg;
}
