import { useEffect, useState } from 'react'
import { supabase } from '../supabase'
import { money, today } from '../lib/format'
import { buildCardDeck } from '../lib/cardDeck'
import { useSort } from '../lib/useSort'
import SortTh from '../components/SortTh'

export default function PrintCards({ onOpen, refreshKey, onChanged }) {
  const [rows, setRows] = useState([])
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState(null)
  const [add, setAdd] = useState('')
  const [downloaded, setDownloaded] = useState(false)
  const { sort, toggle, apply } = useSort('p_code', 'asc')

  const load = async () => {
    const { data } = await supabase.from('items').select('*').eq('print_queued', true).order('p_code')
    setRows(data || [])
  }
  useEffect(() => { load() }, [refreshKey])

  const download = async () => {
    setBusy(true)
    setMsg(null)
    try {
      const tpl = await fetch('/card-template.pptx').then((r) => {
        if (!r.ok) throw new Error('card-template.pptx is missing from the public folder')
        return r.arrayBuffer()
      })
      const blob = await buildCardDeck(tpl, apply(rows)) // cards come out in the order shown
      const a = document.createElement('a')
      a.href = URL.createObjectURL(blob)
      a.download = `Stock cards ${today()} (${rows.length}).pptx`
      a.click()
      URL.revokeObjectURL(a.href)
      setDownloaded(true)
      setMsg({ type: 'ok', text: `Downloaded ${rows.length} card${rows.length === 1 ? '' : 's'}. Open it in PowerPoint and print as usual.` })
    } catch (e) {
      setMsg({ type: 'err', text: 'Couldn’t make the cards: ' + e.message })
    }
    setBusy(false)
  }

  const markPrinted = async () => {
    setBusy(true)
    const codes = rows.map((r) => r.p_code)
    const { error } = await supabase.from('items').update({ print_queued: false, card_printed: true, live_date: today() }).in('p_code', codes)
    setBusy(false)
    if (error) return setMsg({ type: 'err', text: 'Not updated: ' + error.message })
    setMsg({ type: 'ok', text: 'Marked as printed and cleared from the list.' })
    setDownloaded(false)
    onChanged()
    load()
  }

  const remove = async (code) => {
    await supabase.from('items').update({ print_queued: false }).eq('p_code', code)
    onChanged()
    load()
  }

  // reprint an existing card by P code
  const addByCode = async (e) => {
    e.preventDefault()
    const code = add.trim()
    if (!code) return
    const { data, error } = await supabase.from('items').update({ print_queued: true }).ilike('p_code', code).select('p_code')
    if (error || !data || !data.length) return setMsg({ type: 'err', text: `${code} wasn’t found.` })
    setAdd('')
    onChanged()
    load()
  }

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Reprint cards</h1>
          <p className="sub">For one-off reprints. New stock is printed from its batch on the Batches page.</p>
        </div>
        <div className="btns">
          <button className="btn gold" disabled={busy || !rows.length} onClick={download}>Download {rows.length || ''} card{rows.length === 1 ? '' : 's'}</button>
          <button className="btn ghost" disabled={busy || !rows.length || !downloaded} onClick={markPrinted} title={downloaded ? '' : 'Download first'}>Mark as printed</button>
        </div>
      </div>

      {msg && <div className={`msg ${msg.type}`}>{msg.text}</div>}

      <form className="toolbar" onSubmit={addByCode}>
        <input value={add} onChange={(e) => setAdd(e.target.value)} placeholder="Type a P code to reprint" aria-label="P code to reprint" style={{ maxWidth: 320 }} />
        <button className="btn ghost">Add to list</button>
      </form>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <SortTh label="P code" k="p_code" sort={sort} onSort={toggle} />
              <SortTh label="Country" k="country" sort={sort} onSort={toggle} />
              <th className="hide-sm">Description on card</th>
              <SortTh label="Price" k="asp" type="num" sort={sort} onSort={toggle} />
              <th />
            </tr>
          </thead>
          <tbody>
            {apply(rows).map((r) => (
              <tr key={r.p_code}>
                <td className="pcode"><button className="link-btn" style={{ opacity: 1, fontWeight: 600 }} onClick={() => onOpen(r.p_code)}>{r.p_code}</button></td>
                <td><b>{r.country || '—'}</b></td>
                <td className="desc hide-sm">{r.long_description ? r.long_description.slice(0, 140) + (r.long_description.length > 140 ? '…' : '') : <span className="pill flag">No description</span>}</td>
                <td className="num">{money(r.asp)}</td>
                <td className="num"><button className="link-btn" onClick={() => remove(r.p_code)}>Remove</button></td>
              </tr>
            ))}
          </tbody>
        </table>
        {!rows.length && <div className="empty">Nothing to reprint. Type a P code above, or use “Add to reprint list” on any item.</div>}
      </div>
    </>
  )
}
