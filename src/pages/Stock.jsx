import { useEffect, useState, useRef } from 'react'
import { supabase } from '../supabase'
import { money, moneyRound, STATUS_LABEL, safeTerm } from '../lib/format'

const LIMIT = 100

export default function Stock({ onOpen, refreshKey }) {
  const [term, setTerm] = useState('')
  const [status, setStatus] = useState('in_stock')
  const [ownership, setOwnership] = useState('all')
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(false)
  const [totals, setTotals] = useState(null)
  const [error, setError] = useState('')
  const timer = useRef()

  useEffect(() => {
    supabase.from('stock_totals').select('*').then(({ data }) => {
      if (!data) return
      const sg = data.find((d) => d.ownership === 'sg_owned') || {}
      const pt = data.find((d) => d.ownership === 'consignment') || {}
      setTotals({ sg, pt })
    })
  }, [refreshKey])

  const search = async (t = term) => {
    setLoading(true)
    setError('')
    let q = supabase
      .from('items')
      .select('p_code, ownership, status, quantity, country, catalogue_no, short_description, asp, cost, needs_check')
      .order('p_code')
      .limit(LIMIT)
    if (status !== 'all') q = q.eq('status', status)
    if (ownership !== 'all') q = q.eq('ownership', ownership)
    const s = safeTerm(t)
    if (s) {
      const like = `%${s}%`
      q = q.or(`p_code.ilike.${like},short_description.ilike.${like},country.ilike.${like},catalogue_no.ilike.${like},purchase_ref.ilike.${like}`)
    }
    const { data, error } = await q
    if (error) setError('Search failed: ' + error.message)
    setRows(data || [])
    setLoading(false)
  }

  // search as you type (short pause), and when filters change
  useEffect(() => {
    clearTimeout(timer.current)
    timer.current = setTimeout(() => search(term), 250)
    return () => clearTimeout(timer.current)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [term, status, ownership, refreshKey])

  // Enter on an exact P code opens it straight away (fast for marking sales)
  const onKey = async (e) => {
    if (e.key !== 'Enter') return
    const code = term.trim().toUpperCase()
    if (!code) return
    const { data } = await supabase.from('items').select('p_code').ilike('p_code', code).limit(1)
    if (data && data.length) onOpen(data[0].p_code)
  }

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Stock</h1>
          <p className="sub">Search by P code, description, country, SG number or purchase. Type a P code and press Enter to open it.</p>
        </div>
      </div>

      {totals && (
        <div className="totals">
          <div className="total"><b>{(totals.sg.items_in_stock || 0).toLocaleString('en-GB')}</b><span>SG-owned items in stock</span></div>
          <div className="total"><b>{moneyRound(totals.sg.stock_cost)}</b><span>Stock at cost</span></div>
          <div className="total"><b>{moneyRound(totals.sg.stock_retail)}</b><span>Stock at retail</span></div>
          <div className="total"><b>{(totals.pt.items_in_stock || 0).toLocaleString('en-GB')}</b><span>Private Treaty items held</span></div>
        </div>
      )}

      <div className="toolbar">
        <input
          className="search"
          type="search"
          placeholder="e.g. P267001897, Penny Black, Falkland"
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          onKeyDown={onKey}
          aria-label="Search stock"
          autoFocus
        />
        <select value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Status">
          <option value="in_stock">In stock</option>
          <option value="at_auction">At auction</option>
          <option value="sold">Sold</option>
          <option value="returned">Returned to vendor</option>
          <option value="all">Any status</option>
        </select>
        <select value={ownership} onChange={(e) => setOwnership(e.target.value)} aria-label="Ownership">
          <option value="all">SG owned and Private Treaty</option>
          <option value="sg_owned">SG owned</option>
          <option value="consignment">Private Treaty</option>
        </select>
      </div>

      {error && <div className="msg err">{error}</div>}

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>P code</th><th>Description</th><th>Country</th><th>SG no.</th>
              <th className="num">Qty</th><th className="num">Cost</th><th className="num">Retail</th><th>Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.p_code} className="click" onClick={() => onOpen(r.p_code)} tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && onOpen(r.p_code)}>
                <td className="pcode">{r.p_code}</td>
                <td className="desc">{r.short_description || '—'}</td>
                <td>{r.country || '—'}</td>
                <td>{r.catalogue_no || '—'}</td>
                <td className="num">{r.quantity}</td>
                <td className="num">{money(r.cost)}</td>
                <td className="num">{money(r.asp)}</td>
                <td>
                  <span className={`pill ${r.status}`}>{STATUS_LABEL[r.status]}</span>{' '}
                  {r.ownership === 'consignment' && <span className="pill cons">PT</span>}{' '}
                  {r.needs_check && <span className="pill flag">Check</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!loading && rows.length === 0 && <div className="empty">Nothing matches. Try fewer words, or set the status filter to “Any status”.</div>}
        {loading && rows.length === 0 && <div className="empty">Searching…</div>}
      </div>
      {rows.length === LIMIT && <p className="sub">Showing the first {LIMIT}. Add more words to narrow it down.</p>}
    </>
  )
}
