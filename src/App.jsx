import { useEffect, useState, useCallback } from 'react'
import { supabase } from './supabase'
import Stock from './pages/Stock'
import AddStock from './pages/AddStock'
import PrintCards from './pages/PrintCards'
import Purchases from './pages/Purchases'
import Checks from './pages/Checks'
import Batches from './pages/Batches'
import ItemPanel from './components/ItemPanel'

const PAGES = [
  ['stock', 'Stock'],
  ['add', 'Add stock'],
  ['batches', 'Batches'],
  ['print', 'Reprint cards'],
  ['purchases', 'Purchases'],
  ['checks', 'Needs checking'],
]

function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    setBusy(true)
    setError('')
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) setError('That email and password combination didn’t work. Check both and try again.')
    setBusy(false)
  }

  return (
    <div className="login">
      <form onSubmit={submit}>
        <h1>SG Stock</h1>
        <p className="sub" style={{ marginBottom: 20 }}>Sign in with the team login.</p>
        {error && <div className="msg err">{error}</div>}
        <div className="field">
          <label htmlFor="em">Email</label>
          <input id="em" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" required />
        </div>
        <div className="field">
          <label htmlFor="pw">Password</label>
          <input id="pw" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required />
        </div>
        <button className="btn" style={{ width: '100%' }} disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>
      </form>
    </div>
  )
}

export default function App() {
  const [session, setSession] = useState(undefined)
  const [page, setPage] = useState('stock')
  const [openCode, setOpenCode] = useState(null)
  const [counts, setCounts] = useState({ print: 0, checks: 0, batches: 0 })
  const [refreshKey, setRefreshKey] = useState(0)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => sub.subscription.unsubscribe()
  }, [])

  const loadCounts = useCallback(async () => {
    const [p, c, b] = await Promise.all([
      supabase.from('items').select('p_code', { count: 'exact', head: true }).eq('print_queued', true),
      supabase.from('items').select('p_code', { count: 'exact', head: true }).eq('needs_check', true),
      supabase.from('batches').select('id', { count: 'exact', head: true }).in('status', ['ready', 'printed']),
    ])
    setCounts({ print: p.count || 0, checks: c.count || 0, batches: b.count || 0 })
  }, [])

  useEffect(() => { if (session) loadCounts() }, [session, loadCounts, refreshKey])

  // anything that changes an item calls this so lists and counts refresh
  const changed = () => setRefreshKey((k) => k + 1)

  if (session === undefined) return null
  if (!session) return <Login />

  const navCount = { print: counts.print, checks: counts.checks, batches: counts.batches }

  return (
    <div className="shell">
      <nav className="side" aria-label="Main">
        <div className="brand">SG Stock<small>Stamp stock and purchases</small></div>
        {PAGES.map(([key, label]) => (
          <button key={key} className={`nav-btn ${page === key ? 'active' : ''}`} onClick={() => setPage(key)} aria-current={page === key ? 'page' : undefined}>
            <span>{label}</span>
            {navCount[key] > 0 && <span className="nav-count">{navCount[key].toLocaleString('en-GB')}</span>}
          </button>
        ))}
        <div className="side-foot">
          <button className="link-btn" onClick={() => supabase.auth.signOut()}>Sign out</button>
        </div>
      </nav>

      <main className="main">
        {page === 'stock' && <Stock onOpen={setOpenCode} refreshKey={refreshKey} />}
        {page === 'add' && <AddStock onSaved={changed} onOpen={setOpenCode} />}
        {page === 'batches' && <Batches onOpen={setOpenCode} refreshKey={refreshKey} onChanged={changed} />}
        {page === 'print' && <PrintCards onOpen={setOpenCode} refreshKey={refreshKey} onChanged={changed} />}
        {page === 'purchases' && <Purchases onOpen={setOpenCode} refreshKey={refreshKey} />}
        {page === 'checks' && <Checks onOpen={setOpenCode} refreshKey={refreshKey} />}
      </main>

      {openCode && <ItemPanel pCode={openCode} onClose={() => setOpenCode(null)} onChanged={changed} />}
    </div>
  )
}
