import { useEffect, useState } from 'react'
import { supabase } from '../supabase'
import { money, moneyRound, date, today, STATUS_LABEL, safeTerm } from '../lib/format'

const NEW = { po_number: '', supplier: '', purchase_date: today(), purchase_value: '', notes: '' }

function PurchaseDetail({ po, onBack, onOpen }) {
  const [items, setItems] = useState([])
  useEffect(() => {
    supabase.from('items').select('p_code, short_description, status, quantity, cost, asp, sale_price').eq('purchase_ref', po.po_number).order('p_code')
      .then(({ data }) => setItems(data || []))
  }, [po.po_number])

  const margin = po.sales_total > 0 ? Math.round((po.profit / po.sales_total) * 100) : null

  return (
    <>
      <div className="page-head">
        <div>
          <button className="link-btn" onClick={onBack}>All purchases</button>
          <h1>{po.po_number}</h1>
          <p className="sub">{po.supplier || 'Unknown supplier'}, bought {date(po.purchase_date)}</p>
        </div>
      </div>

      <div className="totals">
        <div className="total"><b>{money(po.purchase_value)}</b><span>Paid</span></div>
        <div className="total"><b>{money(po.sales_total)}</b><span>Sold so far (recorded prices)</span></div>
        <div className="total"><b>{money(po.profit)}</b><span>Profit on those sales{margin !== null ? `, ${margin}% margin` : ''}</span></div>
        <div className="total"><b>{money(po.unsorted_value)}</b><span>Not described yet</span></div>
      </div>
      <div className="totals">
        <div className="total"><b>{po.items_described}</b><span>Items described</span></div>
        <div className="total"><b>{po.items_in_stock}</b><span>Still in stock</span></div>
        <div className="total"><b>{money(po.stock_cost)}</b><span>Stock left at cost</span></div>
        <div className="total"><b>{money(po.stock_retail)}</b><span>Stock left at retail</span></div>
      </div>
      {po.sold_before_system > 0 && <p className="sub">{po.sold_before_system} item{po.sold_before_system === 1 ? ' was' : 's were'} sold before this system, without a price recorded, so they aren’t in the profit figure.</p>}
      {po.notes && <div className="box"><h3>Notes</h3>{po.notes}</div>}

      <div className="table-wrap">
        <table>
          <thead><tr><th>P code</th><th>Description</th><th className="num">Cost</th><th className="num">Retail</th><th className="num">Sold for</th><th>Status</th></tr></thead>
          <tbody>
            {items.map((r) => (
              <tr key={r.p_code} className="click" onClick={() => onOpen(r.p_code)}>
                <td className="pcode">{r.p_code}</td><td className="desc">{r.short_description || '—'}</td>
                <td className="num">{money(r.cost)}</td><td className="num">{money(r.asp)}</td><td className="num">{money(r.sale_price)}</td>
                <td><span className={`pill ${r.status}`}>{STATUS_LABEL[r.status]}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
        {!items.length && <div className="empty">No items described against this purchase yet.</div>}
      </div>
    </>
  )
}

export default function Purchases({ onOpen, refreshKey }) {
  const [rows, setRows] = useState([])
  const [term, setTerm] = useState('')
  const [onlyOpen, setOnlyOpen] = useState(false)
  const [current, setCurrent] = useState(null)
  const [form, setForm] = useState(null)
  const [msg, setMsg] = useState(null)

  const load = async () => {
    let q = supabase.from('purchase_summary').select('*').order('purchase_date', { ascending: false, nullsFirst: false }).limit(300)
    const s = safeTerm(term)
    if (s) q = q.or(`po_number.ilike.%${s}%,supplier.ilike.%${s}%`)
    if (onlyOpen) q = q.gt('unsorted_value', 0)
    const { data } = await q
    setRows(data || [])
  }
  useEffect(() => { load() }, [term, onlyOpen, refreshKey]) // eslint-disable-line react-hooks/exhaustive-deps

  const save = async (e) => {
    e.preventDefault()
    const po = form.po_number.trim().toUpperCase()
    if (!po) return setMsg({ type: 'err', text: 'Enter the NBF number.' })
    const { error } = await supabase.from('purchases').insert({
      po_number: po, supplier: form.supplier || null, purchase_date: form.purchase_date || null,
      purchase_value: form.purchase_value === '' ? null : Number(form.purchase_value), notes: form.notes || null,
    })
    if (error) return setMsg({ type: 'err', text: error.code === '23505' ? `${po} already exists.` : 'Not saved: ' + error.message })
    setMsg({ type: 'ok', text: `${po} added.` })
    setForm(null)
    load()
  }

  if (current) return <PurchaseDetail po={current} onBack={() => setCurrent(null)} onOpen={onOpen} />

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Purchases</h1>
          <p className="sub">Every buy, what it cost, and what it has made back.</p>
        </div>
        {!form && <button className="btn gold" onClick={() => setForm(NEW)}>Add purchase</button>}
      </div>

      {msg && <div className={`msg ${msg.type}`}>{msg.text}</div>}

      {form && (
        <form className="box" onSubmit={save}>
          <h2>New purchase</h2>
          <div className="row">
            <div className="field"><label htmlFor="pn">NBF number</label><input id="pn" value={form.po_number} onChange={(e) => setForm({ ...form, po_number: e.target.value })} placeholder="NBF00147" autoFocus /></div>
            <div className="field"><label htmlFor="ps">Bought from</label><input id="ps" value={form.supplier} onChange={(e) => setForm({ ...form, supplier: e.target.value })} placeholder="Spink" /></div>
            <div className="field"><label htmlFor="pd">Date</label><input id="pd" type="date" value={form.purchase_date} onChange={(e) => setForm({ ...form, purchase_date: e.target.value })} /></div>
            <div className="field"><label htmlFor="pv">Invoice total £</label><input id="pv" type="number" step="0.01" value={form.purchase_value} onChange={(e) => setForm({ ...form, purchase_value: e.target.value })} /></div>
          </div>
          <div className="field"><label htmlFor="pno">Notes</label><input id="pno" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="e.g. 15 mixed lots" /></div>
          <div className="btns"><button className="btn">Save purchase</button><button type="button" className="btn ghost" onClick={() => setForm(null)}>Cancel</button></div>
        </form>
      )}

      <div className="toolbar">
        <input className="search" type="search" value={term} onChange={(e) => setTerm(e.target.value)} placeholder="Search NBF number or supplier" aria-label="Search purchases" />
        <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontWeight: 500, margin: 0 }}>
          <input type="checkbox" checked={onlyOpen} onChange={(e) => setOnlyOpen(e.target.checked)} style={{ width: 'auto' }} />
          Only with stock still to describe
        </label>
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr><th>Purchase</th><th>Supplier</th><th>Date</th><th className="num">Paid</th><th className="num">To describe</th><th className="num">Sold</th><th className="num">Profit</th><th className="num">In stock</th></tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.po_number} className="click" onClick={() => setCurrent(r)} tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && setCurrent(r)}>
                <td className="pcode">{r.po_number}</td><td>{r.supplier || '—'}</td><td>{date(r.purchase_date)}</td>
                <td className="num">{moneyRound(r.purchase_value)}</td>
                <td className="num">{Number(r.unsorted_value) > 0 ? moneyRound(r.unsorted_value) : '—'}</td>
                <td className="num">{moneyRound(r.sales_total)}</td>
                <td className="num">{moneyRound(r.profit)}</td>
                <td className="num">{r.items_in_stock}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!rows.length && <div className="empty">No purchases match.</div>}
      </div>
    </>
  )
}
