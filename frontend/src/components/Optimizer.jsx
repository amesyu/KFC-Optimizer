import React, { useEffect, useMemo, useRef, useState } from 'react'
import OptimizerWorker from '../workers/optimizer.worker?worker'

const emptyTarget = { name: '', count: 1 }

export default function Optimizer({ catalog }) {
  const workerRef = useRef(null)
  const [excludeKids, setExcludeKids] = useState(false)
  const [items, setItems] = useState([emptyTarget])
  const [exact, setExact] = useState(false)
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const names = useMemo(() => catalog.items || [], [catalog])

  useEffect(() => () => workerRef.current?.terminate(), [])

  function updateItem(index, key, value) {
    setItems(current => current.map((item, itemIndex) => itemIndex === index ? { ...item, [key]: value } : item))
  }

  function changeCount(index, value) {
    const number = Number(value)
    if (value !== '' && (!Number.isInteger(number) || number < 0 || number > 100)) return
    updateItem(index, 'count', value)
  }

  function solve() {
    setError('')
    const target = {}
    items.forEach(item => { if (item.name) target[item.name] = (target[item.name] || 0) + Number(item.count) })
    setLoading(true)
    setResult(null)
    workerRef.current?.terminate()
    const worker = new OptimizerWorker()
    workerRef.current = worker
    worker.onmessage = event => {
      worker.terminate()
      setLoading(false)
      if (event.data.type === 'error') setError(event.data.message)
      else setResult(event.data.result)
    }
    worker.onerror = event => { worker.terminate(); setLoading(false); setError(event.message || '最適化Workerを起動できませんでした') }
    worker.postMessage({ catalog, request: { target, exact, excludeKids } })
  }

  return <div className="optimizer-page">
    <section className="card"><div className="card-heading"><div><p className="eyebrow">ACTIVE CATALOG</p><h2>メニュー条件</h2></div><label className="toggle-label"><input type="checkbox" checked={excludeKids} onChange={event => setExcludeKids(event.target.checked)} /> キッズ除外</label></div><p className="hint">無効化された階層・メニューは計算対象から除外されます。プリセットはヘッダーから切り替えできます。</p></section>
    <section className="card"><div className="card-heading"><h2>欲しい単品ベクトル</h2><span className="hint">合計100個まで・端末内計算</span></div><datalist id="item-names">{names.map(name => <option key={name} value={name} />)}</datalist>{items.map((item, index) => <div className="target-row" key={index}><input list="item-names" placeholder="単品名" value={item.name} onChange={event => updateItem(index, 'name', event.target.value)} /><input type="number" min="0" max="100" value={item.count} onChange={event => changeCount(index, event.target.value)} /><button className="secondary" onClick={() => setItems(current => current.filter((_, i) => i !== index))}>削除</button></div>)}<button className="secondary" disabled={items.length >= 100} onClick={() => setItems(current => [...current, { ...emptyTarget }])}>単品を追加</button></section>
    <section className="card action-card"><label><input type="checkbox" checked={exact} onChange={event => setExact(event.target.checked)} /> 完全一致（余りなし）</label><button onClick={solve} disabled={loading}>{loading ? '計算中…' : '最安の組み合わせを計算'}</button>{error && <p className="error-text">{error}</p>}</section>
    <Result result={result} />
  </div>
}

function Result({ result }) {
  if (!result) return <section className="card muted">まだ結果がありません。</section>
  if (result.status !== 'Optimal') return <section className="card error-box"><strong>解なし</strong><p>{result.message || result.status}</p></section>
  return <section className="card"><div className="card-heading"><h2>計算結果</h2><span className="success">最適解</span></div><div className="summary-grid"><div><span>合計金額</span><strong>¥{result.total_price.toLocaleString('ja-JP')}</strong></div><div><span>選択メニュー数</span><strong>{result.selection.length}</strong></div></div><div className="selection-list">{result.selection.map((entry, index) => <article className="selection-card" key={`${entry.name}-${index}`}><div className="selection-head"><div><strong>{entry.name}</strong><small>{entry.count}個</small></div><b>¥{entry.price.toLocaleString('ja-JP')} / 個</b></div><div className="item-breakdown">{Object.entries(entry.items).map(([name, count]) => <div key={name}><span>{name}</span><span>{count} × {entry.count} = {count * entry.count}</span></div>)}</div></article>)}</div></section>
}
