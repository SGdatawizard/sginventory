// A table header you can click to sort. type: 'text' | 'num' | 'date'
export default function SortTh({ label, k, type = 'text', sort, onSort, className = '' }) {
  const active = sort.key === k
  const arrow = active ? (sort.dir === 'asc' ? '▲' : '▼') : '↕'
  return (
    <th
      className={`${type === 'num' ? 'num' : ''} ${className}`.trim()}
      aria-sort={active ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none'}
    >
      <button type="button" className={`th-btn ${active ? 'on' : ''}`} onClick={() => onSort(k, type)}>
        <span>{label}</span>
        <span className="th-arrow" aria-hidden="true">{arrow}</span>
      </button>
    </th>
  )
}
