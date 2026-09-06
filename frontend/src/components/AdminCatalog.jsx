import React, { useEffect, useMemo, useRef, useState } from 'react'
import { deletePreset, findPreset, resetCatalog, savePreset, saveCatalog } from '../catalogStore'
import { buildCatalogTree, expandCatalog, normalizeCatalog, pathKey, validateCatalog } from '../domain/catalog'

const blankGroup = () => ({ choose_count: 1, options: [{ name: '', price_delta: 0 }] })

function blankMenu(path) {
  return { id: `menu-${Date.now()}`, name: '新しいメニュー', base_price: 0, limit: -1, path: path.length ? path : ['その他'], disabled: false, groups: [] }
}

function samePath(left, right) {
  return left.length === right.length && left.every((segment, index) => segment === right[index])
}

function startsWithPath(path, prefix) {
  return prefix.every((segment, index) => path[index] === segment)
}

function replacePrefix(path, oldPrefix, nextPrefix) {
  return [...nextPrefix, ...path.slice(oldPrefix.length)]
}

export default function AdminCatalog({ catalog, presets, onSaved, onPresetsChanged }) {
  const [draft, setDraft] = useState(() => normalizeCatalog(catalog))
  const [selection, setSelection] = useState({ type: 'folder', path: ['ランチメニュー'] })
  const [collapsed, setCollapsed] = useState({})
  const [newFolder, setNewFolder] = useState('')
  const [presetName, setPresetName] = useState('')
  const [presetId, setPresetId] = useState('')
  const [message, setMessage] = useState('')
  const fileInput = useRef(null)

  useEffect(() => setDraft(normalizeCatalog(catalog)), [catalog])

  const tree = useMemo(() => buildCatalogTree(draft), [draft])
  const selectedMenuIndex = selection.type === 'menu' ? draft.menus.findIndex(menu => menu.id === selection.id) : -1
  const menu = selectedMenuIndex >= 0 ? draft.menus[selectedMenuIndex] : null
  const selectedFolder = selection.type === 'folder' ? draft.folders.find(folder => samePath(folder.path, selection.path)) : null

  function updateDraft(mutator) {
    setDraft(current => normalizeCatalog(mutator(current)))
  }

  function updateMenu(key, value) {
    updateDraft(current => ({ ...current, menus: current.menus.map((item, index) => index === selectedMenuIndex ? { ...item, [key]: value } : item) }))
  }

  function updateGroup(groupIndex, value) {
    updateMenu('groups', menu.groups.map((group, index) => index === groupIndex ? value : group))
  }

  function updateOption(groupIndex, optionIndex, value) {
    updateGroup(groupIndex, { ...menu.groups[groupIndex], options: menu.groups[groupIndex].options.map((option, index) => index === optionIndex ? value : option) })
  }

  function addFolder() {
    const path = newFolder.split('/').map(segment => segment.trim()).filter(Boolean)
    if (!path.length) return
    updateDraft(current => ({ ...current, folders: [...current.folders, ...path.map((_, index) => ({ path: path.slice(0, index + 1), disabled: false }))] }))
    setSelection({ type: 'folder', path })
    setNewFolder('')
  }

  function toggleFolder(path) {
    updateDraft(current => ({ ...current, folders: current.folders.map(folder => samePath(folder.path, path) ? { ...folder, disabled: !folder.disabled } : folder) }))
  }

  function toggleMenu(menuId) {
    updateDraft(current => ({ ...current, menus: current.menus.map(item => item.id === menuId ? { ...item, disabled: !item.disabled } : item) }))
  }

  function renameFolder(value) {
    const nextPath = value.split('/').map(segment => segment.trim()).filter(Boolean)
    if (!selectedFolder || !nextPath.length) return
    const oldPath = selectedFolder.path
    updateDraft(current => {
      const folders = current.folders.map(folder => startsWithPath(folder.path, oldPath) ? { ...folder, path: replacePrefix(folder.path, oldPath, nextPath) } : folder)
      const menus = current.menus.map(item => startsWithPath(item.path, oldPath) ? { ...item, path: replacePrefix(item.path, oldPath, nextPath) } : item)
      return { ...current, folders, menus }
    })
    setSelection({ type: 'folder', path: nextPath })
  }

  function deleteFolder() {
    if (!selectedFolder) return
    const hasChildren = draft.menus.some(menuItem => startsWithPath(menuItem.path, selectedFolder.path)) || draft.folders.some(folder => !samePath(folder.path, selectedFolder.path) && startsWithPath(folder.path, selectedFolder.path))
    if (hasChildren) { setMessage('メニューまたは子階層がある階層は削除できません'); return }
    updateDraft(current => ({ ...current, folders: current.folders.filter(folder => !samePath(folder.path, selectedFolder.path)) }))
    setSelection({ type: 'folder', path: ['その他'] })
  }

  function addMenu() {
    const path = selection.type === 'folder' ? selection.path : (menu?.path || ['その他'])
    const next = blankMenu(path)
    updateDraft(current => ({ ...current, menus: [...current.menus, next] }))
    setSelection({ type: 'menu', id: next.id })
  }

  function addItem(value) {
    const item = value.trim()
    if (!item || draft.items.includes(item)) return
    updateDraft(current => ({ ...current, items: [...current.items, item].sort() }))
  }

  function removeItem(item) {
    if (draft.menus.some(menuItem => menuItem.groups.some(group => group.options.some(option => option.name === item)))) {
      setMessage(`「${item}」はメニューで使用中のため削除できません`)
      return
    }
    updateDraft(current => ({ ...current, items: current.items.filter(value => value !== item) }))
  }

  function save() {
    try {
      const saved = saveCatalog(draft)
      setDraft(saved)
      onSaved(saved)
      setMessage('この端末に保存しました')
    } catch (exception) { setMessage(exception.message) }
  }

  function loadPublishedCatalog() {
    if (!window.confirm('端末内の編集中カタログを破棄して、公開版を読み込みますか？必要なら先にJSONを書き出してください。')) return
    const published = resetCatalog()
    setDraft(published)
    setSelection({ type: 'folder', path: published.folders[0]?.path || ['その他'] })
    onSaved(published)
    setMessage('公開カタログを読み込みました')
  }

  function preview() {
    try { setMessage(`有効な定義から${expandCatalog(draft, 'current', false).length}件のベクトルを生成できます`) } catch (exception) { setMessage(exception.message) }
  }

  function saveCurrentPreset() {
    try {
      const saved = savePreset(presetName, draft, presetId || null)
      setPresetId(saved.id)
      setPresetName(saved.name)
      onPresetsChanged()
      setMessage(`プリセット「${saved.name}」を保存しました`)
    } catch (exception) { setMessage(exception.message) }
  }

  function loadSelectedPreset() {
    const preset = findPreset(presetId)
    if (!preset) return
    setDraft(normalizeCatalog(preset.catalog))
    setSelection({ type: 'folder', path: preset.catalog.folders[0]?.path || ['その他'] })
    setMessage(`プリセット「${preset.name}」を読み込みました。保存すると現在のカタログに反映されます`)
  }

  function removeSelectedPreset() {
    const preset = findPreset(presetId)
    if (!preset || preset.builtIn) return
    deletePreset(preset.id)
    setPresetId('')
    setPresetName('')
    onPresetsChanged()
    setMessage(`プリセット「${preset.name}」を削除しました`)
  }

  function exportCatalog() {
    const blob = new Blob([JSON.stringify(draft, null, 2)], { type: 'application/json' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = 'menu_catalog.json'
    link.click()
    URL.revokeObjectURL(link.href)
  }

  function importCatalog(event) {
    const [file] = event.target.files
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      try {
        const imported = validateCatalog(JSON.parse(reader.result))
        setDraft(imported)
        setSelection({ type: 'folder', path: imported.folders[0]?.path || ['その他'] })
        setMessage('読み込みました。保存すると端末に反映されます')
      } catch (exception) { setMessage(`カタログを読み込めません: ${exception.message}`) }
    }
    reader.readAsText(file)
    event.target.value = ''
  }

  return <div className="admin-page">
    <section className="admin-toolbar card">
      <div><p className="eyebrow">CATALOG ADMIN</p><h2>カタログ管理</h2><p className="hint">階層を整理し、有効なメニューだけを最適化に渡します。</p></div>
      <div className="admin-toolbar-actions"><button onClick={addFolder}>階層を追加</button><button onClick={addMenu}>メニューを追加</button><button className="secondary" onClick={save}>変更を保存</button></div>
    </section>
    <div className="admin-layout">
      <aside className="card catalog-explorer">
        <div className="explorer-heading"><div><strong>CATALOG</strong><span>{draft.menus.length} menus</span></div><button className="icon-button" title="全階層を展開" onClick={() => setCollapsed({})}>＋</button></div>
        <div className="folder-create"><input placeholder="階層/サブ階層" value={newFolder} onChange={event => setNewFolder(event.target.value)} onKeyDown={event => event.key === 'Enter' && addFolder()} /><button className="secondary" onClick={addFolder}>追加</button></div>
        <div className="tree-root">{tree.folders.map(folder => <TreeFolder key={pathKey(folder.path)} node={folder} collapsed={collapsed} setCollapsed={setCollapsed} selected={selection} setSelected={setSelection} toggleFolder={toggleFolder} toggleMenu={toggleMenu} />)}</div>
        <div className="vector-manager"><div className="section-label"><strong>単品ベクトル</strong><span>{draft.items.length}</span></div><form className="option-row" onSubmit={event => { event.preventDefault(); addItem(event.currentTarget.elements.item.value); event.currentTarget.reset() }}><input name="item" placeholder="単品名を追加" /><button className="secondary">追加</button></form><div className="vector-list">{draft.items.map(item => <span key={item}>{item}<button className="icon-button" onClick={() => removeItem(item)}>×</button></span>)}</div></div>
      </aside>
      <section className="card editor">{selection.type === 'folder' ? <FolderEditor folder={selectedFolder} onRename={renameFolder} onToggle={() => selectedFolder && toggleFolder(selectedFolder.path)} onDelete={deleteFolder} /> : <MenuEditor menu={menu} catalog={draft} updateMenu={updateMenu} updateGroup={updateGroup} updateOption={updateOption} setDraft={setDraft} selectedMenuIndex={selectedMenuIndex} />}
        <div className="admin-actions"><button onClick={save}>カタログを保存</button><button className="secondary" onClick={preview}>生成結果を確認</button><button className="secondary" onClick={exportCatalog}>JSONを書き出す</button><button className="secondary" onClick={() => fileInput.current?.click()}>JSONを読み込む</button><button className="secondary" onClick={loadPublishedCatalog}>公開版を読み込む</button><input ref={fileInput} type="file" accept="application/json" hidden onChange={importCatalog} />{message && <span className="hint">{message}</span>}</div>
      </section>
    </div>
    <PresetManager presets={presets} presetId={presetId} presetName={presetName} setPresetId={setPresetId} setPresetName={setPresetName} save={saveCurrentPreset} load={loadSelectedPreset} remove={removeSelectedPreset} />
  </div>
}

function TreeFolder({ node, collapsed, setCollapsed, selected, setSelected, toggleFolder, toggleMenu }) {
  const key = pathKey(node.path)
  const isCollapsed = collapsed[key] === true
  const folder = node
  return <div className="tree-folder"><div className={`tree-row folder-row ${selected.type === 'folder' && samePath(selected.path, node.path) ? 'selected' : ''}`}><button className="tree-chevron" onClick={() => setCollapsed(current => ({ ...current, [key]: !isCollapsed }))}>{isCollapsed ? '›' : '⌄'}</button><button className="tree-name" onClick={() => setSelected({ type: 'folder', path: node.path })}><span className="folder-icon">▾</span>{node.path[node.path.length - 1]}</button><button className={`tree-status ${folder?.disabled ? 'is-disabled' : ''}`} onClick={() => toggleFolder(node.path)}>{folder?.disabled ? '無効' : '有効'}</button></div>{!isCollapsed && <div className="tree-children">{node.folders.map(child => <TreeFolder key={pathKey(child.path)} node={child} collapsed={collapsed} setCollapsed={setCollapsed} selected={selected} setSelected={setSelected} toggleFolder={toggleFolder} toggleMenu={toggleMenu} />)}{node.menus.map(({ menu, effectiveDisabled }) => <div className={`tree-row menu-row ${selected.type === 'menu' && selected.id === menu.id ? 'selected' : ''} ${effectiveDisabled ? 'disabled' : ''}`} key={menu.id}><span className="menu-indent">•</span><button className="tree-name" onClick={() => setSelected({ type: 'menu', id: menu.id })}>{menu.name || '名称未設定'}</button><button className={`tree-status ${effectiveDisabled ? 'is-disabled' : ''}`} onClick={() => toggleMenu(menu.id)}>{menu.disabled ? '無効' : effectiveDisabled ? '継承無効' : '有効'}</button></div>)}</div>}</div>
}

function FolderEditor({ folder, onRename, onToggle, onDelete }) {
  if (!folder) return <div className="empty-editor"><h2>階層を選択</h2><p className="hint">左のツリーから編集する階層またはメニューを選択してください。</p></div>
  return <><div className="editor-heading"><div><p className="eyebrow">FOLDER</p><h2>階層設定</h2></div><span className={`status-badge ${folder.disabled ? 'disabled' : ''}`}>{folder.disabled ? '無効' : '有効'}</span></div><div className="form-grid single"><label>階層パス<input value={folder.path.join('/')} onChange={event => onRename(event.target.value)} /></label></div><p className="hint">上位階層を無効にすると、その配下のすべてのメニューが最適化から除外されます。</p><div className="editor-buttons"><button className="secondary" onClick={onToggle}>{folder.disabled ? 'この階層を有効化' : 'この階層を無効化'}</button><button className="danger" onClick={onDelete}>空の階層を削除</button></div></>
}

function MenuEditor({ menu, catalog, updateMenu, updateGroup, updateOption, setDraft }) {
  if (!menu) return <div className="empty-editor"><h2>メニューを選択</h2><p className="hint">左のツリーから編集するメニューを選択してください。</p></div>
  return <><div className="editor-heading"><div><p className="eyebrow">MENU VECTOR</p><h2>メニュー編集</h2></div><span className={`status-badge ${menu.disabled ? 'disabled' : ''}`}>{menu.disabled ? '無効' : '有効'}</span></div><div className="form-grid"><label>メニュー名<input value={menu.name} onChange={event => updateMenu('name', event.target.value)} /></label><label>階層パス<input value={menu.path.join('/')} onChange={event => updateMenu('path', event.target.value.split('/').map(segment => segment.trim()).filter(Boolean))} /></label><label>基本価格<input type="number" min="0" max="100000" value={menu.base_price} onChange={event => updateMenu('base_price', Number(event.target.value))} /></label><label>個数制限（無制限は-1）<input type="number" min="-1" max="100" value={menu.limit} onChange={event => updateMenu('limit', Number(event.target.value))} /></label><label>属性（カンマ区切り）<input value={menu.attributes.join(',')} placeholder="pack" onChange={event => updateMenu('attributes', event.target.value.split(',').map(value => value.trim()).filter(Boolean))} /></label><label>購入条件（いずれかの属性）<input value={menu.requires_any_attributes.join(',')} placeholder="pack" onChange={event => updateMenu('requires_any_attributes', event.target.value.split(',').map(value => value.trim()).filter(Boolean))} /></label></div><div className="groups">{menu.groups.map((group, groupIndex) => <div className="group-editor" key={groupIndex}><div className="group-heading"><h3>選択グループ {groupIndex + 1}</h3><label>選択個数<input className="small-input" type="number" min="0" max="100" value={group.choose_count} onChange={event => updateGroup(groupIndex, { ...group, choose_count: Number(event.target.value) })} /></label><button className="secondary" onClick={() => updateMenu('groups', menu.groups.filter((_, index) => index !== groupIndex))}>グループ削除</button></div>{group.options.map((option, optionIndex) => <div className="option-row" key={optionIndex}><input list="item-names" placeholder="単品ベクトル名" value={option.name} onChange={event => updateOption(groupIndex, optionIndex, { ...option, name: event.target.value })} /><input type="number" placeholder="価格差" value={option.price_delta} onChange={event => updateOption(groupIndex, optionIndex, { ...option, price_delta: Number(event.target.value) })} /><button className="secondary" onClick={() => updateGroup(groupIndex, { ...group, options: group.options.filter((_, index) => index !== optionIndex) })}>削除</button></div>)}<button className="secondary" onClick={() => updateGroup(groupIndex, { ...group, options: [...group.options, { name: '', price_delta: 0 }] })}>選択肢を追加</button></div>)}</div><button className="secondary" onClick={() => updateMenu('groups', [...menu.groups, blankGroup()])}>選択グループを追加</button><datalist id="item-names">{catalog.items.map(name => <option key={name} value={name} />)}</datalist><div className="editor-buttons"><button className="secondary" onClick={() => updateMenu('disabled', !menu.disabled)}>{menu.disabled ? 'メニューを有効化' : 'メニューを無効化'}</button><button className="danger" onClick={() => { setDraft(current => ({ ...current, menus: current.menus.filter(item => item.id !== menu.id) })); }}>メニューを削除</button></div></>
}

function PresetManager({ presets, presetId, presetName, setPresetId, setPresetName, save, load, remove }) {
  return <section className="card preset-manager"><div><p className="eyebrow">PRESETS</p><h2>プリセット</h2><p className="hint">階層の無効状態、メニュー、単品ベクトルをまとめて保存します。</p></div><div className="preset-controls"><select value={presetId} onChange={event => setPresetId(event.target.value)}><option value="">プリセットを選択</option>{presets.map(preset => <option key={preset.id} value={preset.id}>{preset.name}{preset.builtIn ? '（標準）' : ''}</option>)}</select><input placeholder="保存名（新規・上書き）" value={presetName} onChange={event => setPresetName(event.target.value)} /><button onClick={save}>この状態を保存</button><button className="secondary" disabled={!presetId} onClick={load}>読み込む</button><button className="danger" disabled={!presetId || presets.find(preset => preset.id === presetId)?.builtIn} onClick={remove}>削除</button></div></section>
}
