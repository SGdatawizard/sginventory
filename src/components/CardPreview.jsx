import { cardValues } from '../lib/cardDeck'

// Same boxes as the printed card (points on a 960 x 540 slide): left, top, width, size, bold, justified
const BOXES = [
  [0, 75, 1000, 20, false, false],
  [140, 70, 1000, 26, true, false],
  [100, 150, 750, 20, false, true],
  [850, 100, 180, 20, false, false],
  [850, 75, 150, 20, false, false],
  [700, 75, 220, 20, false, false],
  [0, 100, 200, 20, false, false],
]

export default function CardPreview({ item }) {
  const values = cardValues(item)
  return (
    <div>
      <div className="card-preview" aria-label="Stock card preview">
        {BOXES.map(([l, t, w, sz, bold, just], i) =>
          values[i] ? (
            <div
              key={i}
              className="cb"
              style={{
                left: `${(l / 960) * 100}%`,
                top: `${(t / 540) * 100}%`,
                width: `${(w / 960) * 100}%`,
                fontSize: `calc(100cqw * ${sz} / 960)`,
                fontWeight: bold ? 700 : 400,
                textAlign: just ? 'justify' : 'left',
              }}
            >
              {values[i]}
            </div>
          ) : null
        )}
      </div>
      <div className="card-caption">Preview. The printed card comes from the PowerPoint download, which matches the old macro exactly.</div>
    </div>
  )
}
