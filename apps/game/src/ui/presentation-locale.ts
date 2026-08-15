export type UiLocale = 'en' | 'th';

export type UiCopyKey =
  | 'build'
  | 'city'
  | 'terrain'
  | 'roads'
  | 'zones'
  | 'buildings'
  | 'navigate'
  | 'raise'
  | 'lower'
  | 'flatten'
  | 'buildRoad'
  | 'bulldozeRoad'
  | 'residential'
  | 'commercial'
  | 'industrial'
  | 'removeZone'
  | 'bulldozeBuilding'
  | 'toolReady'
  | 'language'
  | 'english'
  | 'thai'
  | 'inspect'
  | 'expandInspect'
  | 'collapseInspect'
  | 'closeInspect'
  | 'simulationSpeed'
  | 'pause'
  | 'play'
  | 'stepOneTick'
  | 'world'
  | 'saveWorld'
  | 'loadWorld'
  | 'camera'
  | 'rotateLeft'
  | 'rotateRight'
  | 'resetCamera'
  | 'grid'
  | 'presentation'
  | 'quality'
  | 'inspectFieldCell'
  | 'inspectFieldHeight'
  | 'inspectFieldWater'
  | 'inspectFieldOccupancy'
  | 'inspectFieldZone'
  | 'inspectFieldCapacity'
  | 'inspectFieldDevelopment'
  | 'inspectFieldRoadAccess'
  | 'inspectFieldConnected'
  | 'inspectFieldRoadAdjacency';

const copy: Readonly<Record<UiLocale, Readonly<Record<UiCopyKey, string>>>> = Object.freeze({
  en: Object.freeze({
    build: 'Build',
    city: 'City',
    terrain: 'Terrain',
    roads: 'Roads',
    zones: 'Zones',
    buildings: 'Buildings',
    navigate: 'Navigate',
    raise: 'Raise',
    lower: 'Lower',
    flatten: 'Flatten',
    buildRoad: 'Build Road',
    bulldozeRoad: 'Bulldoze Road',
    residential: 'Residential',
    commercial: 'Commercial',
    industrial: 'Industrial',
    removeZone: 'Remove Zone',
    bulldozeBuilding: 'Bulldoze Building',
    toolReady: 'Tool ready',
    language: 'Language',
    english: 'English',
    thai: 'ไทย',
    inspect: 'Inspect',
    expandInspect: 'Expand Inspect',
    collapseInspect: 'Collapse Inspect',
    closeInspect: 'Close Inspect',
    simulationSpeed: 'Simulation speed',
    pause: 'Pause',
    play: 'Play',
    stepOneTick: 'Advance exactly one tick',
    world: 'World',
    saveWorld: 'Save world',
    loadWorld: 'Load world',
    camera: 'Camera',
    rotateLeft: 'Rotate left',
    rotateRight: 'Rotate right',
    resetCamera: 'Reset camera',
    grid: 'Grid',
    presentation: 'Presentation',
    quality: 'Quality',
    inspectFieldCell: 'Cell',
    inspectFieldHeight: 'Height',
    inspectFieldWater: 'Water',
    inspectFieldOccupancy: 'Occupancy',
    inspectFieldZone: 'Zone',
    inspectFieldCapacity: 'Capacity',
    inspectFieldDevelopment: 'Development',
    inspectFieldRoadAccess: 'Road access',
    inspectFieldConnected: 'Connected',
    inspectFieldRoadAdjacency: 'Road adjacency',
  }),
  th: Object.freeze({
    build: 'สร้าง',
    city: 'เมือง',
    terrain: 'ภูมิประเทศ',
    roads: 'ถนน',
    zones: 'โซน',
    buildings: 'อาคาร',
    navigate: 'สำรวจ',
    raise: 'ยกพื้น',
    lower: 'ลดพื้น',
    flatten: 'ปรับระดับ',
    buildRoad: 'สร้างถนน',
    bulldozeRoad: 'รื้อถนน',
    residential: 'ที่อยู่อาศัย',
    commercial: 'พาณิชย์',
    industrial: 'อุตสาหกรรม',
    removeZone: 'ลบโซน',
    bulldozeBuilding: 'รื้ออาคาร',
    toolReady: 'พร้อมใช้งาน',
    language: 'ภาษา',
    english: 'English',
    thai: 'ไทย',
    inspect: 'ตรวจสอบ',
    expandInspect: 'ขยายข้อมูล',
    collapseInspect: 'ย่อข้อมูล',
    closeInspect: 'ปิดข้อมูล',
    simulationSpeed: 'ความเร็วการจำลอง',
    pause: 'หยุดชั่วคราว',
    play: 'เล่น',
    stepOneTick: 'เดินหน้า 1 ติ๊ก',
    world: 'โลก',
    saveWorld: 'บันทึกเมือง',
    loadWorld: 'โหลดเมือง',
    camera: 'กล้อง',
    rotateLeft: 'หมุนซ้าย',
    rotateRight: 'หมุนขวา',
    resetCamera: 'รีเซ็ตกล้อง',
    grid: 'กริด',
    presentation: 'การแสดงผล',
    quality: 'คุณภาพ',
    inspectFieldCell: 'ช่อง',
    inspectFieldHeight: 'ความสูง',
    inspectFieldWater: 'น้ำ',
    inspectFieldOccupancy: 'การใช้งานพื้นที่',
    inspectFieldZone: 'โซน',
    inspectFieldCapacity: 'ความจุ',
    inspectFieldDevelopment: 'การพัฒนา',
    inspectFieldRoadAccess: 'การเข้าถึงถนน',
    inspectFieldConnected: 'การเชื่อมต่อ',
    inspectFieldRoadAdjacency: 'ติดถนน',
  }),
});

const inspectFieldKeys: Readonly<Record<string, UiCopyKey>> = Object.freeze({
  Cell: 'inspectFieldCell',
  Height: 'inspectFieldHeight',
  Water: 'inspectFieldWater',
  Occupancy: 'inspectFieldOccupancy',
  Zone: 'inspectFieldZone',
  Capacity: 'inspectFieldCapacity',
  Development: 'inspectFieldDevelopment',
  'Road access': 'inspectFieldRoadAccess',
  Connected: 'inspectFieldConnected',
  'Road adjacency': 'inspectFieldRoadAdjacency',
});

const STORAGE_KEY = 'web-three-city.ui-locale';

export function uiText(locale: UiLocale, key: UiCopyKey): string {
  return copy[locale][key];
}

export function localizeInspectFieldLabel(locale: UiLocale, label: string): string {
  const key = inspectFieldKeys[label];
  return key === undefined ? label : uiText(locale, key);
}

export function readStoredUiLocale(): UiLocale {
  try {
    const value = globalThis.localStorage?.getItem(STORAGE_KEY);
    return value === 'th' ? 'th' : 'en';
  } catch {
    return 'en';
  }
}

export function persistUiLocale(locale: UiLocale): void {
  try {
    globalThis.localStorage?.setItem(STORAGE_KEY, locale);
  } catch {
    // Storage can be unavailable in hardened/private browser contexts. Locale remains session-local.
  }
}
