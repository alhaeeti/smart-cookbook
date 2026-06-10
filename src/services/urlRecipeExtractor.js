export async function extractRecipeFromUrl(url) {
  const res = await fetch('/api/extract-recipe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url }),
  })

  let data
  try {
    data = await res.json()
  } catch {
    throw new Error('Could not extract recipe. The server returned an invalid response.')
  }

  if (!res.ok) {
    throw new Error(data.error || 'Could not extract recipe from this URL. Try Import Text instead.')
  }

  return data
}
