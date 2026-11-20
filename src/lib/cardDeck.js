// Builds stock-card PowerPoints exactly as the old "ExcelToPowerPoint" macro did.
// One slide per item, "Title Slide" layout with empty placeholders, then 7 text boxes
// with the macro's positions, sizes and fonts. Uses the team's own card template file
// (public/card-template.pptx) as the base so the theme and slide size are identical.
import JSZip from 'jszip'

const EMU = 12700 // points -> EMU

// [left, top, width, height, fontSize, bold, justified] — copied from the macro (in points)
const BOXES = [
  [0, 75, 1000, 40, 20, false, false],   // A  P code
  [140, 70, 1000, 40, 26, true, false],  // B  Country (bold)
  [100, 150, 750, 40, 20, false, true],  // C  Long description (justified)
  [850, 100, 180, 40, 20, false, false], // D  SG / catalogue number (second line, right)
  [850, 75, 150, 40, 20, false, false],  // E  Condition / type (first line, right)
  [700, 75, 220, 40, 20, false, false],  // F  Price  £0.00
  [0, 100, 200, 40, 20, false, false],   // G  Code initials
]

const TNR = '<a:latin typeface="Times New Roman" panose="02020603050405020304" pitchFamily="18" charset="0"/>' +
            '<a:cs typeface="Times New Roman" panose="02020603050405020304" pitchFamily="18" charset="0"/>'

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

// macro: "£" & Format(value, "0.00")  -> no thousands separator
export function formatCardPrice(v) {
  if (v === null || v === undefined || v === '') return ''
  const n = Number(String(v).replace(/[£,\s]/g, ''))
  return Number.isFinite(n) ? '£' + n.toFixed(2) : String(v)
}

// Rob's sheet stores "SG 169"; older stock-list rows store just "169"
export function catalogueForCard(v) {
  if (v === null || v === undefined || String(v).trim() === '') return ''
  const s = String(v).trim()
  return /^sg\b/i.test(s) ? s : 'SG ' + s
}

// The 7 values printed on a card, in macro column order
export function cardValues(item) {
  return [
    item.p_code,
    item.country,
    item.long_description,
    catalogueForCard(item.catalogue_no),
    item.condition,
    formatCardPrice(item.asp),
    item.code_initials || '',
  ]
}

function textBox(id, col, value) {
  const [l, t, w, h, sz, bold, just] = BOXES[col]
  const text = value === null || value === undefined ? '' : String(value)
  const rPr = `<a:rPr lang="en-GB" sz="${sz * 100}"${bold ? ' b="1"' : ''} dirty="0"><a:solidFill><a:srgbClr val="000000"/></a:solidFill>${TNR}</a:rPr>`
  const pPr = just ? '<a:pPr algn="just"/>' : ''
  const paras = text.split(/\r\n|\r|\n/).map((line) =>
    line
      ? `<a:p>${pPr}<a:r>${rPr}<a:t>${esc(line)}</a:t></a:r></a:p>`
      : `<a:p>${pPr}<a:endParaRPr lang="en-GB" sz="${sz * 100}" dirty="0">${TNR}</a:endParaRPr></a:p>`
  ).join('')
  return `<p:sp><p:nvSpPr><p:cNvPr id="${id}" name="TextBox ${id - 1}"/><p:cNvSpPr txBox="1"/><p:nvPr/></p:nvSpPr>` +
    `<p:spPr><a:xfrm><a:off x="${l * EMU}" y="${t * EMU}"/><a:ext cx="${w * EMU}" cy="${h * EMU}"/></a:xfrm>` +
    `<a:prstGeom prst="rect"><a:avLst/></a:prstGeom><a:noFill/></p:spPr>` +
    `<p:txBody><a:bodyPr wrap="square" rtlCol="0"><a:spAutoFit/></a:bodyPr><a:lstStyle/>${paras}</p:txBody></p:sp>`
}

const SLIDE_HEAD = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\r\n' +
  '<p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">' +
  '<p:cSld><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>' +
  '<p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>' +
  // empty title + subtitle placeholders, exactly as the macro's "layout 1" slide has (they don't print)
  '<p:sp><p:nvSpPr><p:cNvPr id="2" name="Title 1"/><p:cNvSpPr><a:spLocks noGrp="1"/></p:cNvSpPr><p:nvPr><p:ph type="ctrTitle"/></p:nvPr></p:nvSpPr><p:spPr/><p:txBody><a:bodyPr/><a:lstStyle/><a:p><a:endParaRPr lang="en-GB"/></a:p></p:txBody></p:sp>' +
  '<p:sp><p:nvSpPr><p:cNvPr id="3" name="Subtitle 2"/><p:cNvSpPr><a:spLocks noGrp="1"/></p:cNvSpPr><p:nvPr><p:ph type="subTitle" idx="1"/></p:nvPr></p:nvSpPr><p:spPr/><p:txBody><a:bodyPr/><a:lstStyle/><a:p><a:endParaRPr lang="en-GB"/></a:p></p:txBody></p:sp>'
const SLIDE_TAIL = '</p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sld>'
const SLIDE_RELS = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\r\n' +
  '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
  '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout1.xml"/></Relationships>'
const SLIDE_CT = 'application/vnd.openxmlformats-officedocument.presentationml.slide+xml'

function slideXml(item) {
  return SLIDE_HEAD + cardValues(item).map((v, i) => textBox(4 + i, i, v)).join('') + SLIDE_TAIL
}

// templateData: ArrayBuffer/Uint8Array of card-template.pptx. Returns a Blob (browser) or Uint8Array (node).
export async function buildCardDeck(templateData, items, outputType = 'blob') {
  if (!items.length) throw new Error('No items to print')
  const zip = await JSZip.loadAsync(templateData)

  // strip the template's own slide(s) and picture
  Object.keys(zip.files).forEach((p) => {
    if (/^ppt\/slides\//.test(p) || /^ppt\/media\//.test(p)) zip.remove(p)
  })

  let ct = await zip.file('[Content_Types].xml').async('string')
  ct = ct.replace(/<Override PartName="\/ppt\/slides\/slide\d+\.xml"[^>]*\/>/g, '')

  let rels = await zip.file('ppt/_rels/presentation.xml.rels').async('string')
  rels = rels.replace(/<Relationship [^>]*relationships\/slide"[^>]*\/>/g, '')
            .replace(/<Relationship [^>]*Target="slides\/[^"]*"[^>]*\/>/g, '')

  let pres = await zip.file('ppt/presentation.xml').async('string')

  const ids = [], overrides = [], newRels = []
  items.forEach((item, n) => {
    const i = n + 1
    zip.file(`ppt/slides/slide${i}.xml`, slideXml(item))
    zip.file(`ppt/slides/_rels/slide${i}.xml.rels`, SLIDE_RELS)
    overrides.push(`<Override PartName="/ppt/slides/slide${i}.xml" ContentType="${SLIDE_CT}"/>`)
    newRels.push(`<Relationship Id="rIdCard${i}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide${i}.xml"/>`)
    ids.push(`<p:sldId id="${255 + i}" r:id="rIdCard${i}"/>`)
  })

  ct = ct.replace('</Types>', overrides.join('') + '</Types>')
  rels = rels.replace('</Relationships>', newRels.join('') + '</Relationships>')
  pres = pres.replace(/<p:sldIdLst>[\s\S]*?<\/p:sldIdLst>/, `<p:sldIdLst>${ids.join('')}</p:sldIdLst>`)

  zip.file('[Content_Types].xml', ct)
  zip.file('ppt/_rels/presentation.xml.rels', rels)
  zip.file('ppt/presentation.xml', pres)
  zip.remove('docProps/thumbnail.jpeg')
  let rootRels = await zip.file('_rels/.rels').async('string')
  rootRels = rootRels.replace(/<Relationship [^>]*thumbnail[^>]*\/>/, '')
  zip.file('_rels/.rels', rootRels)
  ct = ct.replace(/<Default Extension="jpeg"[^>]*\/>/, '')
  zip.file('[Content_Types].xml', ct)

  // drop bare folder entries (cloud storage / SharePoint dislikes them)
  Object.keys(zip.files).forEach((p) => { if (zip.files[p] && zip.files[p].dir) delete zip.files[p] })

  return zip.generateAsync({
    type: outputType,
    mimeType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    compression: 'DEFLATE',
  })
}
