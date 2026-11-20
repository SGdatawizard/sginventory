// Builds the website upload spreadsheet in the same layout as the team's weekly
// "Web Upload" files: 12 columns, exact header names (trailing spaces included).
import * as XLSX from 'xlsx'

const HEADERS = [
  'P code', 'Country Code', 'Territory', 'Sub-Territory', 'Long Description ', 'Short Description',
  'Catalogue No. ', 'ASP ', 'Condition', 'Stamp Type (Specimen, proof etc.) ', 'Monarch', 'QV Cats (GB Only)',
]
const GBP = '_-[$£-809]* #,##0_-;\\-[$£-809]* #,##0_-;_-[$£-809]* "-"??_-;_-@_-'

const v = (x) => (x === null || x === undefined || x === '' ? null : x)

export function buildWebUpload(items) {
  const rows = items.map((i) => [
    v(i.p_code), v(i.country), v(i.territory), v(i.sub_territory), v(i.long_description), v(i.short_description),
    v(i.catalogue_no), i.asp === null || i.asp === undefined || i.asp === '' ? null : Number(i.asp),
    v(i.condition), v(i.stamp_type), v(i.monarch), v(i.qv_category),
  ])
  const ws = XLSX.utils.aoa_to_sheet([HEADERS, ...rows])
  // ASP column (H) as £ like the original files
  for (let r = 2; r <= rows.length + 1; r++) {
    const cell = ws['H' + r]
    if (cell && cell.t === 'n') cell.z = GBP
  }
  ws['!cols'] = [12, 18, 16, 16, 60, 45, 14, 10, 12, 16, 18, 16].map((wch) => ({ wch }))
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Sheet1')
  const out = XLSX.write(wb, { bookType: 'xlsx', type: 'array' })
  return new Blob([out], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
}
