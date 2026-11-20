import { useEffect, useState } from 'react'
import { supabase } from '../supabase'
import { money, moneyRound, date, today, batchNo, saveBlob, STATUS_LABEL } from '../lib/format'
import { buildCardDeck } from '../lib/cardDeck'
import { buildWebUpload } from '../lib/webUpload'
import { useSort } from '../lib/useSort'
import SortTh from '../components/SortTh'

const day = (ts) => (ts ? date(ts.slice(0, 10)) : null)

// plain-English progress for a batch
export function batchStage(b) {
  if (b.status === 'open') return { label: 'Open, Rob is adding', cls: 'at_auction' }
  if (b.printed_at && b.uploaded_at) return { label: 'Done', cls: 'sold' }
  if (b.printed_at) return { label: 'Printed, not uploaded', cls: 'in_stock' }
  if (b.uploaded_at) return { label: 'Uploaded, not printed', cls: 'in_stock' }
  return { label: 'Ready to print and upload', cls: 'flag' }
}

function BatchDetail({ batch, onBack, onOpen, onChanged, refreshKey }) {
  const [items, setItems] = useState([])
  const [b, setB] = useState(batch)
  const [msg, setMsg] = useState(null)
  const [busy, setBusy] = useState(false)
  const { sort, toggle, apply } = useSort('p_code', 'asc')

  const load = async () => {
    const [{ data: it }, { data: bb }] = await Promise.all([
      supabase.from('items').select('*').eq('batch_id', batch.id).order('p_code'),
      supabase.from('batch_list').select('*').eq('id', batch.id).single(),
    ])
    setItems(it || [])
    if (bb) setB(bb)
  }
  useEffect(() => { load() }, [batch.id, refreshKey]) // eslint-disable-line react-hooks/exhaustive-deps

  const name = batchNo(b.id)

  const downloadCards = async () => {
    setBusy(true); setMsg(null)
    try {
      const tpl = await fetch('/card-template.pptx').then((r) => {
        if (!r.ok) throw new Error('card-template.pptx is missing from the public folder')
        return r.arrayBuffer()
      })
      const sorted = [...items].sort((x, y) => x.p_code.localeCompare(y.p_code, 'en-GB', { numeric: true }))
      saveBlob(await buildCardDeck(tpl, sorted), `Stock cards ${name} (${items.length}).pptx`)
      setMsg({ type: 'ok', text: `Cards for ${name} downloaded. Print them, then press “Mark as printed”.` })
    } catch (e) {
      setMsg({ type: 'err', text: 'Couldn’t make the cards: ' + e.message })
    }
    setBusy(false)
  }

  const downloadWeb = () => {
    const sorted = [...items].sort((x, y) => x.p_code.localeCompare(y.p_code, 'en-GB', { numeric: true }))
    saveBlob(buildWebUpload(sorted), `Web Upload ${name} ${today()}.xlsx`)
    setMsg({ type: 'ok', text: `Web upload for ${name} downloaded. Upload it, then press “Mark as uploaded”.` })
  }

  const mark = async (what, on) => {
    setBusy(true)
    const now = on ? new Date().toISOString() : null
    const patch = what === 'printed' ? { printed_at: now } : { uploaded_at: now }
    const printed = what === 'printed' ? on : !!b.printed_at
    const uploaded = what === 'uploaded' ? on : !!b.uploaded_at
    patch.status = printed && uploaded ? 'uploaded' : printed ? 'printed' : 'ready'
    const { error } = await supabase.from('batches').update(patch).eq('id', b.id)
    if (!error && on) {
      const itemPatch = what === 'printed' ? { card_printed: true } : { live_date: today() }
      await supabase.from('items').update(itemPatch).eq('batch_id', b.id)
    }
    setBusy(false)
    if (error) return setMsg({ type: 'err', text: 'Not updated: ' + error.message })
    setMsg({ type: 'ok', text: on ? `${name} marked as ${what}.` : `${name} no longer marked as ${what}.` })
    await load()
    onChanged()
  }

  const stage = batchStage(b)
  const isOpen = b.status === 'open'

  return (
    <>
      <div className="page-head">
        <div>
          <button className="link-btn" onClick={onBack}>All batches</button>
          <h1>Batch {name}</h1>
          <p className="sub"><span className={`pill ${stage.cls}`}>{stage.label}</span> Started {day(b.created_at)}{b.finished_at ? `, finished ${day(b.finished_at)}` : ''}</p>
        </div>
        <div className="btns">
          <button className="btn gold" disabled={busy || !items.length || isOpen} onClick={downloadCards}>Download cards</button>
          <button className="btn gold" disabled={busy || !items.length || isOpen} onClick={downloadWeb}>Download web upload</button>
        </div>
      </div>

      {isOpen && <div className="msg err">This batch is still open. Finish it on the Add stock page before printing or uploading.</div>}
      {msg && <div className={`msg ${msg.type}`}>{msg.text}</div>}

      <div className="totals">
        <div className="total"><b>{items.length}</b><span>Items</span></div>
        <div className="total"><b>{moneyRound(b.retail_total)}</b><span>Retail value</span></div>
        <div className="total"><b>{moneyRound(b.cost_total)}</b><span>Cost</span></div>
        <div className="total">
          <b>{b.printed_at ? day(b.printed_at) : 'Not yet'}</b>
          <span>Cards printed{' '}
            {!isOpen && (b.printed_at
              ? <button className="link-btn" disabled={busy} onClick={() => mark('printed', false)}>Undo</button>
              : <button className="link-btn" disabled={busy} onClick={() => mark('printed', true)}>Mark as printed</button>)}
          </span>
        </div>
        <div className="total">
          <b>{b.uploaded_at ? day(b.uploaded_at) : 'Not yet'}</b>
          <span>Uploaded to web{' '}
            {!isOpen && (b.uploaded_at
              ? <button className="link-btn" disabled={busy} onClick={() => mark('uploaded', false)}>Undo</button>
              : <button className="link-btn" disabled={busy} onClick={() => mark('uploaded', true)}>Mark as uploaded</button>)}
          </span>
        </div>
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <SortTh label="P code" k="p_code" sort={sort} onSort={toggle} />
              <th>Description</th>
              <SortTh label="Country" k="country" sort={sort} onSort={toggle} className="hide-sm" />
              <SortTh label="SG no." k="catalogue_no" sort={sort} onSort={toggle} className="hide-md" />
              <SortTh label="Cost" k="cost" type="num" sort={sort} onSort={toggle} className="hide-sm" />
              <SortTh label="Retail" k="asp" type="num" sort={sort} onSort={toggle} />
              <SortTh label="Status" k="status" sort={sort} onSort={toggle} />
            </tr>
          </thead>
          <tbody>
            {apply(items).map((r) => (
              <tr key={r.p_code} className="click" onClick={() => onOpen(r.p_code)} tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && onOpen(r.p_code)}>
                <td className="pcode">{r.p_code}</td>
                <td className="desc">{r.short_description || r.long_description?.slice(0, 90) || '—'}</td>
                <td className="hide-sm">{r.country || '—'}</td>
                <td className="hide-md">{r.catalogue_no || '—'}</td>
                <td className="num hide-sm">{money(r.cost)}</td>
                <td className="num">{money(r.asp)}</td>
                <td><span className={`pill ${r.status}`}>{STATUS_LABEL[r.status]}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
        {!items.length && <div className="empty">No items in this batch.</div>}
      </div>
    </>
  )
}

export default function Batches({ onOpen, refreshKey, onChanged }) {
  const [rows, setRows] = useState([])
  const [current, setCurrent] = useState(null)
  const [show, setShow] = useState('todo')
  const { sort, toggle, apply } = useSort('id', 'desc')

  useEffect(() => {
    supabase.from('batch_list').select('*').order('id', { ascending: false }).then(({ data }) => setRows(data || []))
  }, [refreshKey, current])

  if (current) return <BatchDetail batch={current} onBack={() => setCurrent(null)} onOpen={onOpen} onChanged={onChanged} refreshKey={refreshKey} />

  const todo = rows.filter((b) => !(b.printed_at && b.uploaded_at))
  const shown = show === 'todo' ? todo : rows

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Batches</h1>
          <p className="sub">Each batch of new stock. Open one to print its cards and download its web upload.</p>
        </div>
      </div>

      <div className="toolbar">
        <div className="seg">
          <button className={show === 'todo' ? 'on' : ''} onClick={() => setShow('todo')}>Still to do ({todo.length})</button>
          <button className={show === 'all' ? 'on' : ''} onClick={() => setShow('all')}>All batches ({rows.length})</button>
        </div>
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <SortTh label="Batch" k="id" type="num" sort={sort} onSort={toggle} />
              <SortTh label="Progress" k="status" sort={sort} onSort={toggle} />
              <SortTh label="Items" k="item_count" type="num" sort={sort} onSort={toggle} />
              <SortTh label="Retail value" k="retail_total" type="num" sort={sort} onSort={toggle} className="hide-sm" />
              <SortTh label="P codes" k="first_p_code" sort={sort} onSort={toggle} className="hide-md" />
              <SortTh label="Finished" k="finished_at" type="date" sort={sort} onSort={toggle} className="hide-sm" />
              <SortTh label="Printed" k="printed_at" type="date" sort={sort} onSort={toggle} className="hide-md" />
              <SortTh label="Uploaded" k="uploaded_at" type="date" sort={sort} onSort={toggle} className="hide-md" />
            </tr>
          </thead>
          <tbody>
            {apply(shown).map((b) => {
              const stage = batchStage(b)
              return (
                <tr key={b.id} className="click" onClick={() => setCurrent(b)} tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && setCurrent(b)}>
                  <td className="pcode">{batchNo(b.id)}</td>
                  <td><span className={`pill ${stage.cls}`}>{stage.label}</span></td>
                  <td className="num">{b.item_count}</td>
                  <td className="num hide-sm">{moneyRound(b.retail_total)}</td>
                  <td className="hide-md">{b.first_p_code ? `${b.first_p_code} to ${b.last_p_code}` : '—'}</td>
                  <td className="hide-sm">{day(b.finished_at) || '—'}</td>
                  <td className="hide-md">{day(b.printed_at) || '—'}</td>
                  <td className="hide-md">{day(b.uploaded_at) || '—'}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
        {!shown.length && <div className="empty">{show === 'todo' ? 'Everything is printed and uploaded.' : 'No batches yet. Start one on the Add stock page.'}</div>}
      </div>
    </>
  )
}
