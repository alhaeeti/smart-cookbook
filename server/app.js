import express from 'express'
import cors from 'cors'
import 'dotenv/config'

const app = express()

app.use(cors())
app.use(express.json())

// Startup logging
console.log('[server] NODE_ENV:', process.env.NODE_ENV)
console.log('[server] NVIDIA_API_KEY set:', !!process.env.NVIDIA_API_KEY)
console.log('[server] NVIDIA_MODEL:', process.env.NVIDIA_MODEL || 'default (meta/llama-3.3-70b-instruct)')

app.set('trust proxy', true)

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    ok: true,
    envKey: !!process.env.NVIDIA_API_KEY,
    model: process.env.NVIDIA_MODEL || null,
  })
})

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

const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/605.1.15 Chrome/120 Safari/605.1.15',
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148',
  'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/120 Mobile Safari/537.36',
]

function pickUA() {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)]
}

async function fetchWithFallback(url, timeoutMs = 15000) {
  const ua = pickUA()
  console.log('[extract] Fetching with UA:', ua.slice(0, 50))
  const res = await fetch(url, {
    headers: {
      'User-Agent': ua,
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
      'Cache-Control': 'no-cache',
    },
    signal: AbortSignal.timeout(timeoutMs),
  })
  return res
}

async function tryAiExtraction(text, sourceUrl, label) {
  console.log(`[extract] ${label}: AI extraction starting, text length: ${text.length}`)
  if (!process.env.NVIDIA_API_KEY) {
    console.log(`[extract] ${label}: No NVIDIA_API_KEY, skipping AI`)
    return null
  }
  const systemMessage = `You are a recipe extractor. Extract recipe information from the provided text and return ONLY valid JSON with this exact structure, no markdown, no extra text:
{
  "name": "Recipe name",
  "servings": 2,
  "category": "Breakfast|Lunch|Dinner|Dessert|Drinks",
  "ingredients": ["ingredient 1", "ingredient 2"],
  "steps": ["step 1", "step 2"]
}

If category is not clear, use "Dinner". If ingredients or steps are missing, use empty arrays. Servings defaults to 2 if not found.`
  try {
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
          { role: 'user', content: text.slice(0, 8000) },
        ],
        temperature: 0.1,
        max_tokens: 1500,
      }),
      signal: AbortSignal.timeout(30000),
    })
    console.log(`[extract] ${label}: AI response status:`, aiRes.status)
    if (!aiRes.ok) {
      const errText = await aiRes.text()
      console.error(`[extract] ${label}: AI API error:`, aiRes.status, errText)
      return null
    }
    const aiData = await aiRes.json()
    let content = aiData.choices?.[0]?.message?.content
    if (!content) {
      console.error(`[extract] ${label}: AI returned empty content`)
      return null
    }
    content = content.replace(/^```(?:json)?\s*/, '').replace(/\s*```$/, '').trim()
    const recipe = JSON.parse(content)
    recipe.sourceUrl = sourceUrl
    return finalizeRecipe(recipe, sourceUrl)
  } catch (err) {
    console.error(`[extract] ${label}: AI extraction error:`, err.message)
    return null
  }
}

app.post('/api/extract-recipe', async (req, res) => {
  const { url } = req.body
  console.log('[extract-recipe] Request received', { url })
  if (!url) return res.status(400).json({ error: 'URL is required' })

  const domain = new URL(url).hostname
  console.log('[extract-recipe] Domain:', domain)

  // ── Step 1: Direct page fetch ──
  let directHtml = null
  let directFetchFailed = false
  try {
    console.log('[extract-recipe] Step 1: Direct page fetch')
    const pageRes = await fetchWithFallback(url)
    console.log('[extract-recipe] Step 1: Status', pageRes.status, pageRes.statusText)
    if (pageRes.ok) {
      directHtml = await pageRes.text()
      console.log('[extract-recipe] Step 1: HTML length:', directHtml.length)
      // If page is too short, likely blocked — treat as failed
      if (directHtml.length < 500) {
        console.log('[extract-recipe] Step 1: HTML too short (' + directHtml.length + '), treating as blocked')
        directFetchFailed = true
      }
    } else {
      directFetchFailed = true
      const body = await pageRes.text().catch(() => '')
      console.log('[extract-recipe] Step 1: Non-OK response, body length:', body.length)
      // Still try to extract from error page body
      if (body.length > 100) directHtml = body
    }
  } catch (err) {
    console.log('[extract-recipe] Step 1: Fetch error:', err.message)
    directFetchFailed = true
  }

  // ── Step 2: Try JSON-LD from direct HTML ──
  if (directHtml) {
    console.log('[extract-recipe] Step 2: Looking for JSON-LD schema.org Recipe')
    const jsonLd = extractJsonLd(directHtml)
    if (jsonLd) {
      const recipe = jsonLdToRecipe(jsonLd, url)
      const hasIngredients = recipe.ingredients.length > 0
      const hasSteps = recipe.steps.length > 0
      console.log('[extract-recipe] Step 2: JSON-LD found, ingredients:', recipe.ingredients.length, 'steps:', recipe.steps.length)
      if (hasIngredients && hasSteps) {
        console.log('[extract-recipe] Step 2: Complete JSON-LD recipe, returning')
        return res.json(recipe)
      }
      // Partial JSON-LD: attach warning, return what we have
      console.log('[extract-recipe] Step 2: Partial JSON-LD, attaching warning')
      recipe.warning = 'Recipe extraction may be incomplete. Please review before saving.'
      return res.json(recipe)
    }
    console.log('[extract-recipe] Step 2: No JSON-LD found')
  }

  // ── Step 3: Try AI on cleaned direct-fetch text ──
  if (directHtml && !directFetchFailed) {
    console.log('[extract-recipe] Step 3: AI extraction on direct fetch text')
    const cleaned = extractTextFromHtml(directHtml)
    if (cleaned && cleaned.length > 100) {
      const recipe = await tryAiExtraction(cleaned, url, 'direct-AI')
      if (recipe) {
        console.log('[extract-recipe] Step 3: AI extraction succeeded, returning recipe')
        return res.json(recipe)
      }
      console.log('[extract-recipe] Step 3: AI extraction returned null')
    } else {
      console.log('[extract-recipe] Step 3: Cleaned text too short (' + (cleaned?.length || 0) + '), skipping AI')
    }
  } else {
    console.log('[extract-recipe] Step 3: Skipping direct AI (fetch failed or no HTML)')
  }

  // ── Step 4: Jina Reader fallback ──
  let jinaText = null
  try {
    console.log('[extract-recipe] Step 4: Jina Reader fallback')
    const jinaUrl = `https://r.jina.ai/${url}`
    const jinaRes = await fetch(jinaUrl, {
      headers: {
        'Accept': 'text/plain',
        ...(process.env.JINA_API_KEY ? { 'Authorization': `Bearer ${process.env.JINA_API_KEY}` } : {}),
      },
      signal: AbortSignal.timeout(20000),
    })
    console.log('[extract-recipe] Step 4: Jina status:', jinaRes.status)
    if (jinaRes.ok) {
      jinaText = await jinaRes.text()
      console.log('[extract-recipe] Step 4: Jina content length:', jinaText.length)
    } else {
      const jinaErr = await jinaRes.text().catch(() => '')
      console.log('[extract-recipe] Step 4: Jina error:', jinaRes.status, jinaErr.slice(0, 200))
    }
  } catch (err) {
    console.log('[extract-recipe] Step 4: Jina fetch error:', err.message)
  }

  // ── Step 5: Try JSON-LD from Jina text ──
  if (jinaText) {
    console.log('[extract-recipe] Step 5: Looking for JSON-LD in Jina content')
    const jsonLd = extractJsonLd(jinaText)
    if (jsonLd) {
      const recipe = jsonLdToRecipe(jsonLd, url)
      const hasIngredients = recipe.ingredients.length > 0
      const hasSteps = recipe.steps.length > 0
      console.log('[extract-recipe] Step 5: JSON-LD from Jina, ingredients:', recipe.ingredients.length, 'steps:', recipe.steps.length)
      if (hasIngredients && hasSteps) {
        return res.json(recipe)
      }
      if (hasIngredients || hasSteps) {
        recipe.warning = 'Recipe extraction may be incomplete. Please review before saving.'
        return res.json(recipe)
      }
    }
  }

  // ── Step 6: Try AI on Jina text ──
  if (jinaText && jinaText.length > 100) {
    console.log('[extract-recipe] Step 6: AI extraction on Jina content')
    const recipe = await tryAiExtraction(jinaText, url, 'Jina-AI')
    if (recipe) {
      console.log('[extract-recipe] Step 6: AI on Jina succeeded')
      return res.json(recipe)
    }
    console.log('[extract-recipe] Step 6: AI on Jina returned null')
  }

  // ── Step 7: All methods failed ──
  console.log('[extract-recipe] All extraction methods failed for:', url)
  return res.status(422).json({
    error: 'We couldn\'t automatically extract this recipe. Try another recipe site or paste the recipe text manually.',
  })
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

  console.log('[generate-recipe] Request body:', JSON.stringify(req.body))

  if (!ingredients || !ingredients.trim()) {
    return res.status(400).json({ error: 'Ingredients are required' })
  }

  try {
    const keySet = !!process.env.NVIDIA_API_KEY
    const model = process.env.NVIDIA_MODEL || 'meta/llama-3.3-70b-instruct'
    console.log('[generate-recipe] NVIDIA_API_KEY set:', keySet)
    console.log('[generate-recipe] NVIDIA_MODEL:', model)

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
    console.log('[generate-recipe] Fetch URL: https://integrate.api.nvidia.com/v1/chat/completions')
    console.log('[generate-recipe] Request model:', model)
    console.log('[generate-recipe] Request body:', JSON.stringify({
      model,
      messages: [
        { role: 'system', content: '(truncated)' },
        { role: 'user', content: userPrompt.slice(0, 200) },
      ],
      temperature: 0.1,
      max_tokens: 1500,
    }))

    const aiRes = await fetch('https://integrate.api.nvidia.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.NVIDIA_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
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
    console.log('[generate-recipe] NVIDIA response ok:', aiRes.ok)

    if (!aiRes.ok) {
      const errText = await aiRes.text()
      console.error('[generate-recipe] NVIDIA API error body:', errText)
      return res.status(502).json({
        error: 'NVIDIA_ERROR',
        status: aiRes.status,
        details: errText,
      })
    }

    const aiData = await aiRes.json()
    let content = aiData.choices?.[0]?.message?.content
    console.log('[generate-recipe] NVIDIA response data keys:', Object.keys(aiData))
    console.log('[generate-recipe] NVIDIA choices length:', aiData.choices?.length)

    if (!content) {
      console.error('[generate-recipe] NVIDIA returned empty content')
      return res.status(502).json({ error: 'AI returned empty response' })
    }

    console.log('[generate-recipe] NVIDIA raw content length:', content.length)
    console.log('[generate-recipe] NVIDIA raw content (first 200):', content.slice(0, 200))

    content = content.replace(/^```(?:json)?\s*/, '').replace(/\s*```$/, '').trim()

    let recipe
    try {
      recipe = JSON.parse(content)
    } catch (parseErr) {
      console.error('[generate-recipe] JSON parse error on content:', content.substring(0, 500))
      return res.status(502).json({
        error: 'AI returned invalid JSON',
        details: content.slice(0, 500),
      })
    }

    const result = finalizeRecipe(recipe, '')
    console.log('[generate-recipe] Success, returning recipe:', result.name, 'ingredients:', result.ingredients.length, 'steps:', result.steps.length)
    res.json(result)
  } catch (err) {
    console.error('[generate-recipe] Unhandled error:', err.message, err.stack)
    console.error('[generate-recipe] Error name:', err.name)
    console.error('[generate-recipe] Error code:', err.code)
    console.error('[generate-recipe] Full error:', JSON.stringify(err, Object.getOwnPropertyNames(err)))
    if (err.name === 'AbortError' || err.code === 'UND_ERR_CONNECT_TIMEOUT') {
      return res.status(504).json({ error: 'Request timed out' })
    }
    console.error('[generate-recipe] Error:', err.message)
    res.status(500).json({
      error: 'Internal server error',
      details: err.message,
      name: err.name,
    })
  }
})

// Global error handler — always returns JSON
app.use((err, req, res, next) => {
  console.error('[server] Unhandled error:', err.message, err.stack)
  res.status(500).json({ error: 'Internal server error' })
})

export default app
