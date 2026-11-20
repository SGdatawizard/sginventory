import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../supabase'
import { money, batchNo } from '../lib/format'

const BLANK = {
  p_code: '', ownership: 'sg_owned', purchase_ref: '', country: '', territory: '', sub_territory: '',
  catalogue_no: '', condition: '', stamp_type: '', monarch: '', qv_category: '',
  short_description: '', long_description: '', cost: '', asp: '', location: '', code_initials: '',
  vendor: '', commission: '', min_price: '',
}
const FIELDS = Object.keys(BLANK)

// turn a saved item back into form values
const toForm = (item) => {
  const f = { ...BLANK }
  FIELDS.forEach((k) => (f[k] = item[k] === null || item[k] === undefined ? '' : String(item[k])))
  if (item.commission !== null && item.commission !== undefined) f.commission = String(Math.round(item.commission * 10000) / 100)
  return f
}

export default function AddStock({ onSaved, onOpen }) {
  const [batch, setBatch] = useState(undefined) // undefined = loading, null = none open
  const [batchItems, setBatchItems] = useState([])
  const [f, setF] = useState(BLANK)
  const [editing, setEditing] = useState(null) // P code being edited, or null when adding
  const [lookups, setLookups] = useState({})
  const [countries, setCountries] = useState([])
  const [purchases, setPurchases] = useState([])
  const [po, setPo] = useState(null)
  const [msg, setMsg] = useState(null)
  const [busy, setBusy] = useState(false)
  const [exists, setExists] = useState(false)

  const nextCode = async () => {
    const { data } = await supabase.rpc('next_p_code')
    return data || ''
  }

  const loadBatch = useCallback(async () => {
    const { data: b } = await supabase.from('batches').select('*').eq('status', 'open').maybeSingle()
    setBatch(b || null)
    if (b) {
      const { data } = await supabase.from('items').select('*').eq('batch_id', b.id).order('created_at', { ascending: false })
      setBatchItems(data || [])
    } else setBatchItems([])
  }, [])

  useEffect(() => {
    loadBatch()
    nextCode().then((c) => setF((cur) => (cur.p_code ? cur : { ...cur, p_code: c })))
    supabase.from('lookups').select('kind, value').order('sort_order').then(({ data }) => {
      const g = {}
      ;(data || []).forEach((r) => (g[r.kind] = [...(g[r.kind] || []), r.value]))
      setLookups(g)
    })
    supabase.from('country_list').select('country').order('country').then(({ data }) => setCountries((data || []).map((r) => r.country)))
    supabase.from('purchases').select('po_number, supplier, purchase_date').order('purchase_date', { ascending: false, nullsFirst: false }).limit(300)
      .then(({ data }) => setPurchases(data || []))
  }, [loadBatch])

  // what's left to describe on the chosen purchase
  useEffect(() => {
    if (!f.purchase_ref) return setPo(null)
    supabase.from('purchase_summary').select('*').eq('po_number', f.purchase_ref).maybeSingle().then(({ data }) => setPo(data))
  }, [f.purchase_ref, batchItems])

  // warn as soon as a new P code is already taken
  useEffect(() => {
    const code = f.p_code.trim()
    if (editing || code.length < 5) return setExists(false)
    const t = setTimeout(async () => {
      const { data } = await supabase.from('items').select('p_code').eq('p_code', code).maybeSingle()
      setExists(!!data)
    }, 300)
    return () => clearTimeout(t)
  }, [f.p_code, editing])

  const set = (k) => (e) => setF({ ...f, [k]: e.target.value })
  const isGB = /great britain|^gb$/i.test(f.country.trim())
  const isPT = f.ownership === 'consignment'

  // ---------- batch ----------
  const startBatch = async () => {
    setBusy(true)
    const { error } = await supabase.from('batches').insert({})
    setBusy(false)
    if (error) return setMsg({ type: 'err', text: 'Couldn’t start a batch: ' + error.message })
    setMsg(null)
    await loadBatch()
    onSaved()
  }

  const finishBatch = async () => {
    if (!batchItems.length) {
      if (!window.confirm('This batch is empty. Close it without saving anything?')) return
      await supabase.from('batches').delete().eq('id', batch.id)
    } else {
      if (!window.confirm(`Finish ${batchNo(batch.id)} with ${batchItems.length} item${batchItems.length === 1 ? '' : 's'}? It will move to Batches, ready to print.`)) return
      const { error } = await supabase.from('batches').update({ status: 'ready', finished_at: new Date().toISOString() }).eq('id', batch.id)
      if (error) return setMsg({ type: 'err', text: 'Couldn’t finish the batch: ' + error.message })
      setMsg({ type: 'ok', text: `${batchNo(batch.id)} finished. Print the cards and download the web upload from the Batches page.` })
    }
    setEditing(null)
    await loadBatch()
    onSaved()
  }

  // ---------- items ----------
  const buildRow = () => {
    const num = (v) => (v === '' || v === null ? null : Number(v))
    const row = {}
    FIELDS.forEach((k) => (row[k] = f[k] === '' ? null : f[k]))
    row.p_code = f.p_code.trim()
    row.country = f.country.trim().toUpperCase() || null
    row.cost = num(f.cost)
    row.asp = num(f.asp)
    row.min_price = num(f.min_price)
    row.commission = f.commission === '' ? null : Number(f.commission) / 100
    row.department = isGB ? 'Great Britain' : 'Commonwealth'
    if (po) row.supplier = po.supplier
    if (isPT) { row.cost = null; row.purchase_ref = null } else { row.vendor = null; row.commission = null; row.min_price = null }
    if (!isGB) row.qv_category = null
    return row
  }

  const save = async (duplicate) => {
    setMsg(null)
    const code = f.p_code.trim()
    if (!code) return setMsg({ type: 'err', text: 'Enter a P code.' })
    if (exists) return setMsg({ type: 'err', text: `${code} is already in the system. Use a different P code.` })
    if (!f.long_description.trim()) return setMsg({ type: 'err', text: 'Add the long description. It’s what prints on the card.' })

    const row = buildRow()
    setBusy(true)
    let error
    if (editing) {
      delete row.p_code
      ;({ error } = await supabase.from('items').update(row).eq('p_code', editing))
    } else {
      ;({ error } = await supabase.from('items').insert({
        ...row, batch_id: batch.id, status: 'in_stock', quantity: 1, print_queued: false, source: 'Added in SG Stock',
      }))
    }
    setBusy(false)
    if (error) return setMsg({ type: 'err', text: 'Not saved: ' + error.message })

    setMsg({ type: 'ok', text: editing ? `${editing} updated.` : `${code} saved to ${batchNo(batch.id)}.` })
    setEditing(null)
    await loadBatch()
    onSaved()
    const next = await nextCode()
    setF(duplicate ? { ...f, p_code: next } : { ...BLANK, p_code: next })
    document.getElementById('as-pcode')?.focus()
  }

  const duplicateItem = async (item) => {
    setEditing(null)
    setMsg({ type: 'ok', text: `Copied from ${item.p_code}. Check the details, then save.` })
    setF({ ...toForm(item), p_code: await nextCode() })
    document.getElementById('as-pcode')?.focus()
  }

  const editItem = (item) => {
    setEditing(item.p_code)
    setMsg({ type: 'ok', text: `Editing ${item.p_code}. Save changes when you’re done.` })
    setF(toForm(item))
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const deleteItem = async (item) => {
    if (!window.confirm(`Delete ${item.p_code} from this batch? This removes it completely.`)) return
    const { error } = await supabase.from('items').delete().eq('p_code', item.p_code)
    if (error) return setMsg({ type: 'err', text: 'Couldn’t delete: ' + error.message })
    setMsg({ type: 'ok', text: `${item.p_code} deleted.` })
    if (editing === item.p_code) setEditing(null)
    await loadBatch()
    onSaved()
  }

  const clearForm = async () => {
    setEditing(null)
    setMsg(null)
    setF({ ...BLANK, p_code: await nextCode() })
  }

  const opts = (kind) => (lookups[kind] || []).map((v) => <option key={v} value={v}>{v}</option>)

  if (batch === undefined) return <p className="sub">Loading…</p>

  // ---------- no open batch ----------
  if (!batch) {
    return (
      <>
        <div className="page-head"><div><h1>Add stock</h1><p className="sub">Stock is added in batches. Start one, add the stamps, then finish it.</p></div></div>
        {msg && <div className={`msg ${msg.type}`}>{msg.text}</div>}
        <div className="box start-batch">
          <h2>No batch open</h2>
          <p className="sub" style={{ marginBottom: 16 }}>Start a batch to begin adding stock. Everything you add goes into it until you finish it.</p>
          <button className="btn gold" onClick={startBatch} disabled={busy}>Start a new batch</button>
        </div>
      </>
    )
  }

  // ---------- form + batch list ----------
  return (
    <>
      <div className="page-head">
        <div>
          <h1>{editing ? `Editing ${editing}` : 'Add stock'}</h1>
          <p className="sub">Adding to batch {batchNo(batch.id)}.</p>
        </div>
      </div>

      {msg && <div className={`msg ${msg.type}`}>{msg.text}</div>}

      <div className="as-layout">
        <form className="box as-form" onSubmit={(e) => { e.preventDefault(); save(false) }}>
          <div className="as-grid">
            {/* row 1 */}
            <div className="field">
              <label htmlFor="as-pcode">P code</label>
              <input id="as-pcode" value={f.p_code} onChange={set('p_code')} disabled={!!editing} />
            </div>
            <div className="field">
              <label>Owned by</label>
              <div className="seg">
                <button type="button" className={!isPT ? 'on' : ''} onClick={() => setF({ ...f, ownership: 'sg_owned' })}>SG</button>
                <button type="button" className={isPT ? 'on' : ''} onClick={() => setF({ ...f, ownership: 'consignment' })}>Private Treaty</button>
              </div>
            </div>
            {!isPT ? (
              <div className="field">
                <label htmlFor="po">Purchase <span className="hint">(NBF)</span></label>
                <input id="po" list="po-list" value={f.purchase_ref} onChange={(e) => setF({ ...f, purchase_ref: e.target.value.toUpperCase() })} placeholder="NBF00146" />
                <datalist id="po-list">{purchases.map((p) => <option key={p.po_number} value={p.po_number}>{p.supplier}</option>)}</datalist>
              </div>
            ) : (
              <div className="field"><label htmlFor="ve">Vendor</label><input id="ve" value={f.vendor} onChange={set('vendor')} /></div>
            )}
            <div className="field">
              <label htmlFor="ct">Country <span className="hint">(bold on card)</span></label>
              <input id="ct" list="country-list" value={f.country} onChange={set('country')} placeholder="GREAT BRITAIN" />
              <datalist id="country-list">{countries.map((c) => <option key={c} value={c} />)}</datalist>
            </div>
            <div className="field"><label htmlFor="te">Territory</label><select id="te" value={f.territory} onChange={set('territory')}><option value="">—</option>{opts('territory')}</select></div>
            <div className="field"><label htmlFor="st">Sub-territory</label><select id="st" value={f.sub_territory} onChange={set('sub_territory')}><option value="">—</option>{opts('sub_territory')}</select></div>

            {exists && <div className="msg err span-all">That P code is already in use. <button type="button" className="link-btn" onClick={() => onOpen(f.p_code.trim())}>Open it</button></div>}
            {!isPT && po && (
              <p className="sub span-all as-po">
                {po.supplier}: paid {money(po.purchase_value)}, described so far {money(po.cost_described)}, left to describe {money(po.unsorted_value)}
              </p>
            )}
            {!isPT && f.purchase_ref && !po && <p className="sub span-all as-po">Not a known purchase yet. Add it on the Purchases page so costs can be tracked.</p>}

            {/* row 2 */}
            <div className="field"><label htmlFor="sg">SG number</label><input id="sg" value={f.catalogue_no} onChange={set('catalogue_no')} placeholder="SG 169" /></div>
            <div className="field"><label htmlFor="cn">Condition</label><select id="cn" value={f.condition} onChange={set('condition')}><option value="">—</option>{opts('condition')}</select></div>
            <div className="field"><label htmlFor="ty">Stamp type</label><select id="ty" value={f.stamp_type} onChange={set('stamp_type')}><option value="">—</option>{opts('stamp_type')}</select></div>
            <div className="field"><label htmlFor="mo">Monarch</label><select id="mo" value={f.monarch} onChange={set('monarch')}><option value="">—</option>{opts('monarch')}</select></div>
            <div className="field">
              <label htmlFor="qv">QV category <span className="hint">(GB only)</span></label>
              <select id="qv" value={f.qv_category} onChange={set('qv_category')} disabled={!isGB}><option value="">—</option>{opts('qv_category')}</select>
            </div>
            <div className="field"><label htmlFor="lo">Location</label><input id="lo" value={f.location} onChange={set('location')} /></div>

            {/* row 3 */}
            <div className={`field ${isPT ? 'span-2' : 'span-3'}`}>
              <label htmlFor="sd">Short description <span className="hint">(website and search)</span></label>
              <input id="sd" value={f.short_description} onChange={set('short_description')} />
            </div>
            {!isPT
              ? <div className="field"><label htmlFor="cs">Cost £</label><input id="cs" type="number" step="0.01" value={f.cost} onChange={set('cost')} /></div>
              : <div className="field"><label htmlFor="co">Commission %</label><input id="co" type="number" step="0.5" value={f.commission} onChange={set('commission')} placeholder="15" /></div>}
            <div className="field"><label htmlFor="as">Retail price £</label><input id="as" type="number" step="0.01" value={f.asp} onChange={set('asp')} /></div>
            {isPT && <div className="field"><label htmlFor="mp">Minimum price £</label><input id="mp" type="number" step="0.01" value={f.min_price} onChange={set('min_price')} /></div>}
            <div className="field"><label htmlFor="ci">Code initials <span className="hint">(card)</span></label><input id="ci" value={f.code_initials} onChange={set('code_initials')} /></div>

            {!isPT && po && f.cost !== '' && !editing && Number(f.cost) > Number(po.unsorted_value || 0) && (
              <div className="msg err span-all">This cost is more than what’s left to describe on {po.po_number} ({money(po.unsorted_value)}). Check the cost or the purchase.</div>
            )}

            {/* row 4 */}
            <div className="field span-all">
              <label htmlFor="ld">Long description <span className="hint">(prints on the card)</span></label>
              <textarea id="ld" rows={4} value={f.long_description} onChange={set('long_description')} />
            </div>
          </div>

          <div className="btns">
            {editing ? (
              <>
                <button type="submit" className="btn gold" disabled={busy}>Save changes</button>
                <button type="button" className="btn ghost" onClick={clearForm}>Cancel editing</button>
              </>
            ) : (
              <>
                <button type="submit" className="btn gold" disabled={busy}>Save to batch</button>
                <button type="button" className="btn" disabled={busy} onClick={() => save(true)}>Save and duplicate</button>
                <button type="button" className="btn ghost" onClick={clearForm}>Clear</button>
              </>
            )}
          </div>
        </form>

        <aside className="box as-batch" aria-label={`Batch ${batchNo(batch.id)}`}>
          <div className="as-batch-head">
            <div>
              <h2 style={{ margin: 0 }}>{batchNo(batch.id)}</h2>
              <p className="sub" style={{ margin: 0 }}>{batchItems.length} item{batchItems.length === 1 ? '' : 's'} so far</p>
            </div>
            <button className="btn small gold" onClick={finishBatch}>Finish batch</button>
          </div>
          <ul className="as-list">
            {batchItems.map((it) => (
              <li key={it.p_code} className={editing === it.p_code ? 'on' : ''}>
                <div className="as-li-top">
                  <b>{it.p_code}</b>
                  <span>{money(it.asp)}</span>
                </div>
                <div className="as-li-desc">{it.country ? it.country + ', ' : ''}{it.short_description || it.long_description?.slice(0, 60) || '—'}</div>
                <div className="as-li-acts">
                  <button className="link-btn" onClick={() => editItem(it)}>Edit</button>
                  <button className="link-btn" onClick={() => duplicateItem(it)}>Duplicate</button>
                  <button className="link-btn" onClick={() => deleteItem(it)}>Delete</button>
                </div>
              </li>
            ))}
          </ul>
          {!batchItems.length && <p className="sub">Nothing in this batch yet.</p>}
        </aside>
      </div>
    </>
  )
}
