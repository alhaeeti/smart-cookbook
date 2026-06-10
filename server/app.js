import express from 'express'
import cors from 'cors'
import 'dotenv/config'

const app = express()

app.use(cors())
app.use(express.json())

function extractTextFromHtml(html) {
  let text = html
  text = text.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
  text = text.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
  text = text.replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, '')
  text = text.replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, '')
  text = text.replace(/<header[^>]*>[\s\S]*?<\/header>/gi, '')
  text = text.replace(/<[^>]+>/g, ' ')
  text = text.replace(/&amp;/g, '&')
  text = text.replace(/&lt;/g, '<')
  text = text.replace(/&gt;/g, '>')
  text = text.replace(/&quot;/g, '"')
  text = text.replace(/&#x27;/g, "'")
  text = text.replace(/&#x2F;/g, '/')
  text = text.replace(/&nbsp;/g, ' ')
  text = text.replace(/\s+/g, ' ').trim()
  const lines = text.split(/\n\s*\n/).map(l => l.trim()).filter(l => l.length > 40)
  return lines.slice(0, 60).join('\n\n')
}

function extractJsonLd(html) {
  const regex = /<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi
  let match
  while ((match = regex.exec(html)) !== null) {
    try {
      const parsed = JSON.parse(match[1].trim())
      const items = parsed['@graph'] || [parsed]
      for (const item of items) {
        if (item['@type'] === 'Recipe' || item['@type'] === 'http://schema.org/Recipe') {
          return item
        }
      }
    } catch {
      // skip malformed JSON-LD blocks
    }
  }
  return null
}

function jsonLdToRecipe(data, url) {
  const ingredients = Array.isArray(data.recipeIngredient)
    ? data.recipeIngredient.map(i => typeof i === 'string' ? i : '').filter(Boolean)
    : []

  const steps = []
  if (Array.isArray(data.recipeInstructions)) {
    for (const instruction of data.recipeInstructions) {
      if (typeof instruction === 'string') {
        steps.push(instruction)
      } else if (instruction['@type'] === 'HowToStep' && instruction.text) {
        steps.push(instruction.text)
      } else if (instruction.itemListElement) {
        for (const step of instruction.itemListElement) {
          if (step.text) steps.push(step.text)
        }
      }
    }
  }

  return {
    name: data.name || 'Imported Recipe',
    servings: data.recipeYield ? String(data.recipeYield).replace(/[^0-9]/g, '') || '2' : '2',
    category: data.recipeCategory || data['@type'] || 'Dinner',
    ingredients,
    steps,
    sourceUrl: url,
  }
}

function extractOpenGraph(html) {
  const og = {}
  const regex = /<meta\s+(?:property|name)="(?:og:)?([^"]+)"\s+content="([^"]*)"[^>]*>/gi
  let match
  while ((match = regex.exec(html)) !== null) {
    og[match[1].toLowerCase()] = match[2]
  }
  return og
}

app.post('/api/extract-recipe', async (req, res) => {
  const { url } = req.body

  console.log('[extract-recipe] Request received', { url })

  if (!url) {
    return res.status(400).json({ error: 'URL is required' })
  }

  try {
    console.log('[extract-recipe] Fetching URL:', url)

    const pageRes = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      signal: AbortSignal.timeout(10000),
    })

    console.log('[extract-recipe] Fetch response:', pageRes.status, pageRes.statusText)

    if (!pageRes.ok) {
      const html = await pageRes.text().catch(() => '')
      console.log('[extract-recipe] Page fetch failed, html length:', html.length)

      // Try JSON-LD from error page
      const jsonLd = extractJsonLd(html)
      if (jsonLd) {
        console.log('[extract-recipe] Found JSON-LD in error page')
        const recipe = jsonLdToRecipe(jsonLd, url)
        return res.json({ ...recipe, warning: 'Recipe extraction may be incomplete. Please review before saving.', confidence: 40 })
      }

      // Try OpenGraph from error page
      const og = extractOpenGraph(html)
      if (og.title) {
        console.log('[extract-recipe] Found OpenGraph in error page')
        return res.json({
          name: og.title,
          servings: '2',
          category: 'Dinner',
          ingredients: [],
          steps: [],
          sourceUrl: url,
          warning: 'Recipe extraction may be incomplete. Please review before saving.',
          confidence: 20,
        })
      }

      const domain = new URL(url).hostname
      console.error('[extract-recipe] Blocked domain:', domain, 'Status:', pageRes.status, pageRes.statusText)
      return res.status(422).json({ error: 'This website blocks direct access. Paste recipe text instead.' })
    }

    const html = await pageRes.text()
    console.log('[extract-recipe] Page HTML length:', html.length)

    // Try JSON-LD from page body (skip AI if we have structured data)
    const jsonLd = extractJsonLd(html)
    if (jsonLd) {
      const recipe = jsonLdToRecipe(jsonLd, url)
      if (recipe.ingredients.length > 0 || recipe.steps.length > 0) {
        console.log('[extract-recipe] Used JSON-LD data, ingredients:', recipe.ingredients.length, 'steps:', recipe.steps.length)
        return res.json(recipe)
      }
    }

    const cleaned = extractTextFromHtml(html)
    console.log('[extract-recipe] Cleaned text length:', cleaned?.length)

    if (!cleaned) {
      return res.status(422).json({ error: 'Could not extract text from URL' })
    }

    console.log('[extract-recipe] Calling NVIDIA AI...')
    console.log('[extract-recipe] NVIDIA_API_KEY set:', !!process.env.NVIDIA_API_KEY)
    console.log('[extract-recipe] NVIDIA_MODEL:', process.env.NVIDIA_MODEL)

    const systemMessage = `You are a recipe extractor. Extract recipe information from the provided text and return ONLY valid JSON with this exact structure, no markdown, no extra text:
{
  "name": "Recipe name",
  "servings": 2,
  "category": "Breakfast|Lunch|Dinner|Dessert|Drinks",
  "ingredients": ["ingredient 1", "ingredient 2"],
  "steps": ["step 1", "step 2"],
  "sourceUrl": "${url.replace(/"/g, '\\"')}"
}

If category is not clear, use "Dinner". If ingredients or steps are missing, use empty arrays. Servings defaults to 2 if not found.`

    const aiRes = await fetch('https://integrate.api.nvidia.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.NVIDIA_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: process.env.NVIDIA_MODEL || 'meta/llama-3.3-70b-instruct',
        messages: [
          { role: 'system', content: systemMessage },
          { role: 'user', content: cleaned.slice(0, 8000) },
        ],
        temperature: 0.1,
        max_tokens: 1500,
      }),
      signal: AbortSignal.timeout(30000),
    })

    console.log('[extract-recipe] NVIDIA AI response status:', aiRes.status)

    if (!aiRes.ok) {
      const errText = await aiRes.text()
      console.error('[extract-recipe] NVIDIA API error:', aiRes.status, errText)
      return res.status(502).json({ error: 'AI extraction failed' })
    }

    const aiData = await aiRes.json()
    let content = aiData.choices?.[0]?.message?.content

    if (!content) {
      console.error('[extract-recipe] NVIDIA returned empty content')
      return res.status(502).json({ error: 'AI returned empty response' })
    }

    console.log('[extract-recipe] NVIDIA raw content length:', content.length)

    content = content.replace(/^```(?:json)?\s*/, '').replace(/\s*```$/, '').trim()

    let recipe
    try {
      recipe = JSON.parse(content)
    } catch (parseErr) {
      console.error('[extract-recipe] JSON parse error on content:', content.substring(0, 500))
      return res.status(502).json({ error: 'AI returned invalid JSON' })
    }

    // Clean raw output
    recipe.sourceUrl = url
    recipe.ingredients = Array.isArray(recipe.ingredients) ? recipe.ingredients : []
    recipe.steps = Array.isArray(recipe.steps) ? recipe.steps : []

    recipe.ingredients = recipe.ingredients
      .map(i => i.trim())
      .filter((i, idx, arr) => i && arr.findIndex(x => x.toLowerCase() === i.toLowerCase()) === idx)

    recipe.steps = recipe.steps
      .map(s => s.trim().replace(/^(Step\s+\d+[:\s]+|Step\s+#?\d+\s*[:\-–—]?\s*|\d+[\.\)]\s*|\d+\.\s*)/i, '').trim())
      .filter((s, idx, arr) => s && arr.findIndex(x => x.toLowerCase() === s.toLowerCase()) === idx)

    if (!recipe.name || !recipe.name.trim()) {
      recipe.name = 'Imported Recipe'
    }
    recipe.name = recipe.name.trim()
    recipe.servings = recipe.servings || 2
    recipe.category = recipe.category || 'Dinner'

    // Confidence score (0-100)
    let score = 0
    if (recipe.name && recipe.name !== 'Imported Recipe') score += 20
    if (recipe.servings) score += 10
    if (recipe.category) score += 10
    score += Math.min(recipe.ingredients.length * 5, 30)
    score += Math.min(recipe.steps.length * 5, 30)
    recipe.confidence = score

    // Validation warning (always return recipe, warn if weak)
    let warning = ''
    if (recipe.ingredients.length < 2 || recipe.steps.length < 1) {
      warning = 'Recipe extraction may be incomplete. Please review before saving.'
    }
    if (warning) recipe.warning = warning

    console.log('[extract-recipe] Success, returning recipe:', recipe.name, 'ingredients:', recipe.ingredients.length, 'steps:', recipe.steps.length)
    res.json(recipe)
  } catch (err) {
    console.error('[extract-recipe] Unhandled error:', err.message, err.stack)
    if (err.name === 'AbortError' || err.code === 'UND_ERR_CONNECT_TIMEOUT') {
      return res.status(504).json({ error: 'Request timed out' })
    }
    const domain = url ? new URL(url).hostname : 'unknown'
    console.error('[extract-recipe] Blocked domain:', domain, 'Error:', err.message)
    return res.status(422).json({ error: 'This website blocks direct access. Paste recipe text instead.' })
  }
})

// Clean + validate a recipe object (shared by extract and generate)
function finalizeRecipe(recipe, sourceUrl) {
  recipe.sourceUrl = sourceUrl || ''
  recipe.ingredients = Array.isArray(recipe.ingredients) ? recipe.ingredients : []
  recipe.steps = Array.isArray(recipe.steps) ? recipe.steps : []

  recipe.ingredients = recipe.ingredients
    .map(i => i.trim())
    .filter((i, idx, arr) => i && arr.findIndex(x => x.toLowerCase() === i.toLowerCase()) === idx)

  recipe.steps = recipe.steps
    .map(s => s.trim().replace(/^(Step\s+\d+[:\s]+|Step\s+#?\d+\s*[:\-–—]?\s*|\d+[\.\)]\s*|\d+\.\s*)/i, '').trim())
    .filter((s, idx, arr) => s && arr.findIndex(x => x.toLowerCase() === s.toLowerCase()) === idx)

  if (!recipe.name || !recipe.name.trim()) recipe.name = 'Imported Recipe'
  recipe.name = recipe.name.trim()
  recipe.servings = recipe.servings || 2
  recipe.category = recipe.category || 'Dinner'

  let score = 0
  if (recipe.name && recipe.name !== 'Imported Recipe') score += 20
  if (recipe.servings) score += 10
  if (recipe.category) score += 10
  score += Math.min(recipe.ingredients.length * 5, 30)
  score += Math.min(recipe.steps.length * 5, 30)
  recipe.confidence = score

  if (recipe.ingredients.length < 2 || recipe.steps.length < 1) {
    recipe.warning = 'Recipe extraction may be incomplete. Please review before saving.'
  }

  return recipe
}

app.post('/api/generate-recipe', async (req, res) => {
  const { ingredients, cuisine, mealType } = req.body

  console.log('[generate-recipe] Request received', { ingredients, cuisine, mealType })

  if (!ingredients || !ingredients.trim()) {
    return res.status(400).json({ error: 'Ingredients are required' })
  }

  try {
    console.log('[generate-recipe] NVIDIA_API_KEY set:', !!process.env.NVIDIA_API_KEY)
    console.log('[generate-recipe] NVIDIA_MODEL:', process.env.NVIDIA_MODEL)

    const systemMessage = `You are a recipe generator. Generate a complete recipe based on the given ingredients. Return ONLY valid JSON with this exact structure, no markdown, no extra text:
{
  "name": "Recipe name",
  "servings": 2,
  "category": "Breakfast|Lunch|Dinner|Dessert|Drinks",
  "ingredients": ["ingredient 1", "ingredient 2"],
  "steps": ["step 1", "step 2"]
}

Use category Breakfast, Lunch, Dinner, Dessert, or Drinks. Default to Dinner if unsure. Default servings to 2.`

    let userPrompt = `Ingredients: ${ingredients.trim()}`
    if (cuisine) userPrompt += `\nCuisine: ${cuisine}`
    if (mealType) userPrompt += `\nMeal type: ${mealType}`

    console.log('[generate-recipe] Calling NVIDIA AI...')

    const aiRes = await fetch('https://integrate.api.nvidia.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.NVIDIA_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: process.env.NVIDIA_MODEL || 'meta/llama-3.3-70b-instruct',
        messages: [
          { role: 'system', content: systemMessage },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.1,
        max_tokens: 1500,
      }),
      signal: AbortSignal.timeout(30000),
    })

    console.log('[generate-recipe] NVIDIA response status:', aiRes.status)

    if (!aiRes.ok) {
      const errText = await aiRes.text()
      console.error('[generate-recipe] NVIDIA API error body:', errText)
      return res.status(502).json({ error: 'AI generation failed' })
    }

    const aiData = await aiRes.json()
    let content = aiData.choices?.[0]?.message?.content

    if (!content) {
      console.error('[generate-recipe] NVIDIA returned empty content')
      return res.status(502).json({ error: 'AI returned empty response' })
    }

    console.log('[generate-recipe] NVIDIA raw content length:', content.length)

    content = content.replace(/^```(?:json)?\s*/, '').replace(/\s*```$/, '').trim()

    let recipe
    try {
      recipe = JSON.parse(content)
    } catch (parseErr) {
      console.error('[generate-recipe] JSON parse error on content:', content.substring(0, 500))
      return res.status(502).json({ error: 'AI returned invalid JSON' })
    }

    const result = finalizeRecipe(recipe, '')
    console.log('[generate-recipe] Success, returning recipe:', result.name, 'ingredients:', result.ingredients.length, 'steps:', result.steps.length)
    res.json(result)
  } catch (err) {
    console.error('[generate-recipe] Unhandled error:', err.message, err.stack)
    if (err.name === 'AbortError' || err.code === 'UND_ERR_CONNECT_TIMEOUT') {
      return res.status(504).json({ error: 'Request timed out' })
    }
    console.error('[generate-recipe] Error:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
})

export default app
