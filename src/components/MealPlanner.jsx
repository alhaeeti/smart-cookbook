import { useState } from 'react'

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

function getMonday(d) {
  const date = new Date(d)
  const day = date.getDay()
  const diff = date.getDate() - day + (day === 0 ? -6 : 1)
  date.setDate(diff)
  date.setHours(0, 0, 0, 0)
  return date
}

function formatDate(date) {
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function toDateKey(date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export default function MealPlanner({ mealPlan, recipes, onAssign, onRemove }) {
  const [selectingDay, setSelectingDay] = useState(null)
  const weekStart = getMonday(new Date())

  const days = DAYS.map((name, i) => {
    const date = new Date(weekStart)
    date.setDate(date.getDate() + i)
    return { name, date, key: toDateKey(date) }
  })

  const todayKey = toDateKey(new Date())

  return (
    <div className="planner">
      <div className="planner-header">
        <h2 className="planner-title">This Week</h2>
        <span className="planner-range">
          {formatDate(weekStart)} &ndash; {formatDate(days[6].date)}
        </span>
      </div>

      <div className="planner-days">
        {days.map(day => {
          const recipeId = mealPlan[day.key]
          const recipe = recipes.find(r => r.id === recipeId)
          const isToday = day.key === todayKey

          return (
            <div key={day.key} className={`planner-day ${isToday ? 'today' : ''}`}>
              <div className="planner-day-header">
                <span className="planner-day-name">{day.name}</span>
                <span className="planner-day-date">{formatDate(day.date)}</span>
                {isToday && <span className="planner-today-badge">Today</span>}
              </div>
              <div className="planner-day-body">
                {recipe ? (
                  <div className="planner-recipe">
                    <span className="planner-recipe-name">{recipe.name}</span>
                    <button
                      className="planner-remove"
                      onClick={() => onRemove(day.key)}
                      aria-label="Remove recipe"
                    >
                      &times;
                    </button>
                  </div>
                ) : (
                  <button className="planner-add-btn" onClick={() => setSelectingDay(day.key)}>
                    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                    Add
                  </button>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {selectingDay && (
        <div className="planner-overlay" onClick={() => setSelectingDay(null)}>
          <div className="planner-picker" onClick={e => e.stopPropagation()}>
            <div className="planner-picker-header">
              <h3>Choose a recipe</h3>
              <button className="planner-picker-close" onClick={() => setSelectingDay(null)}>&times;</button>
            </div>
            <div className="planner-picker-list">
              {recipes.length === 0 ? (
                <p className="planner-picker-empty">No recipes yet. Create one first!</p>
              ) : (
                recipes.map(r => (
                  <button
                    key={r.id}
                    className="planner-picker-item"
                    onClick={() => { onAssign(selectingDay, r.id); setSelectingDay(null) }}
                  >
                    <span>{r.name}</span>
                    {r.category && <span className="planner-picker-cat">{r.category}</span>}
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
