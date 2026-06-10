import RecipeCard from './RecipeCard'

function CollectionDetail({ collection, recipes, onBack, onOpenRecipe, onToggleFavorite, onAddToGroceryList, onEdit, collections }) {
  const collectionRecipes = recipes.filter(r => collection.recipeIds.includes(r.id))

  return (
    <div className="collection-detail-page">
      <div className="detail-header">
        <button className="btn btn-back" onClick={onBack}>
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
          Back
        </button>
        <h1>{collection.name}</h1>
      </div>

      {collectionRecipes.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">
            <svg viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
            </svg>
          </div>
          <p className="empty-text">No recipes in this collection yet.</p>
        </div>
      ) : (
        <div className="recipe-grid">
          {collectionRecipes.map(recipe => (
            <RecipeCard
              key={recipe.id}
              recipe={recipe}
              onClick={() => onOpenRecipe(recipe)}
              onToggleFavorite={() => onToggleFavorite(recipe.id)}
              onAddToGroceryList={() => onAddToGroceryList(recipe)}
              onEdit={() => onEdit(recipe)}
              collections={collections}
            />
          ))}
        </div>
      )}
    </div>
  )
}

export default CollectionDetail
