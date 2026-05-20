export const globalDiseaseTypesStorageKey = 'linzight-global-disease-types';
export const globalSampleTypesStorageKey = 'linzight-global-sample-types';
export const globalDetectionTypesStorageKey = 'linzight-global-detection-types';
export const globalQuantityUnitsStorageKey = 'linzight-global-quantity-units';
export const globalConfigChangedEvent = 'linzight-global-config-updated';

export const defaultDiseaseTypes = ['NPSLE', 'Non-NPSLE', 'MS', 'NMOSD', 'HC', 'NSCLC', 'LUAD', 'LUSC', 'EGFR-TKI耐药', 'ALK耐药'];
export const defaultSampleTypes = ['肿瘤FFPE', '肿瘤组织', 'CSF', '血液', '胸水'];
export const defaultDetectionTypes = ['RNA-seq', 'WES', 'scRNA-seq', '类器官构建', 'Olink'];
export const defaultQuantityUnits = ['mL', '块', '片', '管'];
const legacyDefaultDetectionTypes = ['RNA-seq', 'WES', 'scRNA-seq', 'Olink', 'IHC'];

function readList(storageKey: string, fallback: string[]) {
  if (typeof window === 'undefined') return fallback;
  try {
    const parsed = JSON.parse(window.localStorage.getItem(storageKey) ?? '[]');
    if (!Array.isArray(parsed)) return fallback;
    const values = parsed.map((item) => String(item).trim()).filter(Boolean);
    return values.length ? Array.from(new Set(values)) : fallback;
  } catch {
    return fallback;
  }
}

function writeList(storageKey: string, values: string[]) {
  if (typeof window === 'undefined') return;
  const normalized = Array.from(new Set(values.map((item) => item.trim()).filter(Boolean)));
  window.localStorage.setItem(storageKey, JSON.stringify(normalized));
  window.dispatchEvent(new window.CustomEvent(globalConfigChangedEvent));
}

export function getGlobalDiseaseTypes() {
  return readList(globalDiseaseTypesStorageKey, defaultDiseaseTypes);
}

export function getGlobalSampleTypes() {
  return readList(globalSampleTypesStorageKey, defaultSampleTypes);
}

export function getGlobalDetectionTypes() {
  const values = readList(globalDetectionTypesStorageKey, defaultDetectionTypes);
  return values.length === legacyDefaultDetectionTypes.length && values.every((item, index) => item === legacyDefaultDetectionTypes[index])
    ? defaultDetectionTypes
    : values;
}

export function getGlobalQuantityUnits() {
  return readList(globalQuantityUnitsStorageKey, defaultQuantityUnits);
}

export function saveGlobalDiseaseTypes(values: string[]) {
  writeList(globalDiseaseTypesStorageKey, values);
}

export function saveGlobalSampleTypes(values: string[]) {
  writeList(globalSampleTypesStorageKey, values);
}

export function saveGlobalDetectionTypes(values: string[]) {
  writeList(globalDetectionTypesStorageKey, values);
}

export function saveGlobalQuantityUnits(values: string[]) {
  writeList(globalQuantityUnitsStorageKey, values);
}
