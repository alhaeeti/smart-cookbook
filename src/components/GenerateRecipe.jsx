import { useState } from 'react'
import { generateRecipe } from '../services/generateRecipe'

export default function GenerateRecipe({ onBack, onSave }) {
  const [ingredients, setIngredients] = useState('')
  const [cuisine, setCuisine] = useState('')
  const [mealType, setMealType] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [recipe, setRecipe] = useState(null)
  const [name, setName] = useState('')
  const [servings, setServings] = useState('')
  const [category, setCategory] = useState('')
  const [recipeIngredients, setRecipeIngredients] = useState([])
  const [steps, setSteps] = useState([])

  function addIngredient() {
    setRecipeIngredients([...recipeIngredients, { id: Date.now() + Math.random(), name: '' }])
  }

  function removeIngredient(id) {
    if (recipeIngredients.length > 1) setRecipeIngredients(recipeIngredients.filter(i => i.id !== id))
  }

  function updateIngredient(id, value) {
    setRecipeIngredients(recipeIngredients.map(i => i.id === id ? { ...i, name: value } : i))
  }

  function addStep() {
    setSteps([...steps, { id: Date.now() + Math.random(), text: '' }])
  }

  function removeStep(id) {
    if (steps.length > 1) setSteps(steps.filter(s => s.id !== id))
  }

  function updateStep(id, value) {
    setSteps(steps.map(s => s.id === id ? { ...s, text: value } : s))
  }

  function handleGenerate(e) {
    e.preventDefault()
    if (!ingredients.trim()) return
    setLoading(true)
    setError('')
    setRecipe(null)

    generateRecipe({ ingredients: ingredients.trim(), cuisine: cuisine.trim(), mealType: mealType.trim() })
      .then(data => {
        setRecipe(data)
        setName(data.name)
        setServings(String(data.servings))
        setCategory(data.category)
        setRecipeIngredients(data.ingredients.map((name, i) => ({ id: Date.now() + i, name })))
        setSteps(data.steps.map((text, i) => ({ id: Date.now() + 100 + i, text })))
        setLoading(false)
      })
      .catch(err => {
        setError(err.message || 'Generation failed. Please try again.')
        setLoading(false)
      })
  }

  function handleSave() {
    onSave({
      id: Date.now(),
      name: name.trim(),
      servings: servings.trim(),
      category,
      favorite: false,
      image: '',
      sourceUrl: '',
      ingredients: recipeIngredients.filter(i => i.name.trim()).map(i => ({ id: i.id, name: i.name.trim() })),
      steps: steps.filter(s => s.text.trim()).map(s => ({ id: s.id, text: s.text.trim() })),
    })
  }

  if (loading) {
    return (
      <div className="placeholder-page">
        <div className="placeholder-page-header">
          <button className="btn btn-back" onClick={onBack}>
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
            Back
          </button>
        </div>
        <div className="placeholder-page-body">
          <div className="generate-loading">
            <div className="import-url-spinner" />
            <p>Generating recipe...</p>
          </div>
        </div>
      </div>
    )
  }

  if (recipe) {
    return (
      <div className="placeholder-page">
        <div className="placeholder-page-header">
          <button className="btn btn-back" onClick={onBack}>
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
            Back
          </button>
          <h1>Generated Recipe</h1>
        </div>

        {recipe.warning && <p className="import-url-validation-error" style={{ margin: '0 16px 12px' }}>{recipe.warning}</p>}

        <div className="import-url-editor" style={{ padding: '0 16px' }}>
          <label className="import-url-field">
            <span>Recipe Name</span>
            <input type="text" value={name} onChange={e => setName(e.target.value)} />
          </label>
          <label className="import-url-field">
            <span>Servings</span>
            <input type="text" value={servings} onChange={e => setServings(e.target.value)} />
          </label>
          <label className="import-url-field">
            <span>Category</span>
            <select value={category} onChange={e => setCategory(e.target.value)}>
              <option value="">None</option>
              <option value="Breakfast">Breakfast</option>
              <option value="Lunch">Lunch</option>
              <option value="Dinner">Dinner</option>
              <option value="Dessert">Dessert</option>
              <option value="Drinks">Drinks</option>
            </select>
          </label>

          <div className="import-url-field">
            <span>Ingredients</span>
            {recipeIngredients.map((ing, i) => (
              <div key={ing.id} className="import-url-editor-row">
                <input type="text" value={ing.name} onChange={e => updateIngredient(ing.id, e.target.value)} placeholder={`Ingredient ${i + 1}`} />
                <button type="button" className="btn-icon" onClick={() => removeIngredient(ing.id)}>&times;</button>
              </div>
            ))}
            <button type="button" className="btn btn-add" onClick={addIngredient}>+ Add Ingredient</button>
          </div>

          <div className="import-url-field">
            <span>Steps</span>
            {steps.map((step, i) => (
              <div key={step.id} className="import-url-editor-row">
                <span className="step-number">{i + 1}.</span>
                <input type="text" value={step.text} onChange={e => updateStep(step.id, e.target.value)} placeholder={`Step ${i + 1}`} />
                <button type="button" className="btn-icon" onClick={() => removeStep(step.id)}>&times;</button>
              </div>
            ))}
            <button type="button" className="btn btn-add" onClick={addStep}>+ Add Step</button>
          </div>

          <button className="btn btn-primary btn-large btn-import-save" onClick={handleSave}>
            Save Recipe
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="placeholder-page">
      <div className="placeholder-page-header">
        <button className="btn btn-back" onClick={onBack}>
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
          Back
        </button>
        <h1>Generate Recipe</h1>
      </div>

      <div className="generate-form">
        <label className="generate-field">
          <span>Ingredients *</span>
          <textarea
            value={ingredients}
            onChange={e => setIngredients(e.target.value)}
            placeholder="e.g. chicken, rice, onion, garlic, tomato"
            rows={4}
          />
        </label>
        <label className="generate-field">
          <span>Cuisine (optional)</span>
          <input
            type="text"
            value={cuisine}
            onChange={e => setCuisine(e.target.value)}
            placeholder="e.g. Italian, Mexican, Thai"
          />
        </label>
        <label className="generate-field">
          <span>Meal Type (optional)</span>
          <select value={mealType} onChange={e => setMealType(e.target.value)}>
            <option value="">Any</option>
            <option value="Breakfast">Breakfast</option>
            <option value="Lunch">Lunch</option>
            <option value="Dinner">Dinner</option>
            <option value="Dessert">Dessert</option>
          </select>
        </label>

        {error && <p className="import-url-error">{error}</p>}

        <button
          className="btn btn-primary btn-large"
          onClick={handleGenerate}
          disabled={!ingredients.trim()}
          style={{ width: '100%' }}
        >
          Generate Recipe
        </button>
      </div>
    </div>
  )
}
