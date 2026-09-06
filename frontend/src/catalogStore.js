import bundledCatalog from '../../config/menu_catalog.json'
import { normalizeCatalog, pathKey, validateCatalog } from './domain/catalog'

const CATALOG_STORAGE_KEY = 'kfc-optimizer-catalog-v3'
const PRESET_STORAGE_KEY = 'kfc-optimizer-presets-v1'

function clone(value) {
  return JSON.parse(JSON.stringify(value))
}

function defaultPresetCatalog(kind) {
  const catalog = normalizeCatalog(bundledCatalog)
  return validateCatalog({
    ...catalog,
    folders: catalog.folders.map(folder => ({
      ...folder,
      disabled: kind === 'dinner' && folder.path[0] === 'ランチメニュー',
    })),
  })
}

export function getDefaultPresets() {
  return [
    { id: 'default-lunch', name: 'ランチメニュー', builtIn: true, catalog: defaultPresetCatalog('lunch') },
    { id: 'default-dinner', name: 'ディナーメニュー', builtIn: true, catalog: defaultPresetCatalog('dinner') },
  ]
}

export function loadCatalog() {
  try {
    const saved = localStorage.getItem(CATALOG_STORAGE_KEY)
    return validateCatalog(saved ? JSON.parse(saved) : bundledCatalog)
  } catch {
    return validateCatalog(bundledCatalog)
  }
}

export function saveCatalog(input) {
  const catalog = validateCatalog(input)
  localStorage.setItem(CATALOG_STORAGE_KEY, JSON.stringify(catalog))
  return catalog
}

export function resetCatalog() {
  localStorage.removeItem(CATALOG_STORAGE_KEY)
  return validateCatalog(bundledCatalog)
}

export function loadPresets() {
  const defaults = getDefaultPresets()
  try {
    const stored = JSON.parse(localStorage.getItem(PRESET_STORAGE_KEY) || '[]')
    if (!Array.isArray(stored)) return defaults
    const custom = stored.map(preset => ({
      id: String(preset.id),
      name: String(preset.name).trim(),
      builtIn: false,
      catalog: validateCatalog(preset.catalog),
    })).filter(preset => preset.name)
    return [...defaults, ...custom]
  } catch {
    return defaults
  }
}

export function savePreset(name, input, existingId = null) {
  const presetName = String(name).trim()
  if (!presetName) throw new Error('プリセット名を入力してください')
  const catalog = validateCatalog(input)
  const custom = loadPresets().filter(preset => !preset.builtIn && preset.id !== existingId).map(preset => ({ id: preset.id, name: preset.name, catalog: preset.catalog }))
  const preset = { id: existingId || `preset-${Date.now()}`, name: presetName, catalog }
  const next = [...custom.filter(item => item.name !== presetName), preset]
  localStorage.setItem(PRESET_STORAGE_KEY, JSON.stringify(next))
  return { ...preset, builtIn: false }
}

export function deletePreset(id) {
  const next = loadPresets().filter(preset => !preset.builtIn && preset.id !== id).map(preset => ({ id: preset.id, name: preset.name, catalog: preset.catalog }))
  localStorage.setItem(PRESET_STORAGE_KEY, JSON.stringify(next))
}

export function findPreset(id) {
  return loadPresets().find(preset => preset.id === id) || null
}

export function folderState(catalog, path) {
  return catalog.folders.find(folder => pathKey(folder.path) === pathKey(path))
}
