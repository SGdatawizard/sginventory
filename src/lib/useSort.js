import { useState } from 'react'

// Click a header once: numbers/dates go high → low, text goes A → Z. Click again to flip.
export function useSort(initialKey, initialDir = 'asc') {
  const [sort, setSort] = useState({ key: initialKey, dir: initialDir })

  const toggle = (key, type = 'text') => {
    setSort((s) =>
      s.key === key
        ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' }
        : { key, dir: type === 'text' ? 'asc' : 'desc' }
    )
  }

  // for lists already loaded in the browser
  const apply = (rows) => {
    const { key, dir } = sort
    if (!key) return rows
    const m = dir === 'asc' ? 1 : -1
    return [...rows].sort((a, b) => {
      const x = a[key], y = b[key]
      const xe = x === null || x === undefined || x === ''
      const ye = y === null || y === undefined || y === ''
      if (xe && ye) return 0
      if (xe) return 1 // blanks always last
      if (ye) return -1
      const xn = Number(x), yn = Number(y)
      if (typeof x !== 'boolean' && !Number.isNaN(xn) && !Number.isNaN(yn) && String(x).trim() !== '' && String(y).trim() !== '') return (xn - yn) * m
      return String(x).localeCompare(String(y), 'en-GB', { numeric: true, sensitivity: 'base' }) * m
    })
  }

  return { sort, toggle, apply }
}
