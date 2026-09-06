import React, { useEffect, useMemo, useRef, useState } from 'react'
import { deletePreset, findPreset, resetCatalog, savePreset, saveCatalog } from '../catalogStore'
import {
  buildCatalogTree,
  expandCatalog,
  isMenuEnabled,
  isPathDisabled,
  normalizeCatalog,
  POTATO_OPTION_NAMES,
  POTATO_VECTOR_NAME,
  pathKey,
  validateCatalog,
} from '../domain/catalog'

const blankGroup = () => ({ choose_count: 1, options: [{ name: '', quantity: 1, price_delta: 0 }] })

function blankMenu(path) {
  return {
    id: `menu-${Date.now()}`,
    name: '新しいメニュー',
    base_price: 0,
    limit: -1,
    path: path.length ? path : ['その他'],
    disabled: false,
    groups: [],
  }
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

function collapseAllFolders(tree) {
  const collapsed = {}
  function visit(node) {
    node.folders.forEach(folder => {
      collapsed[pathKey(folder.path)] = true
      visit(folder)
    })
  }
  visit(tree)
  return collapsed
}

function folderDropMode(element, clientY) {
  const { top, height } = element.getBoundingClientRect()
  const relativeY = (clientY - top) / height
  if (relativeY < 0.25) return 'before'
  if (relativeY > 0.75) return 'after'
  return 'inside'
}

export default function AdminCatalog({ catalog, presets, onSaved, onPresetsChanged }) {
  const [draft, setDraft] = useState(() => normalizeCatalog(catalog))
  const [selection, setSelection] = useState({ type: 'folder', path: ['ランチメニュー'] })
  const [collapsed, setCollapsed] = useState(() => collapseAllFolders(buildCatalogTree(catalog)))
  const [dragging, setDragging] = useState(null)
  const [dropTarget, setDropTarget] = useState(null)
  const [newFolder, setNewFolder] = useState('')
  const [presetName, setPresetName] = useState('')
  const [presetId, setPresetId] = useState('')
  const [message, setMessage] = useState('')
  const fileInput = useRef(null)

  useEffect(() => {
    const nextCatalog = normalizeCatalog(catalog)
    setDraft(nextCatalog)
    setCollapsed(collapseAllFolders(buildCatalogTree(nextCatalog)))
  }, [catalog])

  const tree = useMemo(() => buildCatalogTree(draft), [draft])
  const selectedMenuIndex = selection.type === 'menu' ? draft.menus.findIndex(menu => menu.id === selection.id) : -1
  const menu = selectedMenuIndex >= 0 ? draft.menus[selectedMenuIndex] : null
  const selectedItem = selection.type === 'item' && draft.items.includes(selection.name) ? selection.name : null
  const selectedFolder = selection.type === 'folder'
    ? draft.folders.find(folder => samePath(folder.path, selection.path))
    : null
  const selectedFolderInheritedDisabled = selectedFolder
    ? isPathDisabled(draft, selectedFolder.path.slice(0, -1))
    : false

  function updateDraft(mutator) {
    setDraft(current => normalizeCatalog(mutator(current)))
  }

  function updateMenu(key, value) {
    updateDraft(current => ({
      ...current,
      menus: current.menus.map((item, index) => (
        index === selectedMenuIndex ? { ...item, [key]: value } : item
      )),
    }))
  }

  function updateGroup(groupIndex, value) {
    updateMenu('groups', menu.groups.map((group, index) => (
      index === groupIndex ? value : group
    )))
  }

  function updateOption(groupIndex, optionIndex, value) {
    updateGroup(groupIndex, {
      ...menu.groups[groupIndex],
      options: menu.groups[groupIndex].options.map((option, index) => (
        index === optionIndex ? value : option
      )),
    })
  }

  function startDrag(event, source) {
    setDragging(source)
    setDropTarget(null)
    event.dataTransfer.effectAllowed = 'move'
    event.dataTransfer.setData('text/plain', JSON.stringify(source))
  }

  function endDrag() {
    setDragging(null)
    setDropTarget(null)
  }

  function dragOver(event, target) {
    event.preventDefault()
    event.stopPropagation()
    if (event.dataTransfer) event.dataTransfer.dropEffect = 'move'
    setDropTarget(target)
  }

  function targetAtPoint(event) {
    const element = document.elementFromPoint(event.clientX, event.clientY)
    const target = element?.closest('[data-drop-type]')
    if (!target) return null
    if (target.dataset.dropType === 'root') return { type: 'root' }
    if (target.dataset.dropType === 'menu') return { type: 'menu', id: target.dataset.dropId }
    if (target.dataset.dropType === 'folder-position') {
      try {
        return { type: 'folder-position', path: JSON.parse(target.dataset.dropPath), mode: target.dataset.dropMode }
      } catch {
        return null
      }
    }
    try {
      return { type: 'folder', path: JSON.parse(target.dataset.dropPath) }
    } catch {
      return null
    }
  }

  function startPointerDrag(event, source) {
    if (event.pointerType === 'mouse') return
    event.preventDefault()
    event.currentTarget.setPointerCapture(event.pointerId)
    event.currentTarget.dataset.pointerDragging = 'true'
    setDragging(source)
    setDropTarget(null)
  }

  function movePointerDrag(event) {
    if (event.pointerType === 'mouse' || event.currentTarget.dataset.pointerDragging !== 'true') return
    event.preventDefault()
    const target = targetAtPoint(event)
    if (target) setDropTarget(target)
  }

  function finishPointerDrag(event) {
    if (event.pointerType === 'mouse' || event.currentTarget.dataset.pointerDragging !== 'true') return
    event.preventDefault()
    event.currentTarget.dataset.pointerDragging = 'false'
    const target = targetAtPoint(event)
    if (target) drop(event, target)
    else endDrag()
  }

  function cancelPointerDrag(event) {
    if (event.pointerType === 'mouse') return
    event.currentTarget.dataset.pointerDragging = 'false'
    endDrag()
  }

  function readDragSource(event) {
    if (dragging) return dragging
    try {
      return JSON.parse(event.dataTransfer.getData('text/plain'))
    } catch {
      return null
    }
  }

  function moveFolder(sourcePath, destinationPath, mode = 'inside') {
    const source = draft.folders.find(folder => samePath(folder.path, sourcePath))
    if (!source) return
    if (samePath(sourcePath, destinationPath) || startsWithPath(destinationPath, sourcePath)) {
      setMessage('フォルダーを自分自身の中へ移動することはできません')
      return
    }
    if (mode !== 'inside' && startsWithPath(destinationPath, sourcePath)) {
      setMessage('フォルダーを自分自身の中へ移動することはできません')
      return
    }
    const parentPath = mode === 'inside' ? destinationPath : destinationPath.slice(0, -1)
    const nextPath = [...parentPath, sourcePath[sourcePath.length - 1]]
    if (mode === 'inside' && samePath(nextPath, sourcePath)) return
    if (draft.folders.some(folder => !startsWithPath(folder.path, sourcePath) && samePath(folder.path, nextPath))) {
      setMessage(`移動先に「${nextPath[nextPath.length - 1]}」フォルダーが既にあります`)
      return
    }
    updateDraft(current => ({
      ...current,
      folders: (() => {
        const moved = current.folders
          .filter(folder => startsWithPath(folder.path, sourcePath))
          .map(folder => ({ ...folder, path: replacePrefix(folder.path, sourcePath, nextPath) }))
        const remaining = current.folders.filter(folder => !startsWithPath(folder.path, sourcePath))
        let insertionIndex = remaining.length
        if (mode === 'inside' && destinationPath.length) {
          const targetIndexes = remaining
            .map((folder, index) => startsWithPath(folder.path, destinationPath) ? index : -1)
            .filter(index => index >= 0)
          insertionIndex = (targetIndexes.at(-1) ?? -1) + 1
        } else if (mode !== 'inside') {
          const targetIndex = remaining.findIndex(folder => samePath(folder.path, destinationPath))
          if (targetIndex >= 0) {
            insertionIndex = mode === 'before'
              ? targetIndex
              : remaining.reduce((last, folder, index) => startsWithPath(folder.path, destinationPath) ? index : last, targetIndex) + 1
          }
        }
        remaining.splice(insertionIndex, 0, ...moved)
        return remaining
      })(),
      menus: current.menus.map(menuItem => (
        startsWithPath(menuItem.path, sourcePath)
          ? { ...menuItem, path: replacePrefix(menuItem.path, sourcePath, nextPath) }
          : menuItem
      )),
    }))
    setSelection(current => current.type === 'folder' && startsWithPath(current.path, sourcePath)
      ? { ...current, path: replacePrefix(current.path, sourcePath, nextPath) }
      : current)
    const expandedPath = mode === 'inside' ? destinationPath : parentPath
    if (expandedPath.length) setCollapsed(current => ({ ...current, [pathKey(expandedPath)]: false }))
    setMessage(mode === 'inside'
      ? `フォルダーを「${destinationPath.join('/')}」へ移動しました`
      : `フォルダーを同じ階層内で${mode === 'before' ? '前' : '後'}へ移動しました`)
  }

  function moveMenuToFolder(menuId, destinationPath) {
    const source = draft.menus.find(menuItem => menuItem.id === menuId)
    if (!source || samePath(source.path, destinationPath)) return
    if (!draft.folders.some(folder => samePath(folder.path, destinationPath))) {
      setMessage('移動先のフォルダーが見つかりません')
      return
    }
    updateDraft(current => ({
      ...current,
      menus: current.menus.map(menuItem => menuItem.id === menuId ? { ...menuItem, path: destinationPath } : menuItem),
    }))
    setCollapsed(current => ({ ...current, [pathKey(destinationPath)]: false }))
    setMessage(`メニューを「${destinationPath.join('/')}」へ移動しました`)
  }

  function moveMenuBefore(menuId, targetMenuId) {
    if (menuId === targetMenuId) return
    const source = draft.menus.find(menuItem => menuItem.id === menuId)
    const target = draft.menus.find(menuItem => menuItem.id === targetMenuId)
    if (!source || !target) return
    const remaining = draft.menus.filter(menuItem => menuItem.id !== menuId)
    const targetIndex = remaining.findIndex(menuItem => menuItem.id === targetMenuId)
    remaining.splice(targetIndex, 0, { ...source, path: target.path })
    updateDraft(current => ({ ...current, menus: remaining }))
    setMessage(`メニューを「${target.name}」の前へ移動しました`)
  }

  function drop(event, target) {
    event.preventDefault()
    event.stopPropagation()
    const source = readDragSource(event)
    setDropTarget(null)
    if (!source) return
    if (target.type === 'root') {
      if (source.type === 'folder') moveFolder(source.path, [])
      else setMessage('メニューはフォルダーへドロップしてください')
    } else if (target.type === 'folder') {
      if (source.type === 'folder') moveFolder(source.path, target.path, target.mode || 'inside')
      else moveMenuToFolder(source.id, target.path)
    } else if (target.type === 'folder-position') {
      if (source.type === 'folder') moveFolder(source.path, target.path, target.mode)
      else setMessage('メニューはフォルダーへドロップしてください')
    } else if (source.type === 'menu') {
      moveMenuBefore(source.id, target.id)
    } else {
      moveFolder(source.path, target.path.slice(0, -1))
    }
    setDragging(null)
  }

  function addFolder() {
    const enteredPath = newFolder.split('/').map(segment => segment.trim()).filter(Boolean)
    const parentPath = selection.type === 'folder' ? selection.path : (menu?.path || [])
    const path = startsWithPath(enteredPath, parentPath)
      ? enteredPath
      : [...parentPath, ...enteredPath]
    if (!path.length) return
    updateDraft(current => ({
      ...current,
      folders: [
        ...current.folders,
        ...path.map((_, index) => ({ path: path.slice(0, index + 1), disabled: false })),
      ],
    }))
    setSelection({ type: 'folder', path })
    if (parentPath.length) setCollapsed(current => ({ ...current, [pathKey(parentPath)]: false }))
    setNewFolder('')
  }

  function toggleFolder(path) {
    updateDraft(current => ({
      ...current,
      folders: current.folders.map(folder => (
        samePath(folder.path, path) ? { ...folder, disabled: !folder.disabled } : folder
      )),
    }))
  }

  function toggleMenu(menuId) {
    updateDraft(current => ({
      ...current,
      menus: current.menus.map(item => (
        item.id === menuId ? { ...item, disabled: !item.disabled } : item
      )),
    }))
  }

  function renameFolder(value) {
    const nextPath = value.split('/').map(segment => segment.trim()).filter(Boolean)
    if (!selectedFolder || !nextPath.length) return
    const oldPath = selectedFolder.path
    updateDraft(current => ({
      ...current,
      folders: current.folders.map(folder => (
        startsWithPath(folder.path, oldPath)
          ? { ...folder, path: replacePrefix(folder.path, oldPath, nextPath) }
          : folder
      )),
      menus: current.menus.map(item => (
        startsWithPath(item.path, oldPath)
          ? { ...item, path: replacePrefix(item.path, oldPath, nextPath) }
          : item
      )),
    }))
    setSelection({ type: 'folder', path: nextPath })
  }

  function deleteFolder() {
    if (!selectedFolder) return
    const hasChildren = draft.menus.some(menuItem => startsWithPath(menuItem.path, selectedFolder.path))
      || draft.folders.some(folder => !samePath(folder.path, selectedFolder.path) && startsWithPath(folder.path, selectedFolder.path))
    if (hasChildren) {
      setMessage('メニューまたは子フォルダーがあるフォルダーは削除できません')
      return
    }
    updateDraft(current => ({
      ...current,
      folders: current.folders.filter(folder => !samePath(folder.path, selectedFolder.path)),
    }))
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
    updateDraft(current => ({
      ...current,
      items: [...current.items, item],
      item_prices: { ...current.item_prices, [item]: null },
      item_quantities: { ...current.item_quantities, [item]: 1 },
    }))
    setSelection({ type: 'item', name: item })
  }

  function removeItem(item) {
    const inUse = draft.menus.some(menuItem => menuItem.groups.some(group => (
      group.options.some(option => option.name === item)
    )))
    if (inUse) {
      setMessage(`「${item}」はメニューで使用中のため削除できません`)
      return
    }
    updateDraft(current => ({
      ...current,
      items: current.items.filter(value => value !== item),
      disabled_items: current.disabled_items.filter(value => value !== item),
      item_prices: Object.fromEntries(Object.entries(current.item_prices).filter(([name]) => name !== item)),
      item_quantities: Object.fromEntries(Object.entries(current.item_quantities).filter(([name]) => name !== item)),
      item_parents: Object.fromEntries(Object.entries(current.item_parents).filter(([name]) => name !== item)),
    }))
    if (selection.type === 'item' && selection.name === item) setSelection({ type: 'folder', path: ['その他'] })
  }

  function renameItem(value) {
    const nextName = value.trim()
    if (!selectedItem || !nextName || nextName === selectedItem) return
    if (draft.items.includes(nextName)) {
      setMessage(`「${nextName}」は既に登録されています`)
      return
    }
    updateDraft(current => {
      const nextPrices = { ...current.item_prices, [nextName]: current.item_prices[selectedItem] ?? null }
      delete nextPrices[selectedItem]
      const nextQuantities = { ...current.item_quantities, [nextName]: current.item_quantities[selectedItem] ?? 1 }
      delete nextQuantities[selectedItem]
      const nextParents = { ...current.item_parents, [nextName]: current.item_parents[selectedItem] }
      delete nextParents[selectedItem]
      Object.entries(nextParents).forEach(([item, parent]) => {
        if (parent === selectedItem) nextParents[item] = nextName
      })
      return {
        ...current,
        items: current.items.map(item => item === selectedItem ? nextName : item),
        disabled_items: current.disabled_items.map(item => item === selectedItem ? nextName : item),
        item_prices: nextPrices,
        item_quantities: nextQuantities,
        item_parents: nextParents,
        menus: current.menus.map(menuItem => ({
          ...menuItem,
          groups: menuItem.groups.map(group => ({
            ...group,
            options: group.options.map(option => option.name === selectedItem ? { ...option, name: nextName } : option),
          })),
        })),
      }
    })
    setSelection({ type: 'item', name: nextName })
  }

  function updateItemPrice(value) {
    if (!selectedItem) return
    const price = value === '' ? null : Number(value)
    if (price !== null && (!Number.isInteger(price) || price < 0 || price > 100000)) return
    updateDraft(current => ({
      ...current,
      item_prices: { ...current.item_prices, [selectedItem]: price },
    }))
  }

  function addInheritance() {
    if (!selectedItem) return
    const parent = draft.items.find(item => item === 'ポテト(g)' && item !== selectedItem)
      || draft.items.find(item => item !== selectedItem)
    if (!parent) {
      setMessage('継承元にできる単品ベクトルがありません')
      return
    }
    updateDraft(current => ({
      ...current,
      item_parents: { ...current.item_parents, [selectedItem]: parent },
    }))
  }

  function updateItemParent(value) {
    if (!selectedItem || value === selectedItem) return
    updateDraft(current => {
      const itemParents = { ...current.item_parents }
      if (value) itemParents[selectedItem] = value
      else delete itemParents[selectedItem]
      return { ...current, item_parents: itemParents }
    })
  }

  function updateItemQuantity(value) {
    if (!selectedItem) return
    const quantity = Number(value)
    if (!Number.isInteger(quantity) || quantity <= 0 || quantity > 1000) return
    updateDraft(current => ({
      ...current,
      item_quantities: { ...current.item_quantities, [selectedItem]: quantity },
    }))
  }

  function toggleItem(item) {
    updateDraft(current => ({
      ...current,
      disabled_items: current.disabled_items.includes(item)
        ? current.disabled_items.filter(value => value !== item)
        : [...current.disabled_items, item],
    }))
  }

  function save() {
    try {
      const saved = saveCatalog(draft)
      setDraft(saved)
      onSaved(saved)
      setMessage('この端末に保存しました')
    } catch (exception) {
      setMessage(exception.message)
    }
  }

  function loadPublishedCatalog() {
    if (!window.confirm('端末内の編集中カタログを破棄して、公開版を読み込みますか？必要なら先にJSONを書き出してください。')) return
    const published = resetCatalog()
    setDraft(published)
    setCollapsed(collapseAllFolders(buildCatalogTree(published)))
    setSelection({ type: 'folder', path: published.folders[0]?.path || ['その他'] })
    onSaved(published)
    setMessage('公開カタログを読み込みました')
  }

  function preview() {
    try {
    setMessage(`有効な定義から${expandCatalog(draft).length}件のベクトルを生成できます`)
    } catch (exception) {
      setMessage(exception.message)
    }
  }

  function saveCurrentPreset() {
    try {
      const saved = savePreset(presetName, draft, presetId || null)
      setPresetId(saved.id)
      setPresetName(saved.name)
      onPresetsChanged()
      setMessage(`プリセット「${saved.name}」を保存しました`)
    } catch (exception) {
      setMessage(exception.message)
    }
  }

  function loadSelectedPreset() {
    const preset = findPreset(presetId)
    if (!preset) return
    const nextCatalog = normalizeCatalog(preset.catalog)
    setDraft(nextCatalog)
    setCollapsed(collapseAllFolders(buildCatalogTree(nextCatalog)))
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
        setCollapsed(collapseAllFolders(buildCatalogTree(imported)))
        setSelection({ type: 'folder', path: imported.folders[0]?.path || ['その他'] })
        setMessage('読み込みました。保存すると端末に反映されます')
      } catch (exception) {
        setMessage(`カタログを読み込めません: ${exception.message}`)
      }
    }
    reader.readAsText(file)
    event.target.value = ''
  }

  return (
    <div className="admin-page">
      <section className="admin-toolbar card">
        <div>
          <p className="eyebrow">CATALOG ADMIN</p>
          <h2>カタログ管理</h2>
        </div>
        <div className="admin-toolbar-actions">
          <button onClick={addFolder}>フォルダーを追加</button>
          <button onClick={addMenu}>メニューを追加</button>
          <button className="secondary" onClick={save}>変更を保存</button>
        </div>
      </section>

      <div className="admin-layout">
        <aside className="card catalog-explorer">
          <div className="explorer-heading">
            <div><strong>CATALOG</strong><span>{draft.menus.length} menus</span></div>
            <button className="icon-button" title="全フォルダーを展開" onClick={() => setCollapsed({})}>＋</button>
          </div>
          <div className="folder-create">
            <input placeholder={selection.type === 'folder' ? `${selection.path.join('/')} / 子フォルダー名` : 'フォルダー名'} value={newFolder} onChange={event => setNewFolder(event.target.value)} onKeyDown={event => event.key === 'Enter' && addFolder()} />
            <button className="secondary" onClick={addFolder}>追加</button>
          </div>
          <div className={`root-drop-zone ${dropTarget?.type === 'root' ? 'active' : ''}`} data-drop-type="root" onDragOver={event => dragOver(event, { type: 'root' })} onDrop={event => drop(event, { type: 'root' })}>最上位フォルダーへ移動</div>
          <div className="tree-root">
            {tree.folders.map(folder => <React.Fragment key={pathKey(folder.path)}><FolderDropZone path={folder.path} mode="before" dragging={dragging} dropTarget={dropTarget} dragOver={dragOver} drop={drop} /><TreeFolder node={folder} collapsed={collapsed} setCollapsed={setCollapsed} selected={selection} setSelected={setSelection} toggleFolder={toggleFolder} toggleMenu={toggleMenu} dragging={dragging} dropTarget={dropTarget} startDrag={startDrag} endDrag={endDrag} dragOver={dragOver} drop={drop} startPointerDrag={startPointerDrag} movePointerDrag={movePointerDrag} finishPointerDrag={finishPointerDrag} cancelPointerDrag={cancelPointerDrag} />{folder === tree.folders.at(-1) && <FolderDropZone path={folder.path} mode="after" dragging={dragging} dropTarget={dropTarget} dragOver={dragOver} drop={drop} />}</React.Fragment>)}
          </div>
          <div className="vector-manager">
            <div className="explorer-heading vector-tree-heading"><div><strong>ITEM VECTORS</strong><span>{draft.items.length} vectors</span></div></div>
            <form className="option-row" onSubmit={event => { event.preventDefault(); addItem(event.currentTarget.elements.item.value); event.currentTarget.reset() }}>
              <input name="item" placeholder="単品名を追加" />
              <button className="secondary">追加</button>
            </form>
            <div className="tree-root vector-tree-root">
              {draft.items.map(item => <div className={`tree-row menu-row ${draft.disabled_items.includes(item) ? 'disabled' : ''} ${selection.type === 'item' && selection.name === item ? 'selected' : ''}`} key={item}>
                <span className="menu-indent">•</span>
                <button className="tree-name" onClick={() => setSelection({ type: 'item', name: item })}>{item}</button>
                <button className={`tree-status ${draft.disabled_items.includes(item) ? 'is-disabled' : ''}`} onClick={() => toggleItem(item)}>{draft.disabled_items.includes(item) ? '無効' : '有効'}</button>
                <button className="icon-button" onClick={() => removeItem(item)}>×</button>
              </div>)}
            </div>
          </div>
        </aside>

        <section className="card editor">
          {selection.type === 'folder'
            ? <FolderEditor folder={selectedFolder} inheritedDisabled={selectedFolderInheritedDisabled} onRename={renameFolder} onToggle={() => selectedFolder && toggleFolder(selectedFolder.path)} onDelete={deleteFolder} />
            : selection.type === 'item'
              ? <ItemEditor item={selectedItem} price={selectedItem ? draft.item_prices[selectedItem] : null} quantity={selectedItem ? draft.item_quantities[selectedItem] : 1} parent={selectedItem ? draft.item_parents[selectedItem] : null} items={draft.items} onRename={renameItem} onPriceChange={updateItemPrice} onAddInheritance={addInheritance} onParentChange={updateItemParent} onQuantityChange={updateItemQuantity} />
              : <MenuEditor menu={menu} catalog={draft} effectiveDisabled={menu ? !isMenuEnabled(draft, menu) : false} updateMenu={updateMenu} updateGroup={updateGroup} updateOption={updateOption} setDraft={setDraft} />}
          <div className="admin-actions">
            <button onClick={save}>カタログを保存</button>
            <button className="secondary" onClick={preview}>生成結果を確認</button>
            <button className="secondary" onClick={exportCatalog}>JSONを書き出す</button>
            <button className="secondary" onClick={() => fileInput.current?.click()}>JSONを読み込む</button>
            <button className="secondary" onClick={loadPublishedCatalog}>公開版を読み込む</button>
            <input ref={fileInput} type="file" accept="application/json" hidden onChange={importCatalog} />
            {message && <span className="hint">{message}</span>}
          </div>
        </section>
      </div>

      <PresetManager presets={presets} presetId={presetId} presetName={presetName} setPresetId={setPresetId} setPresetName={setPresetName} save={saveCurrentPreset} load={loadSelectedPreset} remove={removeSelectedPreset} />
    </div>
  )
}

function TreeFolder({ node, collapsed, setCollapsed, selected, setSelected, toggleFolder, toggleMenu, dragging, dropTarget, startDrag, endDrag, dragOver, drop, startPointerDrag, movePointerDrag, finishPointerDrag, cancelPointerDrag }) {
  const key = pathKey(node.path)
  const isCollapsed = collapsed[key] === true
  const isDragging = dragging?.type === 'folder' && samePath(dragging.path, node.path)
  const isDropTarget = dropTarget?.type === 'folder' && samePath(dropTarget.path, node.path)
  return (
    <div className="tree-folder">
      <div
        className={`tree-row folder-row ${node.effectiveDisabled ? 'disabled' : ''} ${selected.type === 'folder' && samePath(selected.path, node.path) ? 'selected' : ''} ${isDragging ? 'dragging' : ''} ${isDropTarget ? 'drop-target' : ''}`}
        data-drop-type="folder"
        data-drop-path={JSON.stringify(node.path)}
        draggable
        onDragStart={event => startDrag(event, { type: 'folder', path: node.path })}
        onDragEnd={endDrag}
        onDragOver={event => dragOver(event, { type: 'folder', path: node.path, mode: folderDropMode(event.currentTarget, event.clientY) })}
        onDrop={event => drop(event, { type: 'folder', path: node.path, mode: folderDropMode(event.currentTarget, event.clientY) })}
      >
        <span className="drag-handle" title="ドラッグして移動" onPointerDown={event => startPointerDrag(event, { type: 'folder', path: node.path })} onPointerMove={movePointerDrag} onPointerUp={finishPointerDrag} onPointerCancel={cancelPointerDrag}>⠿</span>
        <button className="tree-chevron" onClick={() => setCollapsed(current => ({ ...current, [key]: !isCollapsed }))}>{isCollapsed ? '›' : '⌄'}</button>
        <button className="tree-name" onClick={() => setSelected({ type: 'folder', path: node.path })}><span className="folder-icon">▾</span>{node.path[node.path.length - 1]}</button>
        <button className={`tree-status ${node.effectiveDisabled ? 'is-disabled' : ''}`} onClick={() => toggleFolder(node.path)}>{node.disabled ? '無効' : node.inheritedDisabled ? '継承無効' : '有効'}</button>
      </div>
      {!isCollapsed && <div className="tree-children">
        {node.folders.map(child => <React.Fragment key={pathKey(child.path)}><FolderDropZone path={child.path} mode="before" dragging={dragging} dropTarget={dropTarget} dragOver={dragOver} drop={drop} /><TreeFolder node={child} collapsed={collapsed} setCollapsed={setCollapsed} selected={selected} setSelected={setSelected} toggleFolder={toggleFolder} toggleMenu={toggleMenu} dragging={dragging} dropTarget={dropTarget} startDrag={startDrag} endDrag={endDrag} dragOver={dragOver} drop={drop} startPointerDrag={startPointerDrag} movePointerDrag={movePointerDrag} finishPointerDrag={finishPointerDrag} cancelPointerDrag={cancelPointerDrag} />{child === node.folders.at(-1) && <FolderDropZone path={child.path} mode="after" dragging={dragging} dropTarget={dropTarget} dragOver={dragOver} drop={drop} />}</React.Fragment>)}
        {node.menus.map(({ menu, effectiveDisabled }, index) => <div
          className={`tree-row menu-row ${selected.type === 'menu' && selected.id === menu.id ? 'selected' : ''} ${effectiveDisabled ? 'disabled' : ''} ${dragging?.type === 'menu' && dragging.id === menu.id ? 'dragging' : ''}`}
          key={menu.id}
          data-drop-type="menu"
          data-drop-id={menu.id}
          draggable
          onDragStart={event => startDrag(event, { type: 'menu', id: menu.id })}
          onDragEnd={endDrag}
          onDragOver={event => dragOver(event, { type: 'menu', id: menu.id })}
          onDrop={event => drop(event, { type: 'menu', id: menu.id })}
        >
          <span className="drag-handle" title="ドラッグして移動" onPointerDown={event => startPointerDrag(event, { type: 'menu', id: menu.id })} onPointerMove={movePointerDrag} onPointerUp={finishPointerDrag} onPointerCancel={cancelPointerDrag}>⠿</span>
          <span className="menu-indent">•</span>
          <button className="tree-name" onClick={() => setSelected({ type: 'menu', id: menu.id })}>{menu.name || '名称未設定'}</button>
          <button className={`tree-status ${effectiveDisabled ? 'is-disabled' : ''}`} onClick={() => toggleMenu(menu.id)}>{menu.disabled ? '無効' : effectiveDisabled ? '継承無効' : '有効'}</button>
        </div>)}
      </div>}
    </div>
  )
}

function FolderDropZone({ path, mode, dragging, dropTarget, dragOver, drop }) {
  const active = dropTarget?.type === 'folder-position' && samePath(dropTarget.path, path) && dropTarget.mode === mode
  return <div className={`folder-drop-zone ${dragging?.type === 'folder' ? 'is-dragging' : ''} ${active ? 'active' : ''}`} data-drop-type="folder-position" data-drop-path={JSON.stringify(path)} data-drop-mode={mode} onDragOver={event => dragOver(event, { type: 'folder-position', path, mode })} onDrop={event => drop(event, { type: 'folder-position', path, mode })} />
}

function FolderEditor({ folder, inheritedDisabled, onRename, onToggle, onDelete }) {
  if (!folder) return <div className="empty-editor"><h2>フォルダーを選択</h2><p className="hint">左のツリーからフォルダーまたはメニューを選択してください。</p></div>
  const effectiveDisabled = folder.disabled || inheritedDisabled
  return <>
    <div className="editor-heading"><div><p className="eyebrow">FOLDER</p><h2>フォルダー設定</h2></div><span className={`status-badge ${effectiveDisabled ? 'disabled' : ''}`}>{folder.disabled ? '無効' : inheritedDisabled ? '継承無効' : '有効'}</span></div>
    <div className="form-grid single"><label>フォルダーパス<input value={folder.path.join('/')} onChange={event => onRename(event.target.value)} /></label></div>
    <p className="hint">上位フォルダーを無効にすると、その配下のすべてのフォルダーとメニューが継承無効になります。</p>
    <div className="editor-buttons"><button className="secondary" onClick={onToggle}>{folder.disabled ? 'このフォルダーを有効化' : 'このフォルダーを無効化'}</button><button className="danger" onClick={onDelete}>空のフォルダーを削除</button></div>
  </>
}

function ItemEditor({ item, price, quantity, parent, items, onRename, onPriceChange, onAddInheritance, onParentChange, onQuantityChange }) {
  if (!item) return <div className="empty-editor"><h2>単品ベクトルを選択</h2><p className="hint">左の単品ベクトル一覧から選択してください。</p></div>
  return <>
    <div className="editor-heading"><div><p className="eyebrow">ITEM VECTOR</p><h2>単品ベクトル編集</h2></div></div>
    <div className="form-grid single">
      <label>単品名<input value={item} onChange={event => onRename(event.target.value)} /></label>
      <label>単品価格（円）<span className="money-input"><span>¥</span><input type="number" min="0" max="100000" placeholder="未登録" value={price ?? ''} onChange={event => onPriceChange(event.target.value)} /></span></label>
    </div>
    <div className="inheritance-editor">
      <div className="subsection-heading"><h3>継承設定</h3>{parent ? <button className="secondary" onClick={() => onParentChange('')}>継承を削除</button> : <button className="secondary" onClick={onAddInheritance}>継承を追加</button>}</div>
      {parent && <div className="form-grid">
        <label>継承元<select value={parent} onChange={event => onParentChange(event.target.value)}>{items.filter(candidate => candidate !== item).map(candidate => <option key={candidate} value={candidate}>{candidate}</option>)}</select></label>
        <label>数量<input type="number" min="1" max="1000" value={quantity} onChange={event => onQuantityChange(event.target.value)} /></label>
      </div>}
    </div>
  </>
}

function MenuEditor({ menu, catalog, effectiveDisabled, updateMenu, updateGroup, updateOption, setDraft }) {
  if (!menu) return <div className="empty-editor"><h2>メニューを選択</h2><p className="hint">左のツリーから編集するメニューを選択してください。</p></div>
  return <>
    <div className="editor-heading"><div><p className="eyebrow">MENU VECTOR</p><h2>メニュー編集</h2></div><span className={`status-badge ${effectiveDisabled ? 'disabled' : ''}`}>{menu.disabled ? '無効' : effectiveDisabled ? '継承無効' : '有効'}</span></div>
    <div className="form-grid">
      <label>メニュー名<input value={menu.name} onChange={event => updateMenu('name', event.target.value)} /></label>
      <label>フォルダーパス<input value={menu.path.join('/')} onChange={event => updateMenu('path', event.target.value.split('/').map(segment => segment.trim()).filter(Boolean))} /></label>
      <label>基本価格（円）<span className="money-input"><span>¥</span><input type="number" min="0" max="100000" value={menu.base_price} onChange={event => updateMenu('base_price', Number(event.target.value))} /></span></label>
      <label>個数制限（無制限は-1）<input type="number" min="-1" max="100" value={menu.limit} onChange={event => updateMenu('limit', Number(event.target.value))} /></label>
      <label>属性（カンマ区切り）<input value={menu.attributes.join(',')} placeholder="pack" onChange={event => updateMenu('attributes', event.target.value.split(',').map(value => value.trim()).filter(Boolean))} /></label>
      <label>購入条件（いずれかの属性）<input value={menu.requires_any_attributes.join(',')} placeholder="pack" onChange={event => updateMenu('requires_any_attributes', event.target.value.split(',').map(value => value.trim()).filter(Boolean))} /></label>
    </div>
    <div className="groups">
      {menu.groups.map((group, groupIndex) => <div className="group-editor" key={groupIndex}>
        <div className="group-heading"><h3>選択グループ {groupIndex + 1}</h3><label>選択個数<input className="small-input" type="number" min="0" max="100" value={group.choose_count} onChange={event => updateGroup(groupIndex, { ...group, choose_count: Number(event.target.value) })} /></label><button className="secondary" onClick={() => updateMenu('groups', menu.groups.filter((_, index) => index !== groupIndex))}>グループ削除</button></div>
        {group.options.map((option, optionIndex) => <div className="option-row menu-option-row" key={optionIndex}>
          <input list="item-names" placeholder="単品ベクトル名" value={option.name} onChange={event => updateOption(groupIndex, optionIndex, { ...option, name: event.target.value })} />
          <span className="quantity-input"><span>数量</span><input type="number" min="1" max="1000" aria-label="単品数量" value={option.quantity ?? 1} onChange={event => updateOption(groupIndex, optionIndex, { ...option, quantity: Number(event.target.value) })} /></span>
          <span className="money-input"><span>+¥</span><input type="number" aria-label="追加料金（円）" placeholder="追加料金" value={option.price_delta} onChange={event => updateOption(groupIndex, optionIndex, { ...option, price_delta: Number(event.target.value) })} /></span>
          <button className="secondary" onClick={() => updateGroup(groupIndex, { ...group, options: group.options.filter((_, index) => index !== optionIndex) })}>削除</button>
        </div>)}
        <button className="secondary" onClick={() => updateGroup(groupIndex, { ...group, options: [...group.options, { name: '', quantity: 1, price_delta: 0 }] })}>選択肢を追加</button>
      </div>)}
    </div>
    <button className="secondary group-add-button" onClick={() => updateMenu('groups', [...menu.groups, blankGroup()])}>選択グループを追加</button>
    <datalist id="item-names">{[...catalog.items.filter(name => name !== POTATO_VECTOR_NAME), ...POTATO_OPTION_NAMES].filter((name, index, names) => names.indexOf(name) === index).map(name => <option key={name} value={name} />)}</datalist>
    <div className="editor-buttons"><button className="secondary" onClick={() => updateMenu('disabled', !menu.disabled)}>{menu.disabled ? 'メニューを有効化' : 'メニューを無効化'}</button><button className="danger" onClick={() => setDraft(current => ({ ...current, menus: current.menus.filter(item => item.id !== menu.id) }))}>メニューを削除</button></div>
  </>
}

function PresetManager({ presets, presetId, presetName, setPresetId, setPresetName, save, load, remove }) {
  return <section className="card preset-manager"><div><p className="eyebrow">PRESETS</p><h2>プリセット</h2><p className="hint">フォルダーの無効状態、メニュー、単品ベクトルをまとめて保存します。</p></div><div className="preset-controls"><select value={presetId} onChange={event => setPresetId(event.target.value)}><option value="">プリセットを選択</option>{presets.map(preset => <option key={preset.id} value={preset.id}>{preset.name}{preset.builtIn ? '（標準）' : ''}</option>)}</select><input placeholder="保存名（新規・上書き）" value={presetName} onChange={event => setPresetName(event.target.value)} /><button onClick={save}>この状態を保存</button><button className="secondary" disabled={!presetId} onClick={load}>読み込む</button><button className="danger" disabled={!presetId || presets.find(preset => preset.id === presetId)?.builtIn} onClick={remove}>削除</button></div></section>
}
