export type UiLocale = 'en' | 'th';

export type UiCopyKey =
  | 'build'
  | 'city'
  | 'terrain'
  | 'roads'
  | 'zones'
  | 'buildings'
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
  | 'closeInspect';

const copy: Readonly<Record<UiLocale, Readonly<Record<UiCopyKey, string>>>> = Object.freeze({
  en: Object.freeze({
    build: 'Build',
    city: 'City',
    terrain: 'Terrain',
    roads: 'Roads',
    zones: 'Zones',
    buildings: 'Buildings',
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
  }),
  th: Object.freeze({
    build: 'สร้าง',
    city: 'เมือง',
    terrain: 'ภูมิประเทศ',
    roads: 'ถนน',
    zones: 'โซน',
    buildings: 'อาคาร',
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
  }),
});

const STORAGE_KEY = 'web-three-city.ui-locale';

export function uiText(locale: UiLocale, key: UiCopyKey): string {
  return copy[locale][key];
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
