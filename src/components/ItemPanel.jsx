import { useEffect, useState } from 'react'
import { supabase } from '../supabase'
import { money, date, today, STATUS_LABEL, batchNo } from '../lib/format'
import CardPreview from './CardPreview'
import SortTh from './SortTh'
import { useSort } from '../lib/useSort'

const EDITABLE = [
  ['short_description', 'Short description'], ['country', 'Country'], ['catalogue_no', 'SG / catalogue no.'],
  ['condition', 'Condition'], ['stamp_type', 'Stamp type'], ['territory', 'Territory'], ['sub_territory', 'Sub-territory'],
  ['monarch', 'Monarch'], ['cost', 'Cost £'], ['asp', 'Retail price £'], ['purchase_ref', 'Purchase (PO)'],
  ['location', 'Location'], ['code_initials', 'Code initials (on card)'], ['vendor', 'Vendor (Private Treaty)'],
  ['min_price', 'Minimum price £ (Private Treaty)'],
]
const NUMERIC = ['cost', 'asp', 'min_price']

export default function ItemPanel({ pCode, onClose, onChanged }) {
  const [item, setItem] = useState(null)
  const [sales, setSales] = useState([])
  const [msg, setMsg] = useState(null)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState({})
  const [sell, setSell] = useState(null)
  const [busy, setBusy] = useState(false)
  const { sort, toggle, apply } = useSort('sale_date', 'desc')

  const load = async () => {
    const [{ data: it, error }, { data: s }] = await Promise.all([
      supabase.from('items').select('*').eq('p_code', pCode).single(),
      supabase.from('sales').select('*').eq('p_code', pCode).order('sale_date', { ascending: false }),
    ])
    if (error) setMsg({ type: 'err', text: 'Couldn’t load ' + pCode + ': ' + error.message })
    setItem(it)
    setSales(s || [])
  }

  useEffect(() => { load() }, [pCode]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const esc = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', esc)
    return () => window.removeEventListener('keydown', esc)
  }, [onClose])

  const update = async (patch, okText) => {
    setBusy(true)
    const { error } = await supabase.from('items').update(patch).eq('p_code', pCode)
    setBusy(false)
    if (error) return setMsg({ type: 'err', text: 'Not saved: ' + error.message })
    setMsg({ type: 'ok', text: okText })
    await load()
    onChanged()
  }

  const startSell = () =>
    setSell({ quantity: 1, price: item.asp ?? '', ref: '', date: today(), channel: item.status === 'at_auction' ? 'auction' : 'retail' })

  const confirmSell = async () => {
    setBusy(true)
    const { error } = await supabase.rpc('record_sale', {
      p_p_code: pCode,
      p_quantity: Number(sell.quantity) || 1,
      p_price: sell.price === '' ? null : Number(sell.price),
      p_ref: sell.ref || null,
      p_date: sell.date || null,
      p_channel: sell.channel,
    })
    setBusy(false)
    if (error) return setMsg({ type: 'err', text: 'Sale not recorded: ' + error.message })
    setSell(null)
    setMsg({ type: 'ok', text: 'Sale recorded.' })
    await load()
    onChanged()
  }

  const undo = async (id) => {
    if (!window.confirm('Undo this sale and put the item back into stock?')) return
    const { error } = await supabase.rpc('undo_sale', { p_sale_id: id })
    if (error) return setMsg({ type: 'err', text: 'Couldn’t undo: ' + error.message })
    setMsg({ type: 'ok', text: 'Sale undone. The item is back in stock.' })
    await load()
    onChanged()
  }

  const saveEdit = async () => {
    const patch = {}
    EDITABLE.forEach(([k]) => {
      let v = draft[k]
      if (v === '' || v === undefined) v = null
      if (v !== null && NUMERIC.includes(k)) v = Number(v)
      patch[k] = v
    })
    patch.long_description = draft.long_description || null
    await update(patch, 'Changes saved.')
    setEditing(false)
  }

  if (!item) {
    return (
      <>
        <div className="scrim" onClick={onClose} />
        <aside className="panel" aria-label="Item">{msg ? <div className={`msg ${msg.type}`}>{msg.text}</div> : 'Loading…'}</aside>
      </>
    )
  }

  const canSell = item.status === 'in_stock' || item.status === 'at_auction'
  const legacySold = item.status === 'sold' && sales.length === 0

  return (
    <>
      <div className="scrim" onClick={onClose} />
      <aside className="panel" role="dialog" aria-label={`Item ${item.p_code}`}>
        <div className="panel-head">
          <div>
            <h1>{item.p_code}</h1>
            <p className="sub">
              <span className={`pill ${item.status}`}>{STATUS_LABEL[item.status]}</span>{' '}
              {item.ownership === 'consignment' && <span className="pill cons">Private Treaty</span>}{' '}
              {item.quantity > 1 && <span>{item.quantity.toLocaleString('en-GB')} left</span>}
            </p>
          </div>
          <button className="close" onClick={onClose} aria-label="Close">×</button>
        </div>

        {msg && <div className={`msg ${msg.type}`}>{msg.text}</div>}

        {item.needs_check && (
          <div className="box flagged">
            <h3>Needs checking</h3>
            <p style={{ margin: '0 0 12px' }}>{item.check_reasons}</p>
            <button className="btn small" disabled={busy} onClick={() => update({ needs_check: false }, 'Marked as checked.')}>Mark as checked</button>
          </div>
        )}

        {/* ----- sell ----- */}
        {canSell && !sell && (
          <div className="btns" style={{ marginBottom: 16 }}>
            <button className="btn gold" onClick={startSell}>Mark as sold</button>
            {item.status === 'in_stock'
              ? <button className="btn ghost" disabled={busy} onClick={() => update({ status: 'at_auction' }, 'Sent to auction.')}>Send to auction</button>
              : <button className="btn ghost" disabled={busy} onClick={() => update({ status: 'in_stock' }, 'Back in stock.')}>Back from auction unsold</button>}
            <button className="btn ghost" disabled={busy} onClick={() => update({ print_queued: !item.print_queued }, item.print_queued ? 'Removed from reprint list.' : 'Added to reprint list.')}>
              {item.print_queued ? 'Remove from reprint list' : 'Add to reprint list'}
            </button>
          </div>
        )}

        {sell && (
          <div className="box sell">
            <h3>Record sale</h3>
            <div className="row">
              {item.quantity > 1 && (
                <div className="field">
                  <label htmlFor="sq">How many <span className="hint">(of {item.quantity})</span></label>
                  <input id="sq" type="number" min="1" max={item.quantity} value={sell.quantity} onChange={(e) => setSell({ ...sell, quantity: e.target.value })} />
                </div>
              )}
              <div className="field">
                <label htmlFor="sp">Sold for £ <span className="hint">(total)</span></label>
                <input id="sp" type="number" step="0.01" value={sell.price} onChange={(e) => setSell({ ...sell, price: e.target.value })} autoFocus />
              </div>
              <div className="field">
                <label htmlFor="sr">Sale ref</label>
                <input id="sr" value={sell.ref} placeholder="e.g. ISG-1702" onChange={(e) => setSell({ ...sell, ref: e.target.value })} />
              </div>
              <div className="field">
                <label htmlFor="sd">Date</label>
                <input id="sd" type="date" value={sell.date} onChange={(e) => setSell({ ...sell, date: e.target.value })} />
              </div>
              <div className="field">
                <label htmlFor="sc">Sold through</label>
                <select id="sc" value={sell.channel} onChange={(e) => setSell({ ...sell, channel: e.target.value })}>
                  <option value="retail">Retail</option>
                  <option value="auction">Auction</option>
                </select>
              </div>
            </div>
            <div className="btns">
              <button className="btn gold" disabled={busy} onClick={confirmSell}>Record sale</button>
              <button className="btn ghost" onClick={() => setSell(null)}>Cancel</button>
            </div>
          </div>
        )}

        {/* ----- sales history ----- */}
        {sales.length > 0 && (
          <div className="box">
            <h3>Sales</h3>
            <table>
              <thead>
                <tr>
                  <SortTh label="Date" k="sale_date" type="date" sort={sort} onSort={toggle} />
                  <SortTh label="Ref" k="sale_ref" sort={sort} onSort={toggle} />
                  <SortTh label="Through" k="channel" sort={sort} onSort={toggle} />
                  <SortTh label="Qty" k="quantity" type="num" sort={sort} onSort={toggle} />
                  <SortTh label="Price" k="sale_price" type="num" sort={sort} onSort={toggle} />
                  <th />
                </tr>
              </thead>
              <tbody>
                {apply(sales).map((s) => (
                  <tr key={s.id}>
                    <td>{date(s.sale_date)}</td><td>{s.sale_ref || '—'}</td><td>{s.channel === 'auction' ? 'Auction' : 'Retail'}</td>
                    <td className="num">{s.quantity}</td><td className="num">{money(s.sale_price)}</td>
                    <td className="num"><button className="link-btn" onClick={() => undo(s.id)}>Undo</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {legacySold && (
          <div className="box">
            <h3>Sold before this system</h3>
            <p style={{ margin: '0 0 10px' }}>Ref {item.sale_ref || '—'} on {date(item.sale_date)}. No sale price was recorded in the old sheets.</p>
            <button className="btn small ghost" disabled={busy} onClick={() => update({ status: 'in_stock', quantity: 1, sale_ref: null, sale_date: null }, 'Put back into stock.')}>
              This wasn’t sold, put it back in stock
            </button>
          </div>
        )}

        {/* ----- card ----- */}
        <div className="box">
          <h3>Stock card</h3>
          <CardPreview item={item} />
        </div>

        {/* ----- details ----- */}
        <div className="box">
          <div className="panel-head" style={{ marginBottom: 12 }}>
            <h3 style={{ margin: 0 }}>Details</h3>
            {!editing
              ? <button className="btn small ghost" onClick={() => { setDraft({ ...item }); setEditing(true) }}>Edit</button>
              : <div className="btns"><button className="btn small" disabled={busy} onClick={saveEdit}>Save changes</button><button className="btn small ghost" onClick={() => setEditing(false)}>Cancel</button></div>}
          </div>

          {!editing ? (
            <>
              <dl className="facts">
                {EDITABLE.map(([k, label]) => {
                  const v = item[k]
                  if (v === null || v === '' || v === undefined) return null
                  return (
                    <div key={k}>
                      <dt>{label}</dt>
                      <dd>{NUMERIC.includes(k) ? money(v) : v}</dd>
                    </div>
                  )
                })}
                {item.batch_id && <div><dt>Batch</dt><dd>{batchNo(item.batch_id)}</dd></div>}
                {item.written_down && <div><dt>Cost note</dt><dd>Written down to £1</dd></div>}
                {item.commission !== null && item.commission !== undefined && <div><dt>Commission</dt><dd>{Math.round(item.commission * 100)}%</dd></div>}
                {item.commission_note && <div><dt>Commission (£)</dt><dd>{item.commission_note}</dd></div>}
              </dl>
              {item.long_description && <p className="desc" style={{ marginBottom: 0 }}>{item.long_description}</p>}
            </>
          ) : (
            <>
              <div className="row">
                {EDITABLE.map(([k, label]) => (
                  <div className="field" key={k}>
                    <label htmlFor={'e-' + k}>{label}</label>
                    <input id={'e-' + k} type={NUMERIC.includes(k) ? 'number' : 'text'} step="0.01" value={draft[k] ?? ''} onChange={(e) => setDraft({ ...draft, [k]: e.target.value })} />
                  </div>
                ))}
              </div>
              <div className="field">
                <label htmlFor="e-long">Long description <span className="hint">(printed on the card)</span></label>
                <textarea id="e-long" value={draft.long_description ?? ''} onChange={(e) => setDraft({ ...draft, long_description: e.target.value })} />
              </div>
            </>
          )}
        </div>

        <p className="sub" style={{ fontSize: 13 }}>Imported from: {item.source || 'added in this system'}</p>
      </aside>
    </>
  )
}
