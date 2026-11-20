import { useEffect, useState } from 'react'
import { supabase } from '../supabase'
import { money, STATUS_LABEL } from '../lib/format'

// short names for the reasons the import added, so the list can be filtered
const GROUPS = [
  ['missing', "Missing from the stock list", /missing from the stock list/i],
  ['twice', 'Listed twice', /listed twice|appears twice/i],
  ['shared', 'Shared P code', /shares p code|shared by different|same p code|sharing p code/i],
  ['cost', 'Cost or price missing', /cost of £1|no cost|no retail/i],
  ['pt', 'Private Treaty', /private treaty|vendor name|commission/i],
  ['date', 'Odd sale date', /in the future/i],
]

export default function Checks({ onOpen, refreshKey }) {
  const [rows, setRows] = useState([])
  const [group, setGroup] = useState('all')

  useEffect(() => {
    supabase.from('items').select('p_code, status, short_description, cost, asp, check_reasons').eq('needs_check', true).order('p_code').limit(2000)
      .then(({ data }) => setRows(data || []))
  }, [refreshKey])

  const count = (re) => rows.filter((r) => re.test(r.check_reasons || '')).length
  const g = GROUPS.find((x) => x[0] === group)
  const shown = g ? rows.filter((r) => g[2].test(r.check_reasons || '')) : rows

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Needs checking</h1>
          <p className="sub">Items the import wasn’t sure about. Open one, fix anything wrong, then press “Mark as checked”.</p>
        </div>
      </div>

      <div className="toolbar">
        <select value={group} onChange={(e) => setGroup(e.target.value)} aria-label="Reason">
          <option value="all">All reasons ({rows.length})</option>
          {GROUPS.map(([k, label, re]) => <option key={k} value={k}>{label} ({count(re)})</option>)}
        </select>
      </div>

      <div className="table-wrap">
        <table>
          <thead><tr><th>P code</th><th>Description</th><th className="num">Cost</th><th className="num">Retail</th><th>Status</th><th>Why</th></tr></thead>
          <tbody>
            {shown.map((r) => (
              <tr key={r.p_code} className="click" onClick={() => onOpen(r.p_code)} tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && onOpen(r.p_code)}>
                <td className="pcode">{r.p_code}</td>
                <td className="desc">{r.short_description || '—'}</td>
                <td className="num">{money(r.cost)}</td>
                <td className="num">{money(r.asp)}</td>
                <td><span className={`pill ${r.status}`}>{STATUS_LABEL[r.status]}</span></td>
                <td style={{ fontSize: 14, maxWidth: 380 }}>{r.check_reasons}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!shown.length && <div className="empty">Nothing left to check here.</div>}
      </div>
    </>
  )
}
