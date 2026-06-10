export async function extractRecipeFromUrl(url) {
  const res = await fetch('/api/extract-recipe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url }),
  })

  const data = await res.json()

  if (!res.ok) {
    throw new Error(data.error || 'Could not extract recipe from this URL. Try Import Text instead.')
  }

  return data
}
