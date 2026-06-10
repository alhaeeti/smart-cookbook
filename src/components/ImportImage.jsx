import { useState, useRef } from 'react'
import { createWorker } from 'tesseract.js'
import { extractRecipeFromUrl } from '../services/urlRecipeExtractor'

function parseRecipe(text) {
  const lines = text.split('\n')
  const result = { name: '', servings: '', ingredients: [], steps: [] }
  let section = 'header'
  const INGREDIENT_HEADERS = ['ingredients', 'what you need', 'you will need', 'shopping list', 'ingredient']
  const STEP_HEADERS = ['steps', 'instructions', 'directions', 'method', 'preparation', 'procedure', 'how to make', 'how to cook', 'what to do', 'step by step']

  for (const raw of lines) {
    let line = raw.trim()
    if (!line) continue
    const lower = line.toLowerCase().replace(/:+$/, '').trim()

    if (INGREDIENT_HEADERS.includes(lower)) { section = 'ingredients'; continue }
    if (STEP_HEADERS.includes(lower)) { section = 'steps'; continue }

    if (section === 'header') {
      const servingsMatch = lower.match(/^(servings?|serves?|yield|makes)\s*:?\s*(.+)/)
      if (servingsMatch) {
        result.servings = servingsMatch[2].trim()
      } else if (lower.match(/^(recipe|title|name)\s*:?\s*(.+)/i)) {
        const m = lower.match(/^(recipe|title|name)\s*:?\s*(.+)/i)
        result.name = m[2].trim()
      } else if (!result.name) {
        result.name = line
      }
    } else if (section === 'ingredients') {
      if (STEP_HEADERS.includes(lower)) { section = 'steps'; continue }
      let clean = line.replace(/^[-•*#▪●◆◇→⇒✦]\s*/, '').trim()
      clean = clean.replace(/^[Ii]ngredients?\s*:?\s*$/, '').trim()
      if (!clean || INGREDIENT_HEADERS.includes(clean.toLowerCase())) continue
      result.ingredients.push(clean)
    } else if (section === 'steps') {
      let clean = line.replace(/^[-•*#▪●◆◇→⇒✦]\s*/, '').trim()
      clean = clean.replace(/^(Step\s*)?\d+[.)]?\s*/i, '').trim()
      if (!clean || STEP_HEADERS.includes(clean.toLowerCase())) continue
      result.steps.push(clean)
    }
  }

  if (!result.name && result.ingredients.length > 0) result.name = 'Imported Recipe'
  return result
}

export default function ImportImage({ onBack, onSave }) {
  const fileRef = useRef(null)
  const [image, setImage] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [parsed, setParsed] = useState(null)
  const [name, setName] = useState('')
  const [servings, setServings] = useState('')
  const [category, setCategory] = useState('')
  const [ingredients, setIngredients] = useState([])
  const [steps, setSteps] = useState([])

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

  async function handleFile(e) {
    const file = e.target.files[0]
    if (!file) return
    setError('')
    setParsed(null)
    setImage(URL.createObjectURL(file))
    setLoading(true)

    try {
      const worker = await createWorker('eng')
      const { data } = await worker.recognize(file)
      await worker.terminate()

      const text = data.text.trim()
      if (!text) {
        setError('Could not read any text from this image. Try a clearer photo.')
        setLoading(false)
        return
      }

      const result = parseRecipe(text)
      setParsed(result)
      setName(result.name)
      setServings(result.servings)
      setCategory('Dinner')
      setIngredients(result.ingredients.map((name, i) => ({ id: Date.now() + i, name })))
      setSteps(result.steps.map((text, i) => ({ id: Date.now() + 100 + i, text })))
    } catch (err) {
      setError('OCR failed. Try a clearer image or use Import Text instead.')
    }
    setLoading(false)
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
      ingredients: ingredients.filter(i => i.name.trim()).map(i => ({ id: i.id, name: i.name.trim() })),
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
            <p>Reading text from image...</p>
          </div>
        </div>
      </div>
    )
  }

  if (parsed) {
    return (
      <div className="placeholder-page">
        <div className="placeholder-page-header">
          <button className="btn btn-back" onClick={onBack}>
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
            Back
          </button>
          <h1>Imported from Image</h1>
        </div>

        {image && <img src={image} alt="Uploaded" className="import-image-preview" />}

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
    <div className="placeholder-page">
      <div className="placeholder-page-header">
        <button className="btn btn-back" onClick={onBack}>
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
          Back
        </button>
        <h1>Import from Image</h1>
      </div>

      <div className="import-image-form">
        <div className="import-image-upload" onClick={() => fileRef.current?.click()}>
          <svg viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/>
          </svg>
          <p>Tap to upload a recipe image</p>
        </div>
        <input ref={fileRef} type="file" accept="image/*" onChange={handleFile} hidden />

        {error && <p className="import-url-error" style={{ margin: '16px 0 0' }}>{error}</p>}

        <p className="import-url-hint" style={{ marginTop: 16 }}>
          Upload a photo of a recipe card, cookbook page, or handwritten recipe. Text will be extracted automatically.
        </p>
      </div>
    </div>
  )
}
