import { useState } from 'react'
import { extractRecipeFromUrl } from '../services/urlRecipeExtractor'

function isValidUrl(str) {
  try {
    const url = new URL(str)
    return url.protocol === 'http:' || url.protocol === 'https:'
  } catch {
    return false
  }
}

function cleanExtractedRecipe(data) {
  const cleaned = { ...data }
  cleaned.name = (cleaned.name || '').trim() || 'Imported Recipe'

  cleaned.ingredients = Array.isArray(cleaned.ingredients)
    ? cleaned.ingredients
        .map(i => i.trim())
        .filter((i, idx, arr) => i && arr.findIndex(x => x.toLowerCase() === i.toLowerCase()) === idx)
    : []

  cleaned.steps = Array.isArray(cleaned.steps)
    ? cleaned.steps
        .map(s => s.trim().replace(/^[\d\-.•‣⁃◦]+[\s.)]*/, '').trim())
        .filter((s, idx, arr) => s && arr.findIndex(x => x.toLowerCase() === s.toLowerCase()) === idx)
    : []

  if (cleaned.ingredients.length < 2 || cleaned.steps.length < 1) {
    cleaned.warning = 'Recipe extraction may be incomplete. Please review before saving.'
  }

  return cleaned
}

export default function ImportUrl({ onBack, onSave }) {
  const [url, setUrl] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [extracted, setExtracted] = useState(null)
  const [name, setName] = useState('')
  const [servings, setServings] = useState('')
  const [category, setCategory] = useState('')
  const [ingredients, setIngredients] = useState([])
  const [steps, setSteps] = useState([])

  function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setExtracted(null)

    if (!url.trim()) {
      setError('Please enter a URL.')
      return
    }

    if (!isValidUrl(url.trim())) {
      setError('Please enter a valid URL.')
      return
    }

    setLoading(true)
    extractRecipeFromUrl(url.trim()).then(data => {
      const cleaned = cleanExtractedRecipe(data)
      setExtracted(cleaned)
      setName(cleaned.name)
      setServings(String(cleaned.servings))
      setCategory(cleaned.category)
      setIngredients(cleaned.ingredients.map((name, i) => ({ id: Date.now() + i, name })))
      setSteps(cleaned.steps.map((text, i) => ({ id: Date.now() + 100 + i, text })))
      setLoading(false)
    }).catch(err => {
      setError(err.message || 'Could not extract recipe from this URL. Try Import Text instead.')
      setLoading(false)
    })
  }

  function addIngredient() {
    setIngredients([...ingredients, { id: Date.now() + Math.random(), name: '' }])
  }

  function removeIngredient(id) {
    if (ingredients.length > 1) setIngredients(ingredients.filter(i => i.id !== id))
  }

  function updateIngredient(id, value) {
    setIngredients(ingredients.map(i => i.id === id ? { ...i, name: value } : i))
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

  function handleSave() {
    const recipe = {
      id: Date.now(),
      name: name.trim(),
      servings: servings.trim(),
      category,
      favorite: false,
      image: '',
      sourceUrl: extracted?.sourceUrl || url.trim(),
      ingredients: ingredients.filter(i => i.name.trim()).map(i => ({ id: i.id, name: i.name.trim() })),
      steps: steps.filter(s => s.text.trim()).map(s => ({ id: s.id, text: s.text.trim() })),
    }
    onSave(recipe)
  }

  if (loading) {
    return (
      <div className="import-url-page">
        <div className="import-url-header">
          <button className="btn btn-back" onClick={onBack}>
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
            Back
          </button>
          <h1>Import from URL</h1>
        </div>
        <div className="import-url-loading">
          <div className="import-url-spinner" />
          <p>Extracting recipe...</p>
        </div>
      </div>
    )
  }

  if (extracted) {
    return (
      <div className="import-url-page">
        <div className="import-url-header">
          <button className="btn btn-back" onClick={onBack}>
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
            Back
          </button>
          <h1>Imported Recipe</h1>
        </div>

        <div className="import-url-source">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
          <span>{extracted.sourceUrl}</span>
        </div>

        {extracted.warning && (
          <p className="import-url-validation-error">{extracted.warning}</p>
        )}

        <div className="import-url-editor">
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
            {ingredients.map((ing, i) => (
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
    <div className="import-url-page">
      <div className="import-url-header">
        <button className="btn btn-back" onClick={onBack}>
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
          Back
        </button>
        <h1>Import from URL</h1>
      </div>

      <form className="import-url-form" onSubmit={handleSubmit}>
        <input
          type="url"
          className="import-url-input"
          placeholder="https://example.com/recipe"
          value={url}
          onChange={e => { setUrl(e.target.value); setError('') }}
          autoFocus
        />
        <p className="import-url-hint">Paste a recipe link from a website, YouTube, Instagram, or TikTok.</p>

        {error && <p className="import-url-error">{error}</p>}

        <button type="submit" className="btn btn-primary btn-large btn-import-url">
          Import Recipe
        </button>
      </form>
    </div>
  )
}
