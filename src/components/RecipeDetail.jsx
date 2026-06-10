import { useState } from 'react'

function RecipeDetail({ recipe, onBack, onToggleFavorite, onStartCooking, onDelete, onAddToGroceryList, onEdit, collections, onToggleCollection }) {
  const [showPicker, setShowPicker] = useState(false)
  const recipeCollectionIds = collections
    ? collections.filter(c => c.recipeIds && c.recipeIds.includes(recipe.id)).map(c => c.id)
    : []

  function handleToggle(colId) {
    onToggleCollection(recipe.id, colId)
  }

  return (
    <div className="detail-page">
      <div className="detail-header">
        <button className="btn btn-back" onClick={onBack}>
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
          Back
        </button>
        <button className={`btn-fav large ${recipe.favorite ? 'active' : ''}`} onClick={onToggleFavorite} title="Toggle favorite">
          {recipe.favorite ? '\u2665' : '\u2661'}
        </button>
      </div>

      <div className="detail-image">
        {recipe.image ? (
          <img src={recipe.image} alt={recipe.name} className="detail-img" />
        ) : (
          <div className="detail-img-placeholder">
            <svg viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/>
            </svg>
          </div>
        )}
      </div>

      <div className="detail-content">
        <h1>{recipe.name}</h1>
        <div className="detail-meta">
          <span>Servings: {recipe.servings}</span>
          {recipe.category && <span className="category-badge">{recipe.category}</span>}
        </div>

        {recipeCollectionIds.length > 0 && (
          <div className="detail-collections">
            {collections.filter(c => recipeCollectionIds.includes(c.id)).map(c => (
              <span key={c.id} className="collection-label">{c.name}</span>
            ))}
          </div>
        )}

        <section>
          <h2>Ingredients</h2>
          <ul className="ingredient-list">
            {recipe.ingredients.map(ing => (
              <li key={ing.id}>{ing.name}</li>
            ))}
          </ul>
        </section>

        <section>
          <h2>Steps</h2>
          <ol className="step-list">
            {recipe.steps.map(step => (
              <li key={step.id}>{step.text}</li>
            ))}
          </ol>
        </section>

        {recipe.sourceUrl && (
          <section className="detail-source">
            <h2>Source</h2>
            <a
              href={recipe.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="detail-source-link"
            >
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
              Open Original Recipe
            </a>
          </section>
        )}

        <div className="detail-actions">
          {recipe.steps.length > 0 && (
            <button className="btn btn-primary btn-large" onClick={onStartCooking}>
              Start Cooking
            </button>
          )}
          <button className="btn btn-outline btn-large" onClick={onAddToGroceryList}>
            + Add to Grocery List
          </button>
          <button className="btn btn-outline btn-large" onClick={() => setShowPicker(true)}>
            + Add to Collection
          </button>
          <button className="btn btn-outline btn-large" onClick={onEdit}>
            Edit Recipe
          </button>
          <button className="btn btn-danger" onClick={onDelete}>
            Delete Recipe
          </button>
        </div>
      </div>

      {showPicker && (
        <div className="overlay" onClick={() => setShowPicker(false)}>
          <div className="collection-picker" onClick={e => e.stopPropagation()}>
            <h3>Add to Collection</h3>
            {collections.length === 0 ? (
              <p className="collection-picker-empty">No collections yet. Create one from the Collections tab.</p>
            ) : (
              <div className="collection-picker-list">
                {collections.map(c => {
                  const checked = recipeCollectionIds.includes(c.id)
                  return (
                    <label key={c.id} className="collection-picker-item">
                      <input type="checkbox" checked={checked} onChange={() => handleToggle(c.id)} />
                      <span>{c.name}</span>
                      <span className="collection-picker-count">{c.recipeIds.length}</span>
                    </label>
                  )
                })}
              </div>
            )}
            <button className="btn btn-primary btn-large" onClick={() => setShowPicker(false)}>Done</button>
          </div>
        </div>
      )}
    </div>
  )
}

export default RecipeDetail
