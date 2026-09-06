import { optimize } from '../application/optimize'

self.onmessage = async event => {
  try {
    const { catalog, request } = event.data
    self.postMessage({ type: 'result', result: await optimize(catalog, request) })
  } catch (error) {
    self.postMessage({ type: 'error', message: error instanceof Error ? error.message : String(error) })
  }
}
