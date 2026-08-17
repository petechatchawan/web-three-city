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
  | 'citizen'
  | 'vehicle'
  | 'expandInspect'
  | 'collapseInspect'
  | 'closeInspect'
  | 'simulationSpeed'
  | 'pause'
  | 'play'
  | 'stepOneTick'
  | 'gameMenu'
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
  | 'informationViewTraffic'
  | 'deactivateView'
  | 'trafficFree'
  | 'trafficModerate'
  | 'trafficHeavy'
  | 'trafficCongested'
  | 'inspectFieldCell'
  | 'inspectFieldHeight'
  | 'inspectFieldWater'
  | 'inspectFieldOccupancy'
  | 'inspectFieldZone'
  | 'inspectFieldCapacity'
  | 'inspectFieldDevelopment'
  | 'inspectFieldRoadAccess'
  | 'inspectFieldConnected'
  | 'inspectFieldRoadAdjacency'
  | 'inspectFieldCitizenId'
  | 'inspectFieldHousehold'
  | 'inspectFieldHome'
  | 'inspectFieldWork'
  | 'inspectFieldActivity'
  | 'inspectFieldTripId'
  | 'inspectFieldTripPurpose'
  | 'inspectFieldTravelMode'
  | 'inspectFieldDestination'
  | 'inspectFieldOrigin'
  | 'inspectFieldTravelState'
  | 'inspectFieldEta'
  | 'inspectFieldCurrentRoad'
  | 'inspectFieldCongestion';

type LocalizedCopy = readonly [english: string, thai: string];

const copy = {
  build: ['Build', 'สร้าง'],
  city: ['City', 'เมือง'],
  terrain: ['Terrain', 'ภูมิประเทศ'],
  roads: ['Roads', 'ถนน'],
  zones: ['Zones', 'โซน'],
  buildings: ['Buildings', 'อาคาร'],
  navigate: ['Navigate', 'สำรวจ'],
  raise: ['Raise', 'ยกพื้น'],
  lower: ['Lower', 'ลดพื้น'],
  flatten: ['Flatten', 'ปรับระดับ'],
  buildRoad: ['Build Road', 'สร้างถนน'],
  bulldozeRoad: ['Bulldoze Road', 'รื้อถนน'],
  residential: ['Residential', 'ที่อยู่อาศัย'],
  commercial: ['Commercial', 'พาณิชย์'],
  industrial: ['Industrial', 'อุตสาหกรรม'],
  removeZone: ['Remove Zone', 'ลบโซน'],
  bulldozeBuilding: ['Bulldoze Building', 'รื้ออาคาร'],
  toolReady: ['Tool ready', 'พร้อมใช้งาน'],
  language: ['Language', 'ภาษา'],
  english: ['English', 'English'],
  thai: ['ไทย', 'ไทย'],
  inspect: ['Inspect', 'ตรวจสอบ'],
  citizen: ['Citizen', 'ประชาชน'],
  vehicle: ['Vehicle', 'รถยนต์'],
  expandInspect: ['Expand Inspect', 'ขยายข้อมูล'],
  collapseInspect: ['Collapse Inspect', 'ย่อข้อมูล'],
  closeInspect: ['Close Inspect', 'ปิดข้อมูล'],
  simulationSpeed: ['Simulation speed', 'ความเร็วการจำลอง'],
  pause: ['Pause', 'หยุดชั่วคราว'],
  play: ['Play', 'เล่น'],
  stepOneTick: ['Advance exactly one tick', 'เดินหน้า 1 ติ๊ก'],
  gameMenu: ['Game Menu', 'เมนูเกม'],
  world: ['World', 'โลก'],
  saveWorld: ['Save world', 'บันทึกเมือง'],
  loadWorld: ['Load world', 'โหลดเมือง'],
  camera: ['Camera', 'กล้อง'],
  rotateLeft: ['Rotate left', 'หมุนซ้าย'],
  rotateRight: ['Rotate right', 'หมุนขวา'],
  resetCamera: ['Reset camera', 'รีเซ็ตกล้อง'],
  grid: ['Grid', 'กริด'],
  presentation: ['Presentation', 'การแสดงผล'],
  quality: ['Quality', 'คุณภาพ'],
  informationViewTraffic: ['Traffic', 'การจราจร'],
  deactivateView: ['Deactivate view', 'ปิดมุมมองข้อมูล'],
  trafficFree: ['Free flow', 'คล่องตัว'],
  trafficModerate: ['Moderate', 'ปานกลาง'],
  trafficHeavy: ['Heavy', 'หนาแน่น'],
  trafficCongested: ['Congested', 'ติดขัด'],
  inspectFieldCell: ['Cell', 'ช่อง'],
  inspectFieldHeight: ['Height', 'ความสูง'],
  inspectFieldWater: ['Water', 'น้ำ'],
  inspectFieldOccupancy: ['Occupancy', 'การใช้งานพื้นที่'],
  inspectFieldZone: ['Zone', 'โซน'],
  inspectFieldCapacity: ['Capacity', 'ความจุ'],
  inspectFieldDevelopment: ['Development', 'การพัฒนา'],
  inspectFieldRoadAccess: ['Road access', 'การเข้าถึงถนน'],
  inspectFieldConnected: ['Connected', 'การเชื่อมต่อ'],
  inspectFieldRoadAdjacency: ['Road adjacency', 'ติดถนน'],
  inspectFieldCitizenId: ['Citizen ID', 'รหัสประชาชน'],
  inspectFieldHousehold: ['Household', 'ครัวเรือน'],
  inspectFieldHome: ['Home', 'บ้าน'],
  inspectFieldWork: ['Work', 'ที่ทำงาน'],
  inspectFieldActivity: ['Activity', 'กิจกรรม'],
  inspectFieldTripId: ['Trip ID', 'รหัสการเดินทาง'],
  inspectFieldTripPurpose: ['Trip purpose', 'จุดประสงค์การเดินทาง'],
  inspectFieldTravelMode: ['Travel mode', 'รูปแบบการเดินทาง'],
  inspectFieldDestination: ['Destination', 'ปลายทาง'],
  inspectFieldOrigin: ['Origin', 'ต้นทาง'],
  inspectFieldTravelState: ['Travel state', 'สถานะการเดินทาง'],
  inspectFieldEta: ['ETA', 'เวลาถึงโดยประมาณ'],
  inspectFieldCurrentRoad: ['Current road', 'ถนนปัจจุบัน'],
  inspectFieldCongestion: ['Congestion', 'ความหนาแน่นจราจร'],
} as const satisfies Readonly<Record<UiCopyKey, LocalizedCopy>>;

const localeIndex: Readonly<Record<UiLocale, 0 | 1>> = Object.freeze({ en: 0, th: 1 });

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
  'Citizen ID': 'inspectFieldCitizenId',
  Household: 'inspectFieldHousehold',
  Home: 'inspectFieldHome',
  Work: 'inspectFieldWork',
  Activity: 'inspectFieldActivity',
  'Trip ID': 'inspectFieldTripId',
  'Trip purpose': 'inspectFieldTripPurpose',
  'Travel mode': 'inspectFieldTravelMode',
  Destination: 'inspectFieldDestination',
  Origin: 'inspectFieldOrigin',
  'Travel state': 'inspectFieldTravelState',
  ETA: 'inspectFieldEta',
  'Current road': 'inspectFieldCurrentRoad',
  Congestion: 'inspectFieldCongestion',
});

const inspectTitleKeys: Readonly<Record<string, UiCopyKey>> = Object.freeze({
  Citizen: 'citizen',
  Vehicle: 'vehicle',
});

const STORAGE_KEY = 'web-three-city.ui-locale';

export function uiText(locale: UiLocale, key: UiCopyKey): string {
  return copy[key][localeIndex[locale]];
}

export function localizeInspectFieldLabel(locale: UiLocale, label: string): string {
  const key = inspectFieldKeys[label];
  return key === undefined ? label : uiText(locale, key);
}

export function localizeInspectTitle(locale: UiLocale, title: string): string {
  const key = inspectTitleKeys[title];
  return key === undefined ? title : uiText(locale, key);
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
