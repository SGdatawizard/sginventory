import { useEffect, useState } from 'react'
import { supabase } from '../supabase'
import { money } from '../lib/format'
import CardPreview from '../components/CardPreview'

const BLANK = {
  p_code: '', ownership: 'sg_owned', purchase_ref: '', country: '', territory: '', sub_territory: '',
  catalogue_no: '', condition: '', stamp_type: '', monarch: '', qv_category: '',
  short_description: '', long_description: '', cost: '', asp: '', location: '', code_initials: '',
  vendor: '', commission: '', min_price: '',
}
// kept when you choose "Save and add another" — usually the same for a batch from one purchase
const CARRY = ['ownership', 'purchase_ref', 'country', 'territory', 'sub_territory', 'location', 'vendor', 'commission', 'code_initials']

export default function AddStock({ onSaved, onOpen }) {
  const [f, setF] = useState(BLANK)
  const [lookups, setLookups] = useState({})
  const [countries, setCountries] = useState([])
  const [purchases, setPurchases] = useState([])
  const [po, setPo] = useState(null)
  const [queue, setQueue] = useState(true)
  const [msg, setMsg] = useState(null)
  const [busy, setBusy] = useState(false)
  const [exists, setExists] = useState(false)

  useEffect(() => {
    supabase.from('lookups').select('kind, value').order('sort_order').then(({ data }) => {
      const g = {}
      ;(data || []).forEach((r) => (g[r.kind] = [...(g[r.kind] || []), r.value]))
      setLookups(g)
    })
    supabase.from('country_list').select('country').order('country').then(({ data }) => setCountries((data || []).map((r) => r.country)))
    supabase.from('purchases').select('po_number, supplier, purchase_date').order('purchase_date', { ascending: false, nullsFirst: false }).limit(300)
      .then(({ data }) => setPurchases(data || []))
  }, [])

  // live summary of the chosen purchase so Rob can see what's left to describe
  useEffect(() => {
    if (!f.purchase_ref) return setPo(null)
    supabase.from('purchase_summary').select('*').eq('po_number', f.purchase_ref).maybeSingle().then(({ data }) => setPo(data))
  }, [f.purchase_ref, msg])

  // warn as soon as the P code is already taken
  useEffect(() => {
    const code = f.p_code.trim()
    if (code.length < 5) return setExists(false)
    const t = setTimeout(async () => {
      const { data } = await supabase.from('items').select('p_code').eq('p_code', code).maybeSingle()
      setExists(!!data)
    }, 300)
    return () => clearTimeout(t)
  }, [f.p_code])

  const set = (k) => (e) => setF({ ...f, [k]: e.target.value })
  const isGB = /great britain|^gb$/i.test(f.country.trim())
  const isPT = f.ownership === 'consignment'

  const save = async (another) => {
    setMsg(null)
    const code = f.p_code.trim()
    if (!code) return setMsg({ type: 'err', text: 'Enter a P code.' })
    if (exists) return setMsg({ type: 'err', text: `${code} is already in the system. Use a different P code, or open the existing one.` })
    if (!f.long_description.trim()) return setMsg({ type: 'err', text: 'Add the long description. It’s what prints on the card.' })

    const num = (v) => (v === '' ? null : Number(v))
    const row = {
      ...f,
      p_code: code,
      country: f.country.trim().toUpperCase() || null,
      cost: num(f.cost), asp: num(f.asp), min_price: num(f.min_price),
      commission: f.commission === '' ? null : Number(f.commission) / 100,
      status: 'in_stock', quantity: 1, print_queued: queue,
      department: isGB ? 'Great Britain' : 'Commonwealth',
      supplier: po ? po.supplier : null,
      source: 'Added in SG Stock',
    }
    Object.keys(row).forEach((k) => { if (row[k] === '') row[k] = null })
    if (!isPT) { row.vendor = null; row.commission = null; row.min_price = null }

    setBusy(true)
    const { error } = await supabase.from('items').insert(row)
    setBusy(false)
    if (error) return setMsg({ type: 'err', text: 'Not saved: ' + error.message })

    setMsg({ type: 'ok', text: `${code} saved${queue ? ' and added to the print list' : ''}.` })
    onSaved()
    if (another) {
      const keep = {}
      CARRY.forEach((k) => (keep[k] = f[k]))
      setF({ ...BLANK, ...keep })
    } else {
      setF(BLANK)
    }
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const opts = (kind) => (lookups[kind] || []).map((v) => <option key={v} value={v}>{v}</option>)

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Add stock</h1>
          <p className="sub">One item at a time. The card preview updates as you type.</p>
        </div>
      </div>

      {msg && <div className={`msg ${msg.type}`}>{msg.text}</div>}

      <div className="two-col">
        <form onSubmit={(e) => { e.preventDefault(); save(true) }}>
          <fieldset>
            <legend>Item</legend>
            <div className="row">
              <div className="field">
                <label htmlFor="pc">P code</label>
                <input id="pc" value={f.p_code} onChange={set('p_code')} placeholder="P267001898" autoFocus />
                {exists && (
                  <div className="msg err" style={{ marginTop: 6 }}>
                    Already in use. <button type="button" className="link-btn" onClick={() => onOpen(f.p_code.trim())}>Open it</button>
                  </div>
                )}
              </div>
              <div className="field">
                <label>Owned by</label>
                <div className="seg">
                  <button type="button" className={!isPT ? 'on' : ''} onClick={() => setF({ ...f, ownership: 'sg_owned' })}>SG owned</button>
                  <button type="button" className={isPT ? 'on' : ''} onClick={() => setF({ ...f, ownership: 'consignment' })}>Private Treaty</button>
                </div>
              </div>
            </div>

            {!isPT && (
              <div className="field">
                <label htmlFor="po">Purchase <span className="hint">(NBF number)</span></label>
                <input id="po" list="po-list" value={f.purchase_ref} onChange={(e) => setF({ ...f, purchase_ref: e.target.value.toUpperCase() })} placeholder="NBF00146" />
                <datalist id="po-list">
                  {purchases.map((p) => <option key={p.po_number} value={p.po_number}>{p.supplier}</option>)}
                </datalist>
                {po && (
                  <p className="sub" style={{ fontSize: 14 }}>
                    {po.supplier} · paid {money(po.purchase_value)} · described so far {money(po.cost_described)} · left to describe {money(po.unsorted_value)}
                  </p>
                )}
                {f.purchase_ref && !po && <p className="sub" style={{ fontSize: 14 }}>Not a known purchase yet. Add it on the Purchases page so costs can be tracked.</p>}
              </div>
            )}

            {isPT && (
              <div className="row">
                <div className="field"><label htmlFor="ve">Vendor</label><input id="ve" value={f.vendor} onChange={set('vendor')} /></div>
                <div className="field"><label htmlFor="co">Commission %</label><input id="co" type="number" step="0.5" value={f.commission} onChange={set('commission')} placeholder="15" /></div>
                <div className="field"><label htmlFor="mp">Minimum price £</label><input id="mp" type="number" step="0.01" value={f.min_price} onChange={set('min_price')} /></div>
              </div>
            )}
          </fieldset>

          <fieldset>
            <legend>Where it’s from</legend>
            <div className="row">
              <div className="field">
                <label htmlFor="ct">Country <span className="hint">(prints in bold)</span></label>
                <input id="ct" list="country-list" value={f.country} onChange={set('country')} placeholder="GREAT BRITAIN" />
                <datalist id="country-list">{countries.map((c) => <option key={c} value={c} />)}</datalist>
              </div>
              <div className="field">
                <label htmlFor="te">Territory</label>
                <select id="te" value={f.territory} onChange={set('territory')}><option value="">—</option>{opts('territory')}</select>
              </div>
              <div className="field">
                <label htmlFor="st">Sub-territory</label>
                <select id="st" value={f.sub_territory} onChange={set('sub_territory')}><option value="">—</option>{opts('sub_territory')}</select>
              </div>
            </div>
          </fieldset>

          <fieldset>
            <legend>Description</legend>
            <div className="row">
              <div className="field">
                <label htmlFor="sg">SG number</label>
                <input id="sg" value={f.catalogue_no} onChange={set('catalogue_no')} placeholder="SG 169" />
              </div>
              <div className="field">
                <label htmlFor="cn">Condition</label>
                <select id="cn" value={f.condition} onChange={set('condition')}><option value="">—</option>{opts('condition')}</select>
              </div>
              <div className="field">
                <label htmlFor="ty">Stamp type</label>
                <select id="ty" value={f.stamp_type} onChange={set('stamp_type')}><option value="">—</option>{opts('stamp_type')}</select>
              </div>
              <div className="field">
                <label htmlFor="mo">Monarch</label>
                <select id="mo" value={f.monarch} onChange={set('monarch')}><option value="">—</option>{opts('monarch')}</select>
              </div>
              {isGB && (
                <div className="field">
                  <label htmlFor="qv">QV category</label>
                  <select id="qv" value={f.qv_category} onChange={set('qv_category')}><option value="">—</option>{opts('qv_category')}</select>
                </div>
              )}
            </div>
            <div className="field">
              <label htmlFor="sd">Short description <span className="hint">(for the website and search)</span></label>
              <input id="sd" value={f.short_description} onChange={set('short_description')} placeholder="Great Britain SG 169 Cover 1881 2d blue registered envelope" />
            </div>
            <div className="field">
              <label htmlFor="ld">Long description <span className="hint">(prints on the card)</span></label>
              <textarea id="ld" value={f.long_description} onChange={set('long_description')} />
            </div>
          </fieldset>

          <fieldset>
            <legend>Price</legend>
            <div className="row">
              {!isPT && <div className="field"><label htmlFor="cs">Cost £</label><input id="cs" type="number" step="0.01" value={f.cost} onChange={set('cost')} /></div>}
              <div className="field"><label htmlFor="as">Retail price £</label><input id="as" type="number" step="0.01" value={f.asp} onChange={set('asp')} /></div>
              <div className="field"><label htmlFor="lo">Location</label><input id="lo" value={f.location} onChange={set('location')} /></div>
              <div className="field"><label htmlFor="ci">Code initials <span className="hint">(on card)</span></label><input id="ci" value={f.code_initials} onChange={set('code_initials')} /></div>
            </div>
            {po && f.cost !== '' && Number(f.cost) > Number(po.unsorted_value || 0) && (
              <div className="msg err">This cost is more than what’s left to describe on {po.po_number} ({money(po.unsorted_value)}). Check the cost or the purchase.</div>
            )}
          </fieldset>

          <div className="field">
            <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontWeight: 500 }}>
              <input type="checkbox" checked={queue} onChange={(e) => setQueue(e.target.checked)} style={{ width: 'auto' }} />
              Add to the print list
            </label>
          </div>

          <div className="btns">
            <button type="submit" className="btn gold" disabled={busy}>Save and add another</button>
            <button type="button" className="btn ghost" disabled={busy} onClick={() => save(false)}>Save and clear</button>
          </div>
        </form>

        <div className="sticky">
          <h2>Card</h2>
          <CardPreview item={{ ...f, country: f.country.toUpperCase() }} />
        </div>
      </div>
    </>
  )
}
