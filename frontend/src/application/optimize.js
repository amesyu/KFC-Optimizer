import GLPK from 'glpk.js'
import { MAX_INPUT_COUNT, expandCatalog, normalizeTarget, validateTarget } from '../domain/catalog'

function createModel(catalog, request, glpk) {
  const target = normalizeTarget(request.target, catalog)
  validateTarget(target, catalog)
  const entries = expandCatalog(catalog)
  const itemNames = [...new Set([...catalog.items, ...Object.keys(target)])].sort()
  const variables = entries.map((_, index) => `menu_${index}`)
  const objective = { direction: glpk.GLP_MIN, name: 'total_price', vars: entries.map((entry, index) => ({ name: variables[index], coef: entry.price })) }
  const subjectTo = itemNames.map((itemName, itemIndex) => ({
    name: `item_${itemIndex}`,
    vars: entries.map((entry, index) => ({ name: variables[index], coef: entry.items[itemName] || 0 })).filter(variable => variable.coef !== 0),
    bnds: request.exact ? { type: glpk.GLP_FX, lb: target[itemName] || 0, ub: target[itemName] || 0 } : { type: glpk.GLP_LO, lb: target[itemName] || 0, ub: 0 },
  }))
  entries.forEach((entry, entryIndex) => {
    if (!entry.requires_any_attributes.length) return
    const providers = entries
      .map((candidate, candidateIndex) => candidate.attributes.some(attribute => entry.requires_any_attributes.includes(attribute)) ? candidateIndex : -1)
      .filter(candidateIndex => candidateIndex >= 0)
    subjectTo.push({
      name: `requirement_${entryIndex}`,
      vars: [{ name: variables[entryIndex], coef: 1 }, ...providers.map(providerIndex => ({ name: variables[providerIndex], coef: -MAX_INPUT_COUNT }))],
      bnds: providers.length ? { type: glpk.GLP_UP, lb: 0, ub: 0 } : { type: glpk.GLP_FX, lb: 0, ub: 0 },
    })
  })
  const bounds = entries.map((entry, index) => ({
    name: variables[index],
    type: entry.limit === -1 ? glpk.GLP_LO : glpk.GLP_DB,
    lb: 0,
    ub: entry.limit === -1 ? 0 : entry.limit,
  }))
  return { name: 'KFC_Menu_Optimization', objective, subjectTo, bounds, generals: variables, entries }
}

export async function optimize(catalog, request) {
  const glpk = await GLPK()
  const model = createModel(catalog, request, glpk)
  const solved = await glpk.solve(model, { msglev: glpk.GLP_MSG_OFF, presol: true, tmlim: 10 })
  const status = solved.result.status
  if (status !== glpk.GLP_OPT) return { status: status === glpk.GLP_UNDEF ? 'TIME_LIMIT' : 'NO_SOLUTION', message: '条件を満たす解が見つかりませんでした' }
  const selection = model.entries.map((entry, index) => ({ ...entry, count: Math.round(solved.result.vars[`menu_${index}`] || 0) })).filter(entry => entry.count > 0)
  return { status: 'Optimal', total_price: Math.round(solved.result.z), selection }
}
