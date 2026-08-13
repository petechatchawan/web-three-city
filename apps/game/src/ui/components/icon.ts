const SVG_NS = 'http://www.w3.org/2000/svg';

export type CityIconName =
  | 'navigate'
  | 'terrain'
  | 'roads'
  | 'zones'
  | 'buildings'
  | 'population'
  | 'treasury'
  | 'net'
  | 'demand'
  | 'time'
  | 'info'
  | 'city'
  | 'menu'
  | 'undo'
  | 'close'
  | 'chevron-up'
  | 'chevron-down'
  | 'chevron-left'
  | 'pause'
  | 'play'
  | 'step'
  | 'raise'
  | 'lower'
  | 'flatten'
  | 'residential'
  | 'commercial'
  | 'industrial'
  | 'remove'
  | 'save'
  | 'load'
  | 'rotate-left'
  | 'rotate-right'
  | 'reset-camera'
  | 'grid'
  | 'quality'
  | 'construction'
  | 'active'
  | 'total';

const iconPaths: Readonly<Record<CityIconName, readonly string[]>> = {
  navigate: ['M12 3 19 20 12 16 5 20 12 3Z'],
  terrain: ['M3 18 8.5 10 12 14 15.5 7 21 18H3Z', 'M6 18H18'],
  roads: ['M8 21 10 3', 'M14 21 16 3', 'M12 6V9', 'M12 12V15', 'M12 18V21'],
  zones: ['M4 4H10V10H4Z', 'M14 4H20V10H14Z', 'M4 14H10V20H4Z', 'M14 14H20V20H14Z'],
  buildings: ['M5 21V7L12 3 19 7V21', 'M9 10H10', 'M14 10H15', 'M9 14H10', 'M14 14H15', 'M11 21V17H13V21'],
  population: ['M8 11A3 3 0 1 0 8 5A3 3 0 0 0 8 11Z', 'M16 10A2.5 2.5 0 1 0 16 5A2.5 2.5 0 0 0 16 10Z', 'M3 20C3 16.5 5 14 8 14C11 14 13 16.5 13 20', 'M13 14C16.8 13 20 15.2 20 19'],
  treasury: ['M4 9 12 4 20 9', 'M5 10H19', 'M6 10V18', 'M10 10V18', 'M14 10V18', 'M18 10V18', 'M4 20H20'],
  net: ['M4 17 9 12 13 15 20 7', 'M15 7H20V12'],
  demand: ['M4 18V11', 'M4 11 2 13', 'M4 11 6 13', 'M12 18V6', 'M12 6 10 8', 'M12 6 14 8', 'M20 18V13', 'M20 13 18 15', 'M20 13 22 15'],
  time: ['M7 3V6', 'M17 3V6', 'M4 8H20', 'M5 5H19V20H5Z', 'M12 11V15L15 16'],
  info: ['M12 10V18', 'M12 6H12.01', 'M12 22A10 10 0 1 0 12 2A10 10 0 0 0 12 22Z'],
  city: ['M3 21H21', 'M5 21V9H11V21', 'M13 21V4H19V21', 'M7 12H9', 'M7 15H9', 'M15 8H17', 'M15 11H17', 'M15 14H17'],
  menu: ['M5 7H19', 'M5 12H19', 'M5 17H19'],
  undo: ['M9 7 5 11 9 15', 'M5 11H14A5 5 0 0 1 19 16'],
  close: ['M6 6 18 18', 'M18 6 6 18'],
  'chevron-up': ['M6 15 12 9 18 15'],
  'chevron-down': ['M6 9 12 15 18 9'],
  'chevron-left': ['M15 5 8 12 15 19'],
  pause: ['M8 5V19', 'M16 5V19'],
  play: ['M8 5 19 12 8 19Z'],
  step: ['M6 5 15 12 6 19Z', 'M18 5V19'],
  raise: ['M12 20V5', 'M6 11 12 5 18 11', 'M5 20H19'],
  lower: ['M12 4V19', 'M6 13 12 19 18 13', 'M5 4H19'],
  flatten: ['M4 8H20', 'M4 12H20', 'M4 16H20'],
  residential: ['M4 11 12 4 20 11', 'M6 10V20H18V10', 'M10 20V14H14V20'],
  commercial: ['M5 21V5H19V21', 'M8 9H11', 'M13 9H16', 'M8 13H11', 'M13 13H16', 'M8 17H16'],
  industrial: ['M4 21V11L9 14V10L14 13V6H18V21Z', 'M7 18H9', 'M12 18H14'],
  remove: ['M6 7H18', 'M9 7V5H15V7', 'M8 7 9 20H15L16 7', 'M11 10V17', 'M13 10V17'],
  save: ['M5 4H17L20 7V20H4V4Z', 'M8 4V10H16V4', 'M8 20V14H16V20'],
  load: ['M12 4V15', 'M7 10 12 15 17 10', 'M5 20H19'],
  'rotate-left': ['M7 7H3V3', 'M4 7A9 9 0 1 1 5 18'],
  'rotate-right': ['M17 7H21V3', 'M20 7A9 9 0 1 0 19 18'],
  'reset-camera': ['M4 9 7 6H10L12 4 14 6H17L20 9V18H4Z', 'M12 16A4 4 0 1 0 12 8A4 4 0 0 0 12 16Z'],
  grid: ['M4 4H20V20H4Z', 'M4 9H20', 'M4 15H20', 'M9 4V20', 'M15 4V20'],
  quality: ['M12 3 14.8 8.7 21 9.6 16.5 14 17.6 20.2 12 17.3 6.4 20.2 7.5 14 3 9.6 9.2 8.7Z'],
  construction: ['M4 20 10 14', 'M8 6 18 16', 'M6 4 20 18', 'M14 18 18 14 20 16 16 20Z'],
  active: ['M12 21A9 9 0 1 0 12 3A9 9 0 0 0 12 21Z', 'M8 12 11 15 16 9'],
  total: ['M5 5H10V10H5Z', 'M14 5H19V10H14Z', 'M5 14H10V19H5Z', 'M14 14H19V19H14Z'],
};

export function createCityIcon(name: CityIconName): SVGSVGElement {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.classList.add('city-icon');
  svg.dataset.cityIcon = name;
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('width', '20');
  svg.setAttribute('height', '20');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '1.8');
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  for (const data of iconPaths[name]) {
    const path = document.createElementNS(SVG_NS, 'path');
    path.setAttribute('d', data);
    svg.append(path);
  }
  return svg;
}
