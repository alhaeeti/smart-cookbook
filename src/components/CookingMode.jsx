import { useState } from 'react'

function CookingMode({ recipe, onExit }) {
  const [stepIndex, setStepIndex] = useState(0)
  const total = recipe.steps.length

  return (
    <div className="cooking-mode">
      <div className="cooking-header">
        <button className="btn btn-back" onClick={onExit}>&larr; Exit</button>
        <h2>{recipe.name}</h2>
      </div>

      <div className="cooking-progress">
        <div className="progress-bar">
          <div className="progress-fill" style={{ width: `${((stepIndex + 1) / total) * 100}%` }} />
        </div>
        <span className="progress-text">Step {stepIndex + 1} of {total}</span>
      </div>

      <div className="cooking-step-card">
        <div className="step-indicator">{stepIndex + 1}</div>
        <p className="step-text">{recipe.steps[stepIndex].text}</p>
      </div>

      <div className="cooking-nav">
        <button
          className="btn btn-secondary btn-large"
          disabled={stepIndex === 0}
          onClick={() => setStepIndex(stepIndex - 1)}
        >
          &larr; Previous
        </button>
        <button
          className="btn btn-primary btn-large"
          disabled={stepIndex === total - 1}
          onClick={() => setStepIndex(stepIndex + 1)}
        >
          Next &rarr;
        </button>
      </div>

      {stepIndex === total - 1 && (
        <p className="cooking-done">Done! Enjoy your meal!</p>
      )}
    </div>
  )
}

export default CookingMode
