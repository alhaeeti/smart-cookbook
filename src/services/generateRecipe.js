export async function generateRecipe({ ingredients, cuisine, mealType }) {
  const res = await fetch('/api/generate-recipe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ingredients, cuisine, mealType }),
  })

  let data
  try {
    data = await res.json()
  } catch {
    throw new Error('Could not generate recipe. Please try again.')
  }

  if (!res.ok) {
    throw new Error(data.error || 'Could not generate recipe. Please try again.')
  }

  return data
}
