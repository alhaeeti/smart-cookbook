import { useState } from 'react'

const INGREDIENT_HEADERS = ['ingredients', 'what you need', 'you will need', 'shopping list', 'ingredient']
const STEP_HEADERS = ['steps', 'instructions', 'directions', 'method', 'preparation', 'procedure', 'how to make', 'how to cook', 'what to do', 'step by step']

function parseRecipe(text) {
  const lines = text.split('\n')
  const result = { name: '', servings: '', ingredients: [], steps: [] }
  let section = 'header'

  for (const raw of lines) {
    let line = raw.trim()
    if (!line) continue
    const lower = line.toLowerCase().replace(/:+$/, '').trim()

    if (INGREDIENT_HEADERS.includes(lower)) {
      section = 'ingredients'
      continue
    }
    if (STEP_HEADERS.includes(lower)) {
      section = 'steps'
      continue
    }

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
      if (STEP_HEADERS.includes(lower)) {
        section = 'steps'
        continue
      }
      let clean = line.replace(/^[-•*#▪●◆◇→⇒✦]\s*/, '').trim()
      clean = clean.replace(/^[Ii]ngredients?\s*:?\s*$/, '').trim()
      if (!clean) continue
      if (INGREDIENT_HEADERS.includes(clean.toLowerCase())) continue
      result.ingredients.push(clean)
    } else if (section === 'steps') {
      let clean = line.replace(/^[-•*#▪●◆◇→⇒✦]\s*/, '').trim()
      clean = clean.replace(/^(Step\s*)?\d+[.)]?\s*/i, '').trim()
      if (!clean) continue
      if (STEP_HEADERS.includes(clean.toLowerCase())) continue
      result.steps.push(clean)
    }
  }

  if (!result.name && result.ingredients.length > 0) {
    result.name = 'Imported Recipe'
  }

  return result
}

function ImportRecipe({ onParsed, onBack }) {
  const [text, setText] = useState('')
  const [parsed, setParsed] = useState(null)

  function handleParse() {
    setParsed(parseRecipe(text))
  }

  return (
    <div className="import-page">
      <div className="import-header">
        <button className="btn btn-back" onClick={onBack}>&larr; Back</button>
        <h1>Import Recipe</h1>
      </div>
      <p className="import-hint">
        Paste a recipe from any website, YouTube description, Instagram caption, or your notes.
      </p>
      <textarea
        className="import-textarea"
        placeholder={`Paste recipe here...\n\nExample:\nChicken Curry\nServings: 4\n\nIngredients:\n500g chicken\n1 onion\n2 cups rice\n\nSteps:\n1. Cook chicken\n2. Add onion\n3. Serve`}
        value={text}
        onChange={e => setText(e.target.value)}
        rows={10}
      />
      <button
        className="btn btn-primary btn-large"
        onClick={handleParse}
        disabled={!text.trim()}
        style={{ width: '100%', marginTop: 16 }}
      >
        Parse Recipe
      </button>

      {parsed && (
        <div className="import-preview">
          <h2>Parsed Result</h2>
          <div className="preview-card">
            <div className="preview-row">
              <span className="preview-label">Name:</span>
              <span className="preview-value">{parsed.name || <em>Not detected</em>}</span>
            </div>
            <div className="preview-row">
              <span className="preview-label">Servings:</span>
              <span className="preview-value">{parsed.servings || <em>Not detected</em>}</span>
            </div>
            <div className="preview-row">
              <span className="preview-label">Ingredients ({parsed.ingredients.length}):</span>
            </div>
            <ul className="preview-ingredients">
              {parsed.ingredients.map((ing, i) => (
                <li key={i}>{ing}</li>
              ))}
              {parsed.ingredients.length === 0 && <li className="none">None detected</li>}
            </ul>
            <div className="preview-row">
              <span className="preview-label">Steps ({parsed.steps.length}):</span>
            </div>
            <ol className="preview-steps">
              {parsed.steps.map((step, i) => (
                <li key={i}>{step}</li>
              ))}
              {parsed.steps.length === 0 && <li className="none">None detected</li>}
            </ol>
          </div>
          <div className="preview-actions">
            <button className="btn btn-primary btn-large" onClick={() => onParsed(parsed)}>
              Use Recipe
            </button>
            <button className="btn btn-secondary btn-large" onClick={() => setParsed(null)}>
              Edit Text
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default ImportRecipe
