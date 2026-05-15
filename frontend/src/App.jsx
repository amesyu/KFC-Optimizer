import React, {useState} from 'react'
import menuNamesJson from './assets/menu_names.json'

export default function App(){
  const [menuFile, setMenuFile] = useState('lunch')
  const [excludeKids, setExcludeKids] = useState(false)
  const [items, setItems] = useState([{name:'', count:1}])
  const [exact, setExact] = useState(false)
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)

  function updateItem(i, key, val){
    const copy = items.slice(); copy[i] = {...copy[i], [key]: val}; setItems(copy)
  }
  function addItem(){ setItems([...items, {name:'', count:1}]) }
  function removeItem(i){ setItems(items.filter((_,idx)=>idx!==i)) }

  function formatCount(value){
    return new Intl.NumberFormat('ja-JP').format(value)
  }

  function renderResult(){
    if(!result) return <p className="result-empty">まだ結果がありません。</p>

    if(result.error){
      return (
        <div className="result-error">
          <div className="result-title">エラー</div>
          <pre>{JSON.stringify(result, null, 2)}</pre>
        </div>
      )
    }

    if(result.status !== 'Optimal'){
      return (
        <div className="result-error">
          <div className="result-title">解なし / 未最適</div>
          <pre>{JSON.stringify(result, null, 2)}</pre>
        </div>
      )
    }

    return (
      <div className="result-wrap">
        <div className="result-summary">
          <div className="summary-pill success">最適解</div>
          <div className="summary-grid">
            <div className="summary-card">
              <div className="summary-label">合計金額</div>
              <div className="summary-value">¥{formatCount(result.total_price)}</div>
            </div>
            <div className="summary-card">
              <div className="summary-label">選択メニュー数</div>
              <div className="summary-value">{formatCount(result.selection?.length || 0)}</div>
            </div>
          </div>
        </div>

        <div className="result-section">
          <div className="section-title">選択結果</div>
          <div className="selection-list">
            {(result.selection || []).map((entry, idx) => (
              <article className="selection-card" key={idx}>
                <div className="selection-head">
                  <div>
                    <div className="selection-name">{entry.name}</div>
                    <div className="selection-meta">{formatCount(entry.count)} 個</div>
                  </div>
                  <div className="selection-price">¥{formatCount(entry.price)} / 個</div>
                </div>

                <div className="item-breakdown">
                  {Object.entries(entry.items || {}).map(([itemName, qty]) => {
                    const totalQty = qty * entry.count
                    return (
                      <div className="item-row" key={itemName}>
                        <span className="item-name">{itemName}</span>
                        <span className="item-value">{qty} × {formatCount(entry.count)} = {formatCount(totalQty)}</span>
                      </div>
                    )
                  })}
                </div>
              </article>
            ))}
          </div>
        </div>
      </div>
    )
  }

  async function solve(){
    const target = {}
    items.forEach(it=>{ if(it.name && it.count>0) target[it.name]= (target[it.name]||0)+Number(it.count) })
    const payload = { menu_file: menuFile, exclude_kids: excludeKids, target, exact }
    setLoading(true)
    try{
      const res = await fetch('/solve', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(payload) })
      const ct = res.headers.get('content-type') || ''
      let data
      if(ct.includes('application/json')){
        try{
          data = await res.json()
        }catch(e){
          const txt = await res.text()
          data = { error: 'Invalid JSON response', status: res.status, body: txt }
        }
      }else{
        const txt = await res.text()
        data = { error: 'Non-JSON response', status: res.status, body: txt }
      }
      setResult(data)
    }catch(e){ setResult({error: String(e)}) }
    setLoading(false)
  }

  return (
    <div className="app">
      <header><h1>KFC LP Solver</h1></header>
      <main>
        <section className="card">
          <h2>メニュー</h2>
          <div className="row">
            <label style={{marginRight:8}}>組み込みメニュー：</label>
            <label>
              <input type="radio" name="menuFile" value="lunch" checked={menuFile==='lunch'} onChange={()=>setMenuFile('lunch')} /> ランチ（〜15:00）
            </label>
            <label style={{marginLeft:12}}>
              <input type="radio" name="menuFile" value="normal" checked={menuFile==='normal'} onChange={()=>setMenuFile('normal')} /> ディナー（15:00〜）
            </label>
          </div>
        </section>

        <section className="card">
          <h2>欲しい個数</h2>
          <datalist id="menu-names">
            {menuNamesJson.items.map((n,idx)=>(<option key={idx} value={n} />))}
          </datalist>
          {items.map((it,i)=> (
            <div className="target-row" key={i}>
              <input list="menu-names" placeholder="メニュー名" value={it.name} onChange={e=>updateItem(i,'name',e.target.value)} />
              <input type="number" min="0" value={it.count} onChange={e=>updateItem(i,'count',e.target.value)} />
              <button onClick={()=>removeItem(i)}>Remove</button>
            </div>
          ))}
          <div className="actions">
            <button onClick={addItem}>Add item</button>
          </div>
        </section>

        <section className="card">
          <div className="row">
            <label style={{display:'inline-flex',alignItems:'center',marginRight:16}}>
              <input type="checkbox" checked={exact} onChange={e=>setExact(e.target.checked)} style={{marginRight:8}} /> 完全一致
            </label>
            <label style={{display:'inline-flex',alignItems:'center'}}>
              <input type="checkbox" checked={excludeKids} onChange={e=>setExcludeKids(e.target.checked)} style={{marginRight:8}} /> キッズセット除外
            </label>
          </div>
          <div className="actions">
            <button onClick={solve} disabled={loading}>{loading? '計算中...':'計算'}</button>
          </div>
        </section>

        <section className="card">
          <h2>Result</h2>
          {renderResult()}
        </section>
      </main>
    </div>
  )
}
