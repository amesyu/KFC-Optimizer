export const MAX_INPUT_COUNT = 100
export const MAX_TARGET_ITEMS = 100
export const MAX_GENERATED_VARIANTS = 100000

const PATH_SEPARATOR = '\u001f'

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

export function pathKey(path) {
  return path.join(PATH_SEPARATOR)
}

function cleanPath(path) {
  return path.map(segment => String(segment).trim()).filter(Boolean)
}

function samePath(left, right) {
  return left.length === right.length && left.every((segment, index) => segment === right[index])
}

function folderPaths(menus) {
  const paths = new Map()
  menus.forEach(menu => {
    const path = cleanPath(menu.path)
    path.forEach((_, index) => {
      const folderPath = path.slice(0, index + 1)
      const key = pathKey(folderPath)
      if (!paths.has(key)) paths.set(key, folderPath)
    })
  })
  return [...paths.values()]
}

function legacyMenuPath(menu) {
  const category = String(menu.category || 'その他').trim() || 'その他'
  const productTypes = [
    'ダブルチキンフィレバーガー',
    'チーズチキンフィレバーガー',
    'チキンフィレバーガー',
    '和風チキンカツバーガー',
    '辛口チキンフィレバーガー',
    '竜田バーガー',
    'てりやきツイスター',
    'ペッパーマヨツイスター',
  ]
  const productType = productTypes.find(type => String(menu.name).includes(type))
  if (!productType) return [category]
  return [category, /バーガー/.test(productType) ? 'バーガー' : 'ツイスター', productType]
}

export function normalizeCatalog(input) {
  const menus = (input?.menus || []).map((menu, index) => {
    const existingPath = Array.isArray(menu.path) ? cleanPath(menu.path) : []
    const legacyPath = legacyMenuPath(menu)
    const hasLegacyRootPath = existingPath.length === 1 && menu.category === existingPath[0]
    const hasLegacyFamilyPath = existingPath.length === 2 && legacyPath.length === 3 && samePath(existingPath, legacyPath.slice(0, 2))
    const path = !existingPath.length || hasLegacyRootPath || hasLegacyFamilyPath ? legacyPath : existingPath
    return {
      ...menu,
      id: menu.id || `menu-${index + 1}`,
      path: path.length ? path : ['その他'],
      disabled: menu.disabled === true,
      attributes: Array.isArray(menu.attributes) ? [...new Set(menu.attributes.map(String))] : [],
      requires_any_attributes: Array.isArray(menu.requires_any_attributes) ? [...new Set(menu.requires_any_attributes.map(String))] : [],
    }
  })
  const configuredFolders = Array.isArray(input?.folders) ? input.folders : []
  const folderMap = new Map()
  const configuredPaths = configuredFolders.flatMap(folder => {
    const path = cleanPath(folder.path || [])
    return path.map((_, index) => path.slice(0, index + 1))
  })
  ;[...folderPaths(menus), ...configuredPaths].forEach(path => {
    if (path.length && !folderMap.has(pathKey(path))) folderMap.set(pathKey(path), path)
  })
  const states = new Map(configuredFolders.map(folder => [pathKey(cleanPath(folder.path || [])), folder.disabled === true]))
  return {
    ...input,
    version: 3,
    hierarchy_seeded: true,
    items: Array.isArray(input?.items) ? [...input.items] : [],
    menus,
    folders: [...folderMap.entries()].map(([key, path]) => ({ path, disabled: states.get(key) === true })),
  }
}

export function validateCatalog(input) {
  assert(input && Array.isArray(input.items) && Array.isArray(input.menus), 'カタログ形式が不正です')
  const catalog = normalizeCatalog(input)
  assert(catalog.items.length <= MAX_TARGET_ITEMS, `単品の種類は${MAX_TARGET_ITEMS}種類までです`)
  assert(new Set(catalog.items).size === catalog.items.length && catalog.items.every(item => typeof item === 'string' && item.trim()), '単品名は重複しない空でない文字列にしてください')
  assert(Array.isArray(catalog.menus) && catalog.menus.length <= MAX_TARGET_ITEMS * 20, 'メニュー数が上限を超えています')
  assert(new Set(catalog.menus.map(menu => menu.id)).size === catalog.menus.length, 'メニューIDが重複しています')
  const knownItems = new Set(catalog.items)
  const knownFolders = new Set(catalog.folders.map(folder => pathKey(folder.path)))
  catalog.folders.forEach(folder => {
    assert(Array.isArray(folder.path) && folder.path.length > 0 && folder.path.every(segment => typeof segment === 'string' && segment.trim()), '階層名が不正です')
    assert(typeof folder.disabled === 'boolean', '階層の有効状態が不正です')
  })
  catalog.menus.forEach(menu => {
    assert(typeof menu.name === 'string' && menu.name.trim(), 'メニュー名が不正です')
    assert(Array.isArray(menu.path) && menu.path.length > 0 && menu.path.every(segment => typeof segment === 'string' && segment.trim()), 'メニュー階層が不正です')
    menu.path.forEach((_, index) => assert(knownFolders.has(pathKey(menu.path.slice(0, index + 1))), `未登録の階層です: ${menu.path.join('/')}`))
    assert(typeof menu.disabled === 'boolean', 'メニューの有効状態が不正です')
    assert(menu.attributes.every(attribute => attribute.trim()), 'メニュー属性が不正です')
    assert(menu.requires_any_attributes.every(attribute => attribute.trim()), 'メニューの購入条件が不正です')
    assert(Number.isInteger(menu.base_price) && menu.base_price >= 0, '基本価格が不正です')
    assert(menu.limit === -1 || (Number.isInteger(menu.limit) && menu.limit >= 0 && menu.limit <= MAX_INPUT_COUNT), '個数制限が不正です')
    assert(Array.isArray(menu.groups), '選択グループが不正です')
    let variants = 1
    menu.groups.forEach(group => {
      assert(Array.isArray(group.options) && group.options.length > 0, '選択肢が空のグループがあります')
      assert(Number.isInteger(group.choose_count) && group.choose_count >= 0 && group.choose_count <= MAX_INPUT_COUNT, '選択個数が不正です')
      group.options.forEach(option => {
        assert(knownItems.has(option.name), `未登録の単品ベクトルです: ${option.name}`)
        assert(Number.isInteger(option.price_delta), '価格差が不正です')
      })
      variants *= combinationsWithReplacement(group.options.length, group.choose_count).length
      assert(variants <= MAX_GENERATED_VARIANTS, '生成するベクトル数が上限を超えています')
    })
  })
  return catalog
}

function combinationsWithReplacement(optionCount, count) {
  const result = []
  function visit(start, remaining, current) {
    if (remaining === 0) { result.push([...current]); return }
    for (let index = start; index < optionCount; index += 1) {
      current.push(index)
      visit(index, remaining - 1, current)
      current.pop()
    }
  }
  visit(0, count, [])
  return result
}

function expandGroup(group) {
  return combinationsWithReplacement(group.options.length, group.choose_count).map(indexes => {
    const items = {}
    let price = 0
    indexes.forEach(index => {
      const option = group.options[index]
      items[option.name] = (items[option.name] || 0) + 1
      price += option.price_delta
    })
    return { items, price }
  })
}

function expandMenu(menu) {
  let variants = [{ items: {}, price: menu.base_price }]
  for (const group of menu.groups) {
    const groupVariants = expandGroup(group)
    variants = variants.flatMap(current => groupVariants.map(next => {
      const items = { ...current.items }
      Object.entries(next.items).forEach(([name, count]) => { items[name] = (items[name] || 0) + count })
      return { items, price: current.price + next.price }
    }))
    if (variants.length > MAX_GENERATED_VARIANTS) throw new Error(`メニュー「${menu.name}」の生成件数が上限を超えています`)
  }
  return variants.map(variant => ({
    name: menu.name,
    path: menu.path,
    price: variant.price,
    items: variant.items,
    limit: menu.limit,
    attributes: menu.attributes,
    requires_any_attributes: menu.requires_any_attributes,
  }))
}

export function isFolderDisabled(catalog, path) {
  return catalog.folders.find(folder => pathKey(folder.path) === pathKey(path))?.disabled === true
}

export function isMenuEnabled(catalog, menu) {
  if (menu.disabled) return false
  return menu.path.every((_, index) => !isFolderDisabled(catalog, menu.path.slice(0, index + 1)))
}

export function expandCatalog(input, _mode, excludeKids) {
  const catalog = validateCatalog(input)
  const menus = catalog.menus.filter(menu => isMenuEnabled(catalog, menu) && (!excludeKids || menu.path[0] !== 'キッズメニュー'))
  return menus.flatMap(expandMenu)
}

export function buildCatalogTree(input) {
  const catalog = validateCatalog(input)
  const root = { path: [], folders: [], menus: [] }
  const nodes = new Map([['', root]])
  catalog.folders.forEach(folder => {
    folder.path.forEach((_, index) => {
      const path = folder.path.slice(0, index + 1)
      const key = pathKey(path)
      if (nodes.has(key)) return
      const parent = nodes.get(pathKey(path.slice(0, -1)))
      const node = { path, disabled: isFolderDisabled(catalog, path), folders: [], menus: [] }
      nodes.set(key, node)
      parent.folders.push(node)
    })
  })
  catalog.menus.forEach((menu, index) => nodes.get(pathKey(menu.path)).menus.push({ menu, index, effectiveDisabled: !isMenuEnabled(catalog, menu) }))
  return root
}

export function validateTarget(target) {
  const names = Object.keys(target)
  if (!names.length) throw new Error('単品を1つ以上指定してください')
  if (names.length > MAX_TARGET_ITEMS) throw new Error(`単品の種類は${MAX_TARGET_ITEMS}種類までです`)
  const total = names.reduce((sum, name) => {
    const count = target[name]
    if (!Number.isInteger(count) || count < 0 || count > MAX_INPUT_COUNT) throw new Error('個数は0〜100の整数で入力してください')
    return sum + count
  }, 0)
  if (total > MAX_INPUT_COUNT) throw new Error(`合計個数は${MAX_INPUT_COUNT}個までです`)
}
