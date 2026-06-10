import { useState, useRef } from 'react'

let nextId = 1

function RecipeForm({ onSave, onCancel, initialData, editRecipe }) {
  const [name, setName] = useState(editRecipe?.name || initialData?.name || '')
  const [servings, setServings] = useState(editRecipe?.servings || initialData?.servings || '')
  const [category, setCategory] = useState(editRecipe?.category || initialData?.category || '')
  const [image, setImage] = useState(editRecipe?.image || '')
  const [ingredients, setIngredients] = useState(
    editRecipe?.ingredients?.length > 0
      ? editRecipe.ingredients.map(i => ({ id: i.id, name: i.name }))
      : initialData?.ingredients?.length > 0
        ? initialData.ingredients.map(name => ({ id: nextId++, name }))
        : [{ id: nextId++, name: '' }]
  )
  const [steps, setSteps] = useState(
    editRecipe?.steps?.length > 0
      ? editRecipe.steps.map(s => ({ ...s }))
      : initialData?.steps?.length > 0
        ? initialData.steps.map(text => ({ id: nextId++, text }))
        : [{ id: nextId++, text: '' }]
  )
  const fileRef = useRef(null)

  function addIngredient() {
    setIngredients([...ingredients, { id: nextId++, name: '' }])
  }

  function removeIngredient(id) {
    if (ingredients.length > 1) {
      setIngredients(ingredients.filter(i => i.id !== id))
    }
  }

  function updateIngredient(id, value) {
    setIngredients(ingredients.map(i =>
      i.id === id ? { ...i, name: value } : i
    ))
  }

  function addStep() {
    setSteps([...steps, { id: nextId++, text: '' }])
  }

  function removeStep(id) {
    if (steps.length > 1) {
      setSteps(steps.filter(s => s.id !== id))
    }
  }

  function updateStep(id, value) {
    setSteps(steps.map(s =>
      s.id === id ? { ...s, text: value } : s
    ))
  }

  function handleFile(e) {
    const file = e.target.files[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => setImage(reader.result)
    reader.readAsDataURL(file)
  }

  function handleRemoveImage() {
    setImage('')
    if (fileRef.current) fileRef.current.value = ''
  }

  function handleSubmit(e) {
    e.preventDefault()
    if (!name.trim() || !servings.trim()) return

    const recipe = {
      id: editRecipe ? editRecipe.id : Date.now(),
      name: name.trim(),
      servings: servings.trim(),
      category,
      favorite: editRecipe ? editRecipe.favorite : false,
      image: image || '',
      sourceUrl: editRecipe?.sourceUrl || '',
      ingredients: ingredients.filter(i => i.name.trim()).map(i => ({ id: i.id, name: i.name.trim() })),
      steps: steps.filter(s => s.text.trim()).map(s => ({ id: s.id, text: s.text.trim() })),
    }
    onSave(recipe)
  }

  return (
    <form className="recipe-form" onSubmit={handleSubmit}>
      <h2>{editRecipe ? 'Edit Recipe' : initialData ? 'Review Imported Recipe' : 'New Recipe'}</h2>

      <label>
        Recipe Name
        <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Chicken Biryani" required />
      </label>

      <label>
        Servings
        <input type="text" value={servings} onChange={e => setServings(e.target.value)} placeholder="e.g. 4" required />
      </label>

      <label>
        Category
        <select value={category} onChange={e => setCategory(e.target.value)}>
          <option value="">None</option>
          <option value="Breakfast">Breakfast</option>
          <option value="Lunch">Lunch</option>
          <option value="Dinner">Dinner</option>
          <option value="Dessert">Dessert</option>
          <option value="Drinks">Drinks</option>
        </select>
      </label>

      <div className="form-image">
        <span className="form-image-label">Photo</span>
        {image ? (
          <div className="form-image-preview">
            <img src={image} alt="Recipe" />
            <button type="button" className="form-image-remove" onClick={handleRemoveImage}>
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              Remove
            </button>
          </div>
        ) : (
          <button type="button" className="form-image-add" onClick={() => fileRef.current?.click()}>
            <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/>
            </svg>
            Add Photo
          </button>
        )}
        <input ref={fileRef} type="file" accept="image/*" className="form-image-input" onChange={handleFile} />
      </div>

      <label>Ingredients</label>
      <div className="dynamic-list">
        {ingredients.map((ing, i) => (
          <div key={ing.id} className="dynamic-row">
            <input
              type="text"
              value={ing.name}
              onChange={e => updateIngredient(ing.id, e.target.value)}
              placeholder={`Ingredient ${i + 1}`}
            />
            <button type="button" className="btn-icon" onClick={() => removeIngredient(ing.id)} title="Remove ingredient">&times;</button>
          </div>
        ))}
        <button type="button" className="btn btn-add" onClick={addIngredient}>+ Add Ingredient</button>
      </div>

      <label>Steps</label>
      <div className="dynamic-list">
        {steps.map((step, i) => (
          <div key={step.id} className="dynamic-row">
            <span className="step-number">{i + 1}.</span>
            <input
              type="text"
              value={step.text}
              onChange={e => updateStep(step.id, e.target.value)}
              placeholder={`Step ${i + 1}`}
            />
            <button type="button" className="btn-icon" onClick={() => removeStep(step.id)} title="Remove step">&times;</button>
          </div>
        ))}
        <button type="button" className="btn btn-add" onClick={addStep}>+ Add Step</button>
      </div>

      <div className="form-actions">
        <button type="submit" className="btn btn-primary">Save Recipe</button>
        <button type="button" className="btn btn-secondary" onClick={onCancel}>Cancel</button>
      </div>
    </form>
  )
}

export default RecipeForm
