const ICONS = {
  recipe: <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 2v20M6 2l-3 3m3-3l3 3"/><path d="M15 18h6"/><path d="M18 15v6"/></svg>,
  url: <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>,
  image: <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>,
  text: <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>,
  generate: <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>,
}

export default function FabMenu({ isOpen, onToggle, onOption }) {
  return (
    <>
      {isOpen && <div className="sheet-overlay" onClick={onToggle} />}
      <button className="fab" onClick={onToggle} aria-label="Add recipe">
        <svg
          className={`fab-cross ${isOpen ? 'rotated' : ''}`}
          viewBox="0 0 24 24"
          width="28"
          height="28"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
        >
          <line x1="12" y1="5" x2="12" y2="19" />
          <line x1="5" y1="12" x2="19" y2="12" />
        </svg>
      </button>
      <div className={`bottom-sheet ${isOpen ? 'open' : ''}`}>
        <div className="sheet-handle" />
        <div className="sheet-options">
          <button className="sheet-option" onClick={() => onOption('recipe')}>
            <span className="sheet-option-icon">{ICONS.recipe}</span>
            <span className="sheet-option-label">Add Recipe</span>
          </button>
          <button className="sheet-option" onClick={() => onOption('url')}>
            <span className="sheet-option-icon">{ICONS.url}</span>
            <span className="sheet-option-label">Import URL</span>
          </button>
          <button className="sheet-option" onClick={() => onOption('image')}>
            <span className="sheet-option-icon">{ICONS.image}</span>
            <span className="sheet-option-label">Import Image</span>
          </button>
          <button className="sheet-option" onClick={() => onOption('text')}>
            <span className="sheet-option-icon">{ICONS.text}</span>
            <span className="sheet-option-label">Import Text</span>
          </button>
          <button className="sheet-option" onClick={() => onOption('generate')}>
            <span className="sheet-option-icon">{ICONS.generate}</span>
            <span className="sheet-option-label">Generate Recipe</span>
          </button>
        </div>
      </div>
    </>
  )
}
