import { useState } from 'react'

const CATEGORY_ORDER = ['Produce', 'Meat', 'Dairy', 'Grains', 'Spices', 'Other']
const CATEGORIES = ['Produce', 'Meat', 'Dairy', 'Grains', 'Spices', 'Other']

function GroceryList({ items, onToggle, onClear, onBack, onAddItem, onEditItem, onDeleteItem }) {
  const [showAdd, setShowAdd] = useState(false)
  const [newName, setNewName] = useState('')
  const [newCategory, setNewCategory] = useState('Other')
  const [editingId, setEditingId] = useState(null)
  const [editName, setEditName] = useState('')

  const grouped = items.reduce((acc, item) => {
    const cat = item.category || 'Other'
    if (!acc[cat]) acc[cat] = []
    acc[cat].push(item)
    return acc
  }, {})

  const total = items.length
  const completed = items.filter(i => i.checked).length

  function handleAdd() {
    if (!newName.trim()) return
    onAddItem(newName.trim(), newCategory)
    setNewName('')
    setNewCategory('Other')
    setShowAdd(false)
  }

  function handleEdit(item) {
    setEditingId(item.id)
    setEditName(item.name)
  }

  function handleSaveEdit(id) {
    if (!editName.trim()) return
    onEditItem(id, editName.trim())
    setEditingId(null)
    setEditName('')
  }

  return (
    <div className="grocery-page">
      <div className="grocery-header">
        <button className="btn btn-back" onClick={onBack}>
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
          Back
        </button>
        <h1>Grocery List</h1>
        {items.length > 0 && (
          <button className="btn btn-danger" onClick={onClear}>Clear</button>
        )}
      </div>

      {items.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">
            <svg viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M6 2v20M6 2l-3 3m3-3l3 3"/><path d="M18 2v8a4 4 0 0 1-4 4h-2v8"/>
            </svg>
          </div>
          <p className="empty-text">Your grocery list is empty.</p>
          <p className="empty-sub">Add ingredients from recipes or add custom items.</p>
        </div>
      ) : (
        <>
          <div className="grocery-progress">
            <div className="grocery-progress-text">{completed} / {total} completed</div>
            <div className="grocery-progress-bar">
              <div className="grocery-progress-fill" style={{ width: `${total ? (completed / total) * 100 : 0}%` }} />
            </div>
          </div>

          {CATEGORY_ORDER.map(cat => {
            const catItems = grouped[cat]
            if (!catItems || catItems.length === 0) return null
            return (
              <div key={cat} className="grocery-category">
                <h2 className="grocery-category-title">{cat}</h2>
                {catItems.map(item => (
                  <div key={item.id} className={`grocery-item-wrap ${item.checked ? 'checked' : ''}`}>
                    {editingId === item.id ? (
                      <div className="grocery-item-edit">
                        <input
                          type="text"
                          value={editName}
                          onChange={e => setEditName(e.target.value)}
                          autoFocus
                          onKeyDown={e => { if (e.key === 'Enter') handleSaveEdit(item.id); if (e.key === 'Escape') setEditingId(null) }}
                        />
                        <button className="btn btn-sm btn-primary" onClick={() => handleSaveEdit(item.id)}>Save</button>
                        <button className="btn btn-sm btn-secondary" onClick={() => setEditingId(null)}>Cancel</button>
                      </div>
                    ) : (
                      <label className="grocery-item">
                        <input
                          type="checkbox"
                          checked={item.checked}
                          onChange={() => onToggle(item.id)}
                        />
                        <span className="grocery-item-name">{item.name}</span>
                        {item.recipeName && <span className="grocery-item-recipe">{item.recipeName}</span>}
                        <div className="grocery-item-actions">
                          <button
                            type="button"
                            className="btn-icon btn-icon-small"
                            onClick={e => { e.preventDefault(); handleEdit(item) }}
                            title="Edit"
                          >
                            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                          </button>
                          <button
                            type="button"
                            className="btn-icon btn-icon-small btn-icon-danger"
                            onClick={e => { e.preventDefault(); onDeleteItem(item.id) }}
                            title="Delete"
                          >
                            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                          </button>
                        </div>
                      </label>
                    )}
                  </div>
                ))}
              </div>
            )
          })}
        </>
      )}

      <div className="grocery-add-section">
        {showAdd ? (
          <div className="grocery-add-form">
            <input
              type="text"
              value={newName}
              onChange={e => setNewName(e.target.value)}
              placeholder="Item name..."
              autoFocus
              onKeyDown={e => { if (e.key === 'Enter') handleAdd(); if (e.key === 'Escape') setShowAdd(false) }}
            />
            <select value={newCategory} onChange={e => setNewCategory(e.target.value)}>
              {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <button className="btn btn-primary btn-sm" onClick={handleAdd}>Add</button>
            <button className="btn btn-secondary btn-sm" onClick={() => setShowAdd(false)}>Cancel</button>
          </div>
        ) : (
          <button className="btn btn-outline btn-large grocery-add-btn" onClick={() => setShowAdd(true)}>
            + Add Custom Item
          </button>
        )}
      </div>
    </div>
  )
}

export default GroceryList
