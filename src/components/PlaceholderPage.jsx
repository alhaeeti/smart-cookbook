const ICONS = {
  url: <svg viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>,
  image: <svg viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>,
  generate: <svg viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>,
}

const TITLES = {
  url: 'Import URL',
  image: 'Import Image',
  generate: 'Generate Recipe',
}

const DESCRIPTIONS = {
  url: 'Import a recipe from any website URL by pasting a link.',
  image: 'Take a photo of a recipe or upload an image to import it.',
  generate: 'Let AI create a custom recipe based on your preferences.',
}

export default function PlaceholderPage({ type, onBack }) {
  return (
    <div className="placeholder-page">
      <div className="placeholder-page-header">
        <button className="btn-back" onClick={onBack}>
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
          Back
        </button>
      </div>
      <div className="placeholder-page-body">
        <div className="placeholder-page-icon">{ICONS[type]}</div>
        <h2 className="placeholder-page-title">{TITLES[type]}</h2>
        <p className="placeholder-page-desc">{DESCRIPTIONS[type]}</p>
        <span className="placeholder-page-badge">Coming Soon</span>
      </div>
    </div>
  )
}
