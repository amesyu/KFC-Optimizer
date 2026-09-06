import React, { useState } from 'react'
import { findPreset, loadCatalog, loadPresets, saveCatalog } from './catalogStore'
import AdminCatalog from './components/AdminCatalog'
import Optimizer from './components/Optimizer'

export default function App() {
  const [catalog, setCatalog] = useState(() => loadCatalog())
  const [presets, setPresets] = useState(() => loadPresets())
  const [activePresetId, setActivePresetId] = useState('current')
  const [tab, setTab] = useState('optimizer')

  function applyPreset(id) {
    if (id === 'current') {
      setActivePresetId(id)
      return
    }
    const preset = findPreset(id)
    if (!preset) return
    const nextCatalog = saveCatalog(preset.catalog)
    setCatalog(nextCatalog)
    setActivePresetId(id)
  }

  function updateCatalog(nextCatalog) {
    setCatalog(nextCatalog)
    setActivePresetId('current')
  }

  function refreshPresets() {
    setPresets(loadPresets())
  }

  return <div className="app">
    <header className="app-header">
      <div className="brand"><p className="eyebrow">KFC / OFFLINE MENU PLANNER</p><h1>KFC Optimizer</h1></div>
      <div className="header-tools">
        <label className="preset-picker"><span>プリセット</span><select value={activePresetId} onChange={event => applyPreset(event.target.value)}><option value="current">現在のカタログ</option>{presets.map(preset => <option key={preset.id} value={preset.id}>{preset.name}{preset.builtIn ? '（標準）' : ''}</option>)}</select></label>
        <nav><button className={tab === 'optimizer' ? 'active' : ''} onClick={() => setTab('optimizer')}>最適化</button><button className={tab === 'admin' ? 'active' : ''} onClick={() => setTab('admin')}>管理画面</button></nav>
      </div>
    </header>
    <main>{tab === 'admin' ? <AdminCatalog catalog={catalog} presets={presets} onSaved={updateCatalog} onPresetsChanged={refreshPresets} /> : <Optimizer catalog={catalog} />}</main>
  </div>
}
