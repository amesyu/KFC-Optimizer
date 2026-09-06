export const MAX_INPUT_COUNT = 100
export const MAX_TARGET_QUANTITY = 1000
export const MAX_TARGET_ITEMS = 100
export const MAX_GENERATED_VARIANTS = 100000

const PATH_SEPARATOR = '\u001f'
const POTATO_VECTOR = 'ポテト(g)'
const POTATO_QUANTITIES = { ポテトS: 80, ポテトL: 160, BOXポテト: 400 }
export const POTATO_VECTOR_NAME = POTATO_VECTOR
export const POTATO_OPTION_NAMES = Object.keys(POTATO_QUANTITIES)
const PREFERRED_ITEM_ORDER = [
  'オリジナルチキン', '骨なしケンタッキー', 'レモン香るパリパリ旨塩チキン', 'クリスピー', 'ナゲット',
  POTATO_VECTOR, 'ビスケット', 'コールスローS', 'コールスローM', 'チョコパイ',
  ...POTATO_OPTION_NAMES,
  'チキンフィレバーガー', 'チーズチキンフィレバーガー', 'ダブルチキンフィレバーガー', '和風チキンカツバーガー', '辛口チキンフィレバーガー', '竜田バーガー', 'てりやきツイスター', 'ペッパーマヨツイスター',
  'ドリンクS', 'ドリンクM', 'ドリンクL', 'ホットコーヒー', 'リプトンホットティー', 'ちゅる～りぃ(ブルーハワイ)', 'キッズグッズ',
]
const PREFERRED_FOLDER_ORDER = [
  'ランチメニュー', 'キャンペーン', 'セットメニュー', 'トクトクパック',
  'チキン単品', 'サイドメニュー', 'ドリンク', 'キッズメニュー', 'その他',
]
const PREFERRED_FOLDER_CHILD_ORDER = ['バーガー', 'ツイスター']
const PREFERRED_PRODUCT_FOLDER_ORDER = [
  'チキンフィレバーガー', 'チーズチキンフィレバーガー', 'ダブルチキンフィレバーガー',
  '和風チキンカツバーガー', '辛口チキンフィレバーガー', '竜田バーガー',
  'てりやきツイスター', 'ペッパーマヨツイスター',
]

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

export function pathKey(path) {
  return path.join(PATH_SEPARATOR)
}

function cleanPath(path) {
  return path.map(segment => String(segment).trim()).filter(Boolean)
}

function normalizeItemName(name) {
  return POTATO_QUANTITIES[name] ? POTATO_VECTOR : name
}

function samePath(left, right) {
  return left.length === right.length && left.every((segment, index) => segment === right[index])
}

function orderItems(items) {
  const preferredRanks = new Map(PREFERRED_ITEM_ORDER.map((item, index) => [item, index]))
  return items
    .map((item, index) => ({ item, index }))
    .sort((left, right) => (preferredRanks.get(left.item) ?? PREFERRED_ITEM_ORDER.length + left.index) - (preferredRanks.get(right.item) ?? PREFERRED_ITEM_ORDER.length + right.index))
    .map(({ item }) => item)
}

function orderFolders(folders) {
  const rootRanks = new Map(PREFERRED_FOLDER_ORDER.map((name, index) => [name, index]))
  const childRanks = new Map(PREFERRED_FOLDER_CHILD_ORDER.map((name, index) => [name, index]))
  const productRanks = new Map(PREFERRED_PRODUCT_FOLDER_ORDER.map((name, index) => [name, index]))

  return folders
    .map((folder, index) => ({ folder, index }))
    .sort((left, right) => {
      const leftPath = left.folder.path
      const rightPath = right.folder.path
      for (let index = 0; index < Math.min(leftPath.length, rightPath.length); index += 1) {
        if (leftPath[index] === rightPath[index]) continue
        const ranks = index === 0 ? rootRanks : index === 1 ? childRanks : productRanks
        const leftRank = ranks.get(leftPath[index])
        const rightRank = ranks.get(rightPath[index])
        if (leftRank !== undefined || rightRank !== undefined) {
          if (leftRank === undefined) return 1
          if (rightRank === undefined) return -1
          return leftRank - rightRank
        }
        return left.index - right.index
      }
      return leftPath.length - rightPath.length || left.index - right.index
    })
    .map(({ folder }) => folder)
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

function inferItemPrices(menus, items) {
  const prices = {}
  menus.forEach(menu => {
    let itemName = null
    let quantity = 0
    let price = menu.base_price
    for (const group of menu.groups || []) {
      if (group.options?.length !== 1) {
        itemName = null
        break
      }
      const option = group.options[0]
      quantity += group.choose_count
      price += option.price_delta * group.choose_count
      itemName = option.name
    }
    if (itemName && quantity === 1 && items.includes(itemName) && Number.isInteger(price) && (prices[itemName] === undefined || price < prices[itemName])) {
      prices[itemName] = price
    }
  })
  return prices
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
      groups: Array.isArray(menu.groups) ? menu.groups.map(group => ({
        ...group,
        options: Array.isArray(group.options) ? group.options.map(option => ({
          ...option,
          quantity: POTATO_QUANTITIES[option.name] || (Number.isInteger(option.quantity) && option.quantity > 0 ? option.quantity : 1),
        })) : [],
      })) : [],
    }
  })
  const configuredFolders = Array.isArray(input?.folders) ? input.folders : []
  const folderMap = new Map()
  const configuredPaths = configuredFolders.flatMap(folder => {
    const path = cleanPath(folder.path || [])
    return path.map((_, index) => path.slice(0, index + 1))
  })
  ;[...configuredPaths, ...folderPaths(menus)].forEach(path => {
    if (path.length && !folderMap.has(pathKey(path))) folderMap.set(pathKey(path), path)
  })
  const states = new Map(configuredFolders.map(folder => [pathKey(cleanPath(folder.path || [])), folder.disabled === true]))
  const sourceItems = Array.isArray(input?.items) ? [...new Set(input.items)] : []
  POTATO_OPTION_NAMES.forEach(name => {
    if (sourceItems.includes(name) && !sourceItems.includes(POTATO_VECTOR)) sourceItems.unshift(POTATO_VECTOR)
  })
  const disabledItems = Array.isArray(input?.disabled_items) ? [...new Set(input.disabled_items)] : []
  const inferredPrices = inferItemPrices(menus, sourceItems)
  const configuredPrices = input?.item_prices && typeof input.item_prices === 'object' ? input.item_prices : {}
  const itemPrices = Object.fromEntries(sourceItems.map(item => [
    item,
    Number.isInteger(configuredPrices[item]) && configuredPrices[item] >= 0
      ? configuredPrices[item]
      : inferredPrices[item] ?? null,
  ]))
  const configuredQuantities = input?.item_quantities && typeof input.item_quantities === 'object' ? input.item_quantities : {}
  const itemQuantities = Object.fromEntries(sourceItems.map(item => [
    item,
    Number.isInteger(configuredQuantities[item]) && configuredQuantities[item] > 0
      ? configuredQuantities[item]
      : POTATO_QUANTITIES[item] || 1,
  ]))
  const configuredParents = input?.item_parents && typeof input.item_parents === 'object' ? input.item_parents : {}
  const defaultParents = Object.fromEntries(POTATO_OPTION_NAMES
    .filter(item => sourceItems.includes(item))
    .map(item => [item, POTATO_VECTOR]))
  const itemParents = Object.fromEntries(Object.entries({ ...defaultParents, ...configuredParents })
    .filter(([item, parent]) => sourceItems.includes(item) && sourceItems.includes(parent) && item !== parent))
  return {
    ...input,
    version: 4,
    hierarchy_seeded: true,
    item_order_seeded: true,
    items: input?.item_order_seeded === true ? sourceItems : orderItems(sourceItems),
    item_prices: itemPrices,
    item_quantities: itemQuantities,
    item_parents: itemParents,
    disabled_items: disabledItems,
    menus,
    folders: input?.folder_order_seeded === true
      ? [...folderMap.entries()].map(([key, path]) => ({ path, disabled: states.get(key) === true }))
      : orderFolders([...folderMap.entries()].map(([key, path]) => ({ path, disabled: states.get(key) === true }))),
    folder_order_seeded: true,
  }
}

export function validateCatalog(input) {
  assert(input && Array.isArray(input.items) && Array.isArray(input.menus), 'カタログ形式が不正です')
  const catalog = normalizeCatalog(input)
  assert(catalog.items.length <= MAX_TARGET_ITEMS, `単品の種類は${MAX_TARGET_ITEMS}種類までです`)
  assert(new Set(catalog.items).size === catalog.items.length && catalog.items.every(item => typeof item === 'string' && item.trim()), '単品名は重複しない空でない文字列にしてください')
  const knownItems = new Set(catalog.items)
  assert(catalog.item_prices && typeof catalog.item_prices === 'object' && !Array.isArray(catalog.item_prices), '単品価格の形式が不正です')
  assert(Object.keys(catalog.item_prices).every(item => knownItems.has(item) && (catalog.item_prices[item] === null || (Number.isInteger(catalog.item_prices[item]) && catalog.item_prices[item] >= 0))), '単品価格が不正です')
  assert(catalog.item_quantities && typeof catalog.item_quantities === 'object' && !Array.isArray(catalog.item_quantities), '単品数量の形式が不正です')
  assert(Object.keys(catalog.item_quantities).every(item => knownItems.has(item) && Number.isInteger(catalog.item_quantities[item]) && catalog.item_quantities[item] > 0), '単品数量が不正です')
  assert(catalog.item_parents && typeof catalog.item_parents === 'object' && !Array.isArray(catalog.item_parents), '単品継承元の形式が不正です')
  assert(Object.keys(catalog.item_parents).every(item => knownItems.has(item) && knownItems.has(catalog.item_parents[item])), '単品継承元が不正です')
  Object.keys(catalog.item_parents).forEach(item => {
    const visited = new Set()
    let current = item
    while (current) {
      assert(!visited.has(current), '単品ベクトルの継承が循環しています')
      visited.add(current)
      current = catalog.item_parents[current]
    }
  })
  assert(Array.isArray(catalog.menus) && catalog.menus.length <= MAX_TARGET_ITEMS * 20, 'メニュー数が上限を超えています')
  assert(new Set(catalog.menus.map(menu => menu.id)).size === catalog.menus.length, 'メニューIDが重複しています')
  assert(Array.isArray(catalog.disabled_items) && catalog.disabled_items.every(item => knownItems.has(item)), '無効化された単品が不正です')
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
        assert(knownItems.has(normalizeItemName(option.name)) || POTATO_OPTION_NAMES.includes(option.name), `未登録の単品ベクトルです: ${option.name}`)
        assert(Number.isInteger(option.price_delta), '価格差が不正です')
        assert(Number.isInteger(option.quantity) && option.quantity > 0 && option.quantity <= MAX_TARGET_QUANTITY, '単品数量が不正です')
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

function expandGroup(group, catalog) {
  const options = group.options.filter(option => isItemEnabled(catalog, option.name))
  return combinationsWithReplacement(options.length, group.choose_count).map(indexes => {
    const items = {}
    let price = 0
    indexes.forEach(index => {
      const option = options[index]
      const reference = resolveItemReference(catalog, option.name)
      items[reference.name] = (items[reference.name] || 0) + reference.quantity
      price += option.price_delta
    })
    return { items, price }
  })
}

function expandMenu(menu, catalog) {
  let variants = [{ items: {}, price: menu.base_price }]
  for (const group of menu.groups) {
    const groupVariants = expandGroup(group, catalog)
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

export function isPathDisabled(catalog, path) {
  return path.some((_, index) => isFolderDisabled(catalog, path.slice(0, index + 1)))
}

export function isItemEnabled(catalog, item) {
  const disabledItems = new Set(catalog.disabled_items || [])
  const visited = new Set()
  let current = item
  while (current && !visited.has(current)) {
    if (disabledItems.has(current)) return false
    visited.add(current)
    current = catalog.item_parents?.[current]
  }
  return true
}

function resolveItemReference(catalog, item) {
  const visited = new Set()
  let current = item
  let root = item
  let quantity = 1
  while (current && !visited.has(current)) {
    visited.add(current)
    root = current
    quantity *= catalog.item_quantities?.[current] || POTATO_QUANTITIES[current] || 1
    current = catalog.item_parents?.[current]
  }
  return { name: normalizeItemName(root), quantity }
}

export function isMenuEnabled(catalog, menu) {
  if (menu.disabled) return false
  return !isPathDisabled(catalog, menu.path)
}

export function expandCatalog(input) {
  const catalog = validateCatalog(input)
  const menus = catalog.menus.filter(menu => isMenuEnabled(catalog, menu))
  return menus.flatMap(menu => expandMenu(menu, catalog)).filter(entry => Object.keys(entry.items).every(item => isItemEnabled(catalog, item)))
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
      const disabled = isFolderDisabled(catalog, path)
      const inheritedDisabled = isPathDisabled(catalog, path.slice(0, -1))
      const node = { path, disabled, inheritedDisabled, effectiveDisabled: disabled || inheritedDisabled, folders: [], menus: [] }
      nodes.set(key, node)
      parent.folders.push(node)
    })
  })
  catalog.menus.forEach((menu, index) => nodes.get(pathKey(menu.path)).menus.push({ menu, index, effectiveDisabled: !isMenuEnabled(catalog, menu) }))
  return root
}

export function validateTarget(target, catalog = null) {
  const names = Object.keys(target)
  if (!names.length) throw new Error('単品を1つ以上指定してください')
  if (names.length > MAX_TARGET_ITEMS) throw new Error(`単品の種類は${MAX_TARGET_ITEMS}種類までです`)
  if (catalog && names.some(name => !isItemEnabled(catalog, name))) throw new Error('無効化された単品は指定できません')
  const total = names.reduce((sum, name) => {
    const count = target[name]
    if (!Number.isInteger(count) || count < 0 || count > MAX_TARGET_QUANTITY) throw new Error(`数量は0〜${MAX_TARGET_QUANTITY}の整数で入力してください`)
    return sum + count
  }, 0)
  if (total > MAX_TARGET_QUANTITY) throw new Error(`合計数量は${MAX_TARGET_QUANTITY}までです`)
}

export function normalizeTarget(target, catalog = null) {
  return Object.entries(target).reduce((normalized, [name, quantity]) => {
    const reference = catalog ? resolveItemReference(catalog, name) : {
      name: normalizeItemName(name),
      quantity: POTATO_QUANTITIES[name] || 1,
    }
    normalized[reference.name] = (normalized[reference.name] || 0) + quantity * reference.quantity
    return normalized
  }, {})
}
