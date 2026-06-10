import { useState, useEffect } from 'react'
import RecipeForm from './components/RecipeForm'
import RecipeCard from './components/RecipeCard'
import RecipeDetail from './components/RecipeDetail'
import CookingMode from './components/CookingMode'
import GroceryList from './components/GroceryList'
import ImportRecipe from './components/ImportRecipe'
import BottomNav from './components/BottomNav'
import FabMenu from './components/FabMenu'
import MealPlanner from './components/MealPlanner'
import PlaceholderPage from './components/PlaceholderPage'
import ImportUrl from './components/ImportUrl'
import CollectionDetail from './components/CollectionDetail'
import GenerateRecipe from './components/GenerateRecipe'
import ImportImage from './components/ImportImage'
import ConfirmDialog from './components/ConfirmDialog'
import Toast from './components/Toast'
import './App.css'

function migrateRecipe(r) {
  const steps = Array.isArray(r.steps)
    ? r.steps
    : typeof r.steps === 'string'
      ? r.steps.split('\n').filter(Boolean).map((text, i) => ({ id: i, text: text.trim() }))
      : []
  const ingredients = Array.isArray(r.ingredients) ? r.ingredients : typeof r.ingredients === 'string'
    ? r.ingredients.split('\n').filter(Boolean).map((name, i) => ({ id: i, name: name.trim() }))
    : []
  return {
    ...r,
    favorite: r.favorite ?? false,
    category: r.category ?? '',
    image: r.image || '',
    ingredients: ingredients.map(i => ({ id: i.id, name: i.name || i.original || '' })),
    steps,
  }
}

function categorizeIngredient(name) {
  const n = name.toLowerCase()
  const meat = ['chicken', 'beef', 'pork', 'lamb', 'turkey', 'fish', 'shrimp', 'salmon', 'tuna', 'meat', 'sausage', 'bacon', 'ham', 'duck', 'steak', 'mince', 'ground', 'breast', 'thigh', 'fillet', 'rib', 'roast']
  if (meat.some(k => n.includes(k))) return 'Meat'
  const dairy = ['milk', 'cheese', 'yogurt', 'cream', 'butter', 'egg', 'eggs', 'ghee', 'paneer', 'sour cream', 'cream cheese', 'buttermilk', 'curd', 'ricotta', 'mozzarella', 'cheddar', 'parmesan']
  if (dairy.some(k => n.includes(k))) return 'Dairy'
  const grains = ['rice', 'pasta', 'bread', 'flour', 'oat', 'oats', 'cereal', 'quinoa', 'couscous', 'barley', 'noodle', 'noodles', 'spaghetti', 'tortilla', 'bun', 'buns', 'dough', 'polenta', 'ramen', 'wheat']
  if (grains.some(k => n.includes(k))) return 'Grains'
  const produce = ['onion', 'garlic', 'tomato', 'lettuce', 'carrot', 'potato', 'apple', 'banana', 'spinach', 'broccoli', 'pepper', 'cucumber', 'lemon', 'lime', 'avocado', 'mushroom', 'cabbage', 'celery', 'zucchini', 'eggplant', 'cauliflower', 'kale', 'parsley', 'cilantro', 'basil', 'mint', 'green onion', 'shallot', 'leek', 'radish', 'beet', 'sweet potato', 'pumpkin', 'corn', 'peas', 'bean', 'beans', 'asparagus', 'ginger', 'chili', 'strawberry', 'blueberry', 'mango', 'pineapple', 'orange', 'grape', 'watermelon', 'peach', 'pear', 'cherry', 'kiwi', 'coconut', 'raisin', 'fresh']
  if (produce.some(k => n.includes(k))) return 'Produce'
  const spices = ['salt', 'pepper', 'cumin', 'paprika', 'turmeric', 'cinnamon', 'clove', 'nutmeg', 'cardamom', 'coriander', 'chili powder', 'garlic powder', 'onion powder', 'bay leaf', 'oregano', 'thyme', 'rosemary', 'sage', 'curry', 'masala', 'saffron', 'vanilla', 'mustard', 'vinegar', 'soy sauce', 'hot sauce', 'ketchup', 'mayonnaise', 'olive oil', 'vegetable oil', 'cooking oil', 'sesame oil']
  if (spices.some(k => n.includes(k))) return 'Spices'
  return 'Other'
}

const CATEGORIES = ['Breakfast', 'Lunch', 'Dinner', 'Dessert', 'Drinks']

function App() {
  const [recipes, setRecipes] = useState(() => {
    try {
      const saved = localStorage.getItem('recipes')
      return saved ? JSON.parse(saved).map(migrateRecipe) : []
    } catch { return [] }
  })
  const [groceryItems, setGroceryItems] = useState(() => {
    try {
      const saved = localStorage.getItem('groceryList')
      return saved ? JSON.parse(saved) : []
    } catch { return [] }
  })
  const [collections, setCollections] = useState(() => {
    try {
      const saved = localStorage.getItem('collections')
      return saved ? JSON.parse(saved) : []
    } catch { return [] }
  })
  const [mealPlan, setMealPlan] = useState(() => {
    try {
      const saved = localStorage.getItem('mealPlan')
      return saved ? JSON.parse(saved) : {}
    } catch { return {} }
  })
  const [darkMode, setDarkMode] = useState(() => {
    try { return localStorage.getItem('darkMode') === 'true' } catch { return false }
  })
  const [view, setView] = useState('home')
  const [selectedRecipe, setSelectedRecipe] = useState(null)
  const [showForm, setShowForm] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('')
  const [showFavorites, setShowFavorites] = useState(false)
  const [importData, setImportData] = useState(null)
  const [editingRecipe, setEditingRecipe] = useState(null)
  const [activeTab, setActiveTab] = useState('recipes')
  const [showFabMenu, setShowFabMenu] = useState(false)
  const [placeholderType, setPlaceholderType] = useState('url')
  const [showCollectionForm, setShowCollectionForm] = useState(false)
  const [newCollectionName, setNewCollectionName] = useState('')
  const [selectedCollection, setSelectedCollection] = useState(null)
  const [confirmDelete, setConfirmDelete] = useState(null)
  const [toast, setToast] = useState({ message: '', visible: false })
  const [installPrompt, setInstallPrompt] = useState(null)
  let toastTimer = null

  function showToast(message) {
    setToast({ message, visible: true })
    if (toastTimer) clearTimeout(toastTimer)
    toastTimer = setTimeout(() => setToast({ message: '', visible: false }), 2000)
  }

  useEffect(() => { localStorage.setItem('recipes', JSON.stringify(recipes)) }, [recipes])
  useEffect(() => { localStorage.setItem('groceryList', JSON.stringify(groceryItems)) }, [groceryItems])
  useEffect(() => { localStorage.setItem('collections', JSON.stringify(collections)) }, [collections])
  useEffect(() => { localStorage.setItem('mealPlan', JSON.stringify(mealPlan)) }, [mealPlan])
  useEffect(() => {
    localStorage.setItem('darkMode', darkMode)
    document.documentElement.setAttribute('data-theme', darkMode ? 'dark' : 'light')
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', darkMode ? '#0b0b0f' : '#22c55e')
  }, [darkMode])

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', darkMode ? 'dark' : 'light')
  }, [])

  useEffect(() => {
    function handler(e) { e.preventDefault(); setInstallPrompt(e) }
    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  function handleInstallClick() {
    if (!installPrompt) return
    installPrompt.prompt()
    installPrompt.userChoice.then(() => setInstallPrompt(null))
  }

  function addRecipe(recipe) {
    setRecipes([recipe, ...recipes])
  }

  function deleteRecipe(id) {
    const recipe = recipes.find(r => r.id === id)
    if (recipe) setConfirmDelete(recipe)
  }

  function confirmDeleteRecipe() {
    if (!confirmDelete) return
    setRecipes(recipes.filter(r => r.id !== confirmDelete.id))
    setGroceryItems(groceryItems.filter(item => item.recipeId !== confirmDelete.id))
    setCollections(collections.map(c => ({ ...c, recipeIds: c.recipeIds.filter(rid => rid !== confirmDelete.id) })))
    setView('home')
    setSelectedRecipe(null)
    setConfirmDelete(null)
    showToast('Recipe deleted')
  }

  function toggleFavorite(id) {
    setRecipes(recipes.map(r => r.id === id ? { ...r, favorite: !r.favorite } : r))
  }

  function openDetail(recipe) {
    setSelectedRecipe(recipe)
    setView('detail')
  }

  function startCooking(recipe) {
    setSelectedRecipe(recipe)
    setView('cooking')
  }

  function handleEdit(recipe) {
    setEditingRecipe(recipe)
    setShowForm(true)
    setView('home')
  }

  function updateRecipe(updatedRecipe) {
    const oldRecipe = recipes.find(r => r.id === updatedRecipe.id)
    setRecipes(recipes.map(r => r.id === updatedRecipe.id ? updatedRecipe : r))
    if (oldRecipe) {
      const oldNames = oldRecipe.ingredients.map(i => i.name)
      const newNames = updatedRecipe.ingredients.map(i => i.name)
      const keptNames = newNames.filter(n => oldNames.includes(n))
      const removedNames = oldNames.filter(n => !newNames.includes(n))
      const addedNames = newNames.filter(n => !oldNames.includes(n))
      setGroceryItems(prev => {
        let updated = prev.filter(item =>
          !(item.recipeId === updatedRecipe.id && removedNames.includes(item.name))
        )
        const existNames = updated.filter(item => item.recipeId === updatedRecipe.id).map(item => item.name)
        const newItems = addedNames.filter(n => !existNames.includes(n)).map(n => ({
          id: Date.now() + Math.random(),
          name: n,
          category: categorizeIngredient(n),
          checked: false,
          recipeName: updatedRecipe.name,
          recipeId: updatedRecipe.id,
        }))
        updated = updated.map(item =>
          item.recipeId === updatedRecipe.id && keptNames.includes(item.name)
            ? { ...item, recipeName: updatedRecipe.name } : item
        )
        return [...updated, ...newItems]
      })
    }
  }

  function addToGroceryList(recipe) {
    const newItems = recipe.ingredients.map(ing => ({
      id: Date.now() + Math.random(),
      name: ing.name,
      category: categorizeIngredient(ing.name),
      checked: false,
      recipeName: recipe.name,
      recipeId: recipe.id,
    }))
    setGroceryItems([...groceryItems, ...newItems])
    showToast('Added to grocery list')
  }

  function toggleGroceryItem(id) {
    const item = groceryItems.find(i => i.id === id)
    setGroceryItems(groceryItems.map(item => item.id === id ? { ...item, checked: !item.checked } : item))
    if (item) showToast(item.checked ? 'Item unchecked' : 'Item checked')
  }

  function clearGroceryList() {
    setGroceryItems([])
  }

  function addGroceryItem(name, category) {
    setGroceryItems([...groceryItems, {
      id: Date.now() + Math.random(),
      name,
      category,
      checked: false,
      recipeName: '',
      recipeId: null,
    }])
  }

  function editGroceryItem(id, name) {
    setGroceryItems(groceryItems.map(item => item.id === id ? { ...item, name } : item))
  }

  function deleteGroceryItem(id) {
    setGroceryItems(groceryItems.filter(item => item.id !== id))
    showToast('Grocery item deleted')
  }

  function addCollection(name) {
    if (!name.trim()) return
    setCollections([...collections, { id: Date.now(), name: name.trim(), recipeIds: [] }])
    setShowCollectionForm(false)
    setNewCollectionName('')
  }

  function deleteCollection(id) {
    if (selectedCollection && selectedCollection.id === id) {
      setSelectedCollection(null)
    }
    setCollections(collections.filter(c => c.id !== id))
  }

  function toggleRecipeInCollection(recipeId, collectionId) {
    setCollections(collections.map(c => {
      if (c.id !== collectionId) return c
      const has = c.recipeIds.includes(recipeId)
      return { ...c, recipeIds: has ? c.recipeIds.filter(id => id !== recipeId) : [...c.recipeIds, recipeId] }
    }))
  }

  function assignToDay(dateKey, recipeId) {
    setMealPlan({ ...mealPlan, [dateKey]: recipeId })
    showToast('Meal planned')
  }

  function removeFromDay(dateKey) {
    const updated = { ...mealPlan }
    delete updated[dateKey]
    setMealPlan(updated)
  }

  function toggleDarkMode() {
    setDarkMode(!darkMode)
  }

  const filtered = recipes
    .filter(recipe => {
      const q = searchQuery.toLowerCase()
      const matchesSearch = !q ||
        recipe.name.toLowerCase().includes(q) ||
        recipe.ingredients.some(ing => ing.name.toLowerCase().includes(q)) ||
        recipe.category.toLowerCase().includes(q)
      const matchesCategory = !selectedCategory || recipe.category === selectedCategory
      const matchesFavorites = !showFavorites || recipe.favorite
      return matchesSearch && matchesCategory && matchesFavorites
    })
    .sort((a, b) => (b.favorite ? 1 : 0) - (a.favorite ? 1 : 0))

  const groceryCount = groceryItems.filter(i => !i.checked).length

  function handleFabOption(opt) {
    setShowFabMenu(false)
    switch (opt) {
      case 'recipe':
        setImportData(null)
        setShowForm(true)
        setActiveTab('recipes')
        break
      case 'url':
        setView('import-url')
        break
      case 'image':
        setView('import-image')
        break
      case 'text':
        setView('import')
        break
      case 'generate':
        setView('generate')
        break
    }
  }

  function handleSaveForm(recipe) {
    if (editingRecipe) { updateRecipe(recipe); showToast('Recipe updated') }
    else { addRecipe(recipe); showToast('Recipe added') }
    setShowForm(false)
    setImportData(null)
    setEditingRecipe(null)
  }

  function handleCancelForm() {
    setShowForm(false)
    setImportData(null)
    setEditingRecipe(null)
  }

  // Full-screen views rendered without nav
  if (view === 'detail' && selectedRecipe) {
    const current = recipes.find(r => r.id === selectedRecipe.id) || selectedRecipe
    return (
      <>
        <RecipeDetail
          recipe={current}
          onBack={() => { setView('home'); setSelectedRecipe(null) }}
          onToggleFavorite={() => { toggleFavorite(current.id); showToast(current.favorite ? 'Removed from favorites' : 'Added to favorites') }}
          onStartCooking={() => startCooking(current)}
          onDelete={() => deleteRecipe(current.id)}
          onAddToGroceryList={() => { addToGroceryList(current); showToast('Added to grocery list') }}
          onEdit={() => handleEdit(current)}
          collections={collections}
          onToggleCollection={(rid, cid) => {
            const wasIn = collections.find(c => c.id === cid)?.recipeIds?.includes(rid)
            toggleRecipeInCollection(rid, cid)
            showToast(wasIn ? 'Removed from collection' : 'Added to collection')
          }}
        />
        {confirmDelete && (
          <ConfirmDialog
            title="Delete this recipe?"
            message="This action cannot be undone."
            confirmLabel="Delete"
            onConfirm={confirmDeleteRecipe}
            onCancel={() => setConfirmDelete(null)}
          />
        )}
      </>
    )
  }

  if (view === 'collection-detail' && selectedCollection) {
    return (
      <>
        <CollectionDetail
          collection={selectedCollection}
          recipes={recipes}
          onBack={() => { setView('home'); setSelectedCollection(null) }}
          onOpenRecipe={recipe => openDetail(recipe)}
          onToggleFavorite={toggleFavorite}
          onAddToGroceryList={addToGroceryList}
          onEdit={handleEdit}
          collections={collections}
        />
        <Toast message={toast.message} visible={toast.visible} />
      </>
    )
  }

  if (view === 'cooking' && selectedRecipe) {
    const current = recipes.find(r => r.id === selectedRecipe.id) || selectedRecipe
    return (
      <>
        <CookingMode recipe={current} onExit={() => setView('detail')} />
        <Toast message={toast.message} visible={toast.visible} />
      </>
    )
  }

  if (view === 'import') {
    return (
      <>
        <ImportRecipe
          onParsed={data => { setImportData(data); setShowForm(true); setView('home') }}
          onBack={() => setView('home')}
        />
        <Toast message={toast.message} visible={toast.visible} />
      </>
    )
  }

  if (view === 'import-image') {
    return (
      <>
        <ImportImage
          onBack={() => setView('home')}
          onSave={recipe => {
            addRecipe(recipe)
            setView('home')
            setActiveTab('recipes')
            showToast('Recipe added')
          }}
        />
        <Toast message={toast.message} visible={toast.visible} />
      </>
    )
  }

  if (view === 'generate') {
    return (
      <>
        <GenerateRecipe
          onBack={() => setView('home')}
          onSave={recipe => {
            addRecipe(recipe)
            setView('home')
            setActiveTab('recipes')
            showToast('Recipe added')
          }}
        />
        <Toast message={toast.message} visible={toast.visible} />
      </>
    )
  }

  if (view === 'import-url') {
    return (
      <>
        <ImportUrl
          onBack={() => setView('home')}
          onSave={recipe => {
            addRecipe(recipe)
            setView('home')
            setActiveTab('recipes')
            showToast('Recipe added')
          }}
        />
        <Toast message={toast.message} visible={toast.visible} />
      </>
    )
  }

  if (view === 'placeholder') {
    return (
      <>
        <PlaceholderPage type={placeholderType} onBack={() => setView('home')} />
        <Toast message={toast.message} visible={toast.visible} />
      </>
    )
  }

  if (view === 'grocery') {
    return (
      <>
        <div className="app-shell">
          <main className="app-content">
            <GroceryList items={groceryItems} onToggle={toggleGroceryItem} onClear={clearGroceryList} onBack={() => setView('home')} onAddItem={addGroceryItem} onEditItem={editGroceryItem} onDeleteItem={deleteGroceryItem} />
          </main>
          <BottomNav activeTab={activeTab} onChange={setActiveTab} groceryCount={groceryCount} />
        </div>
        <Toast message={toast.message} visible={toast.visible} />
      </>
    )
  }

  return (
    <div className="app-shell">
      <main className="app-content">
        {/* Recipes Tab */}
        {activeTab === 'recipes' && (
          <>
            <header className="mobile-header">
              <h1>Recipes</h1>
            </header>

            {showForm && (
              <RecipeForm
                initialData={importData}
                editRecipe={editingRecipe}
                onSave={handleSaveForm}
                onCancel={handleCancelForm}
              />
            )}

            <div className="filters">
              <input
                type="text"
                className="search-input"
                placeholder="Search by name or ingredient..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
              />
              <div className="category-pills">
                <button
                  className={`pill ${!selectedCategory && !showFavorites ? 'active' : ''}`}
                  onClick={() => { setSelectedCategory(''); setShowFavorites(false) }}
                >All</button>
                <button
                  className={`pill favorites ${showFavorites ? 'active' : ''}`}
                  onClick={() => { setShowFavorites(!showFavorites); setSelectedCategory('') }}
                >&#9829; Favorites</button>
                {CATEGORIES.map(cat => (
                  <button
                    key={cat}
                    className={`pill ${selectedCategory === cat ? 'active' : ''}`}
                    onClick={() => { setSelectedCategory(selectedCategory === cat ? '' : cat); setShowFavorites(false) }}
                  >{cat}</button>
                ))}
              </div>
            </div>

            {filtered.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon">
                  <svg viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M6 2v20M6 2l-3 3m3-3l3 3"/><path d="M18 2v8a4 4 0 0 1-4 4h-2v8"/>
                  </svg>
                </div>
                <p className="empty-text">
                  {searchQuery || selectedCategory || showFavorites
                    ? 'No recipes match your search.'
                    : 'No recipes yet. Tap the + button to add one.'}
                </p>
              </div>
            ) : (
              <div className="recipe-grid">
                {filtered.map(recipe => (
                  <RecipeCard
                    key={recipe.id}
                    recipe={recipe}
                    onClick={() => openDetail(recipe)}
                    onToggleFavorite={() => toggleFavorite(recipe.id)}
                    onAddToGroceryList={() => addToGroceryList(recipe)}
                    onEdit={() => handleEdit(recipe)}
                    collections={collections}
                  />
                ))}
              </div>
            )}
          </>
        )}

        {/* Collections Tab */}
        {activeTab === 'collections' && (
          <>
            <header className="mobile-header">
              <h1>Collections</h1>
            </header>

            {showCollectionForm && (
              <div className="collection-form">
                <input
                  type="text"
                  className="collection-form-input"
                  placeholder="Collection name..."
                  value={newCollectionName}
                  onChange={e => setNewCollectionName(e.target.value)}
                  autoFocus
                />
                <div className="form-actions">
                  <button className="btn btn-primary" onClick={() => addCollection(newCollectionName)}>Save</button>
                  <button className="btn btn-secondary" onClick={() => { setShowCollectionForm(false); setNewCollectionName('') }}>Cancel</button>
                </div>
              </div>
            )}

            {collections.length === 0 && !showCollectionForm ? (
              <div className="empty-state">
                <div className="empty-icon">
                  <svg viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
                  </svg>
                </div>
                <p className="empty-text">No collections yet.</p>
                <p className="empty-sub">Organize your recipes into collections.</p>
                <button className="btn btn-primary" onClick={() => setShowCollectionForm(true)}>Create Collection</button>
              </div>
            ) : (
              <>
                <button className="btn btn-add-collection" onClick={() => setShowCollectionForm(true)}>
                  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                  New Collection
                </button>
                <div className="collection-list">
                  {collections.map(c => (
                    <div key={c.id} className="collection-card" onClick={() => { setSelectedCollection(c); setView('collection-detail') }}>
                      <div className="collection-card-main">
                        <div className="collection-card-icon">
                          <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
                          </svg>
                        </div>
                        <div className="collection-card-info">
                          <span className="collection-card-name">{c.name}</span>
                          <span className="collection-card-count">{c.recipeIds.length} recipe{c.recipeIds.length !== 1 ? 's' : ''}</span>
                        </div>
                      </div>
                      <button className="btn-icon btn-icon-danger" onClick={() => deleteCollection(c.id)}>
                        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                      </button>
                    </div>
                  ))}
                </div>
              </>
            )}
          </>
        )}

        {/* Lists Tab */}
        {activeTab === 'lists' && (
          <GroceryList
            items={groceryItems}
            onToggle={toggleGroceryItem}
            onClear={clearGroceryList}
            onBack={() => setActiveTab('recipes')}
            onAddItem={addGroceryItem}
            onEditItem={editGroceryItem}
            onDeleteItem={deleteGroceryItem}
          />
        )}

        {/* Planner Tab */}
        {activeTab === 'planner' && (
          <>
            <header className="mobile-header">
              <h1>Meal Planner</h1>
            </header>
            {recipes.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon">
                  <svg viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
                  </svg>
                </div>
                <p className="empty-text">No recipes yet.</p>
                <p className="empty-sub">Add some recipes to start planning your meals.</p>
              </div>
            ) : (
              <MealPlanner
                mealPlan={mealPlan}
                recipes={recipes}
                onAssign={assignToDay}
                onRemove={removeFromDay}
              />
            )}
          </>
        )}

        {/* Account Tab */}
        {activeTab === 'account' && (
          <>
            <header className="mobile-header">
              <h1>Account</h1>
            </header>
            <div className="account-section">
              <div className="account-card">
                <h3 className="account-card-title">Theme</h3>
                <div className="account-toggle" onClick={toggleDarkMode}>
                  <span className="account-toggle-label">
                    {darkMode ? (
                      <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
                    ) : (
                      <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>
                    )}
                    Dark Mode
                  </span>
                  <span className={`account-toggle-switch ${darkMode ? 'on' : ''}`}>
                    <span className="account-toggle-knob" />
                  </span>
                </div>
              </div>

              {installPrompt && (
                <div className="account-card">
                  <h3 className="account-card-title">App</h3>
                  <div className="account-card-actions">
                    <button className="btn btn-primary btn-account" onClick={handleInstallClick}>
                      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ verticalAlign: 'middle', marginRight: 6 }}>
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
                      </svg>
                      Install App
                    </button>
                  </div>
                </div>
              )}

              <div className="account-card">
                <h3 className="account-card-title">Import / Export</h3>
                <div className="account-card-actions">
                  <button className="btn btn-outline btn-account" disabled>Export Recipes</button>
                  <button className="btn btn-outline btn-account" disabled>Import Recipes</button>
                </div>
                <p className="account-hint">Coming soon</p>
              </div>

              <div className="account-card">
                <h3 className="account-card-title">About</h3>
                <div className="account-about">
                  <p><strong>Smart Cookbook</strong></p>
                  <p>Version 1.0</p>
                  <p className="account-hint">Your personal digital cookbook. Save, organize, and cook your favorite recipes.</p>
                </div>
              </div>
            </div>
          </>
        )}
      </main>

      <FabMenu isOpen={showFabMenu} onToggle={() => setShowFabMenu(!showFabMenu)} onOption={handleFabOption} />
      <BottomNav activeTab={activeTab} onChange={setActiveTab} groceryCount={groceryCount} />

      {confirmDelete && (
        <ConfirmDialog
          title="Delete this recipe?"
          message="This action cannot be undone."
          confirmLabel="Delete"
          onConfirm={confirmDeleteRecipe}
          onCancel={() => setConfirmDelete(null)}
        />
      )}

      <Toast message={toast.message} visible={toast.visible} />
    </div>
  )
}

export default App
