function RecipeCard({ recipe, onClick, onToggleFavorite, onAddToGroceryList, onEdit, collections }) {
  const recipeCollections = collections
    ? collections.filter(c => c.recipeIds && c.recipeIds.includes(recipe.id))
    : []
  return (
    <div className="recipe-card" onClick={onClick}>
      <div className="recipe-card-image">
        {recipe.image ? (
          <img src={recipe.image} alt={recipe.name} className="recipe-card-img" />
        ) : (
          <div className="recipe-card-placeholder">
            <svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/>
            </svg>
          </div>
        )}
      </div>
      <div className="card-body">
        <div className="card-header">
          <h3>{recipe.name}</h3>
          <button
            className={`btn-fav ${recipe.favorite ? 'active' : ''}`}
            onClick={e => { e.stopPropagation(); onToggleFavorite() }}
            title={recipe.favorite ? 'Remove from favorites' : 'Add to favorites'}
          >
            {recipe.favorite ? '\u2665' : '\u2661'}
          </button>
        </div>
        <p className="servings">Servings: {recipe.servings}</p>
        {recipe.category && <span className="category-badge">{recipe.category}</span>}
        {recipe.sourceUrl && <span className="source-badge">Imported from URL</span>}
        {recipeCollections.length > 0 && (
          <div className="card-collections">
            {recipeCollections.slice(0, 2).map(c => (
              <span key={c.id} className="collection-label">{c.name}</span>
            ))}
            {recipeCollections.length > 2 && <span className="collection-label more">+{recipeCollections.length - 2}</span>}
          </div>
        )}
        <div className="card-preview">
          <p className="preview-label">Ingredients</p>
          <ul className="preview-list">
            {recipe.ingredients.slice(0, 4).map(ing => (
              <li key={ing.id}>{ing.name}</li>
            ))}
            {recipe.ingredients.length > 4 && <li className="more">+{recipe.ingredients.length - 4} more</li>}
          </ul>
        </div>
        {recipe.steps.length > 0 && (
          <p className="step-count">{recipe.steps.length} step{recipe.steps.length !== 1 ? 's' : ''}</p>
        )}
        <div className="card-actions">
          <button
            className="btn btn-sm btn-edit"
            onClick={e => { e.stopPropagation(); onEdit() }}
          >
            Edit
          </button>
          <button
            className="btn btn-sm btn-grocery"
            onClick={e => { e.stopPropagation(); onAddToGroceryList() }}
          >
            + Grocery
          </button>
        </div>
      </div>
    </div>
  )
}

export default RecipeCard
