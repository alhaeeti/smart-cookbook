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

function findAllJsonLd(html) {
  const blocks = []
  const patterns = [
    /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi,
    /<script[^>]*type=application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi,
  ]
  for (const regex of patterns) {
    let match
    while ((match = regex.exec(html)) !== null) {
      try {
        const data = JSON.parse(match[1].trim())
        const items = Array.isArray(data) ? data : (data['@graph'] || [data])
        for (const item of items) {
          if (item && typeof item === 'object' && item['@type']) {
            blocks.push(item)
          }
        }
      } catch {
        // skip malformed blocks
      }
    }
  }
  return blocks
}

function logAllJsonLdBlocks(html, label) {
  const blocks = findAllJsonLd(html)
  console.log(`[extract] ${label}: Total JSON-LD blocks found: ${blocks.length}`)
  for (let i = 0; i < blocks.length; i++) {
    const b = blocks[i]
    const type = b['@type'] || 'unknown'
    const name = b.name || b.headline || '(no name)'
    const isRecipe = type === 'Recipe' || type === 'http://schema.org/Recipe'
    const ings = isRecipe ? (Array.isArray(b.recipeIngredient) ? b.recipeIngredient.length : 0) : '-'
    const instr = isRecipe ? (Array.isArray(b.recipeInstructions) ? b.recipeInstructions.length : 0) : '-'
    console.log(`[extract] ${label}:   Block ${i}: @type="${type}", name="${name}", recipeIngredient=${ings}, recipeInstructions=${instr}`)
  }
}

function extractJsonLd(html) {
  const blocks = findAllJsonLd(html)
  for (const item of blocks) {
    const type = item['@type'] || ''
    if (type === 'Recipe' || type === 'http://schema.org/Recipe') {
      return item
    }
  }
  return null
}

function findRecipeContent(text) {
  const markers = [
    /^##\s*Ingredients/im,
    /^##\s*Directions/im,
    /^##\s*Instructions/im,
    /^##\s*Method/im,
  ]
  let firstIdx = text.length
  for (const marker of markers) {
    const m = marker.exec(text)
    if (m && m.index < firstIdx) {
      firstIdx = m.index
    }
  }
  if (firstIdx < text.length) {
    return text.slice(firstIdx).slice(0, 8000)
  }
  const lines = text.split('\n')
  const recipeLines = []
  let inRecipe = false
  for (const line of lines) {
    if (/^##\s+(Ingredients|Directions|Instructions|Method|Steps)/i.test(line)) {
      inRecipe = true
    }
    if (inRecipe) {
      recipeLines.push(line)
    }
  }
  if (recipeLines.length > 0) {
    return recipeLines.join('\n').slice(0, 8000)
  }
  const h1Line = lines.find(l => /^#\s+/.test(l))
  if (h1Line) {
    const h1Idx = lines.indexOf(h1Line)
    return lines.slice(h1Idx).join('\n').slice(0, 8000)
  }
  return text.slice(0, 8000)
}

function jsonLdToRecipe(data, url) {
  const ingredients = []
  if (Array.isArray(data.recipeIngredient)) {
    for (const i of data.recipeIngredient) {
      if (typeof i === 'string') ingredients.push(i)
      else if (i && typeof i === 'object' && i.name) ingredients.push(i.name)
    }
  }

  const steps = []
  if (Array.isArray(data.recipeInstructions)) {
    for (const instruction of data.recipeInstructions) {
      if (typeof instruction === 'string') {
        steps.push(instruction)
      } else if (instruction['@type'] === 'HowToStep' && instruction.text) {
        steps.push(instruction.text)
      } else if (instruction['@type'] === 'HowToSection') {
        if (instruction.name) steps.push(instruction.name)
        if (Array.isArray(instruction.itemListElement)) {
          for (const step of instruction.itemListElement) {
            if (typeof step === 'string') steps.push(step)
            else if (step.text) steps.push(step.text)
          }
        }
      } else if (instruction.itemListElement) {
        for (const step of instruction.itemListElement) {
          if (typeof step === 'string') steps.push(step)
          else if (step.text) steps.push(step.text)
        }
      } else if (instruction.name && typeof instruction.name === 'string') {
        steps.push(instruction.name)
      }
    }
  }

  let servings = '2'
  if (data.recipeYield) {
    if (Array.isArray(data.recipeYield)) {
      servings = String(data.recipeYield[0]).replace(/[^0-9]/g, '') || '2'
    } else {
      servings = String(data.recipeYield).replace(/[^0-9]/g, '') || '2'
    }
  }

  let category = data.recipeCategory || 'Dinner'
  if (Array.isArray(category)) category = category[0] || 'Dinner'

  return {
    name: data.name || 'Imported Recipe',
    servings,
    category,
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
  if (!og.title) {
    const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)
    if (titleMatch) {
      og.title = titleMatch[1].replace(/<[^>]+>/g, '').trim()
    }
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

async function fetchViaProxy(url) {
  const proxies = [
    { name: 'Jina', makeUrl: u => `https://r.jina.ai/${u}`, opts: { headers: { 'Accept': 'text/html' } } },
    { name: 'GoogleCache', makeUrl: u => `https://webcache.googleusercontent.com/search?q=cache:${u}`, opts: {} },
  ]
  for (const proxy of proxies) {
    try {
      const proxyUrl = proxy.makeUrl(url)
      console.log('[extract] Trying proxy:', proxy.name, proxyUrl.slice(0, 80))
      const res = await fetch(proxyUrl, {
        ...proxy.opts,
        signal: AbortSignal.timeout(20000),
      })
      if (res.ok) {
        const text = await res.text()
        if (text && text.length > 1000) {
          console.log('[extract] Proxy', proxy.name, 'returned:', text.length, 'bytes')
          return text
        }
      } else {
        console.log('[extract] Proxy', proxy.name, 'status:', res.status)
      }
    } catch (err) {
      console.log('[extract] Proxy error:', proxy.name, err.message)
    }
  }
  return null
}

function isErrorPage(text) {
  const errorPatterns = [
    /page\s+not\s+found/i,
    /access\s+denied/i,
    /attention\s+required/i,
    /404\s+not\s+found/i,
    /could\s+not\s+be\s+found/i,
    /this\s+page\s+(?:doesn't|does\s+not)\s+exist/i,
    /forbidden/i,
    /request\s+blocked/i,
    /cloudflare/i,
    /just\s+a\s+moment/i,
    /you\s+don't\s+have\s+permission/i,
    /blocked/i,
  ]
  const firstLines = text.slice(0, 500)
  for (const pattern of errorPatterns) {
    if (pattern.test(firstLines)) {
      return true
    }
  }
  const titleMatch = text.match(/<title[^>]*>([\s\S]*?)<\/title>/i)
  if (titleMatch) {
    const title = titleMatch[1].replace(/<[^>]+>/g, '').trim()
    const titlePatterns = [
      /^access\s+denied/i,
      /^forbidden/i,
      /^403/i,
      /^error/i,
      /^attention\s+required/i,
      /^page\s+not\s+found/i,
    ]
    for (const p of titlePatterns) {
      if (p.test(title)) return true
    }
  }
  return false
}

function isBlockedPage(text) {
  const blockedPatterns = [
    /access\s+denied/i,
    /attention\s+required/i,
    /cloudflare/i,
    /just\s+a\s+moment/i,
    /you\s+don't\s+have\s+permission/i,
    /request\s+blocked/i,
    /blocked/i,
    /403\s+forbidden/i,
  ]
  const firstLines = text.slice(0, 500)
  for (const pattern of blockedPatterns) {
    if (pattern.test(firstLines)) {
      return true
    }
  }
  return false
}

function isYoutubeUrl(url) {
  return /youtube\.com\/(watch\?v=|shorts\/|embed\/)|youtu\.be\//i.test(url)
}

function extractYoutubeVideoId(url) {
  const patterns = [
    /youtube\.com\/watch\?v=([^&?#]+)/,
    /youtu\.be\/([^?#]+)/,
    /youtube\.com\/shorts\/([^?#]+)/,
    /youtube\.com\/embed\/([^?#]+)/,
  ]
  for (const p of patterns) {
    const m = url.match(p)
    if (m) return m[1]
  }
  return null
}

async function fetchYoutubeMetadata(videoId) {
  const metadata = { title: '', description: '', thumbnail: '' }
  try {
    const res = await fetch(
      `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`,
      { signal: AbortSignal.timeout(8000) }
    )
    if (res.ok) {
      const data = await res.json()
      metadata.title = data.title || ''
      metadata.thumbnail = data.thumbnail_url || ''
    }
  } catch (err) {
    console.log('[youtube] oEmbed error:', err.message)
  }
  try {
    const pageRes = await fetch(`https://www.youtube.com/watch?v=${videoId}`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131.0.0.0 Safari/537.36',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      signal: AbortSignal.timeout(10000),
    })
    if (pageRes.ok) {
      const html = await pageRes.text()
      const playerMatch = html.match(/ytInitialPlayerResponse\s*=\s*({.*?});/)
      if (playerMatch) {
        try {
          const playerData = JSON.parse(playerMatch[1])
          const shortDesc = playerData?.videoDetails?.shortDescription
          if (shortDesc && shortDesc.length > metadata.description.length) {
            metadata.description = shortDesc
          }
        } catch {}
      }
      if (!metadata.description) {
        const descMatch = html.match(/<meta\s+name="description"\s+content="([^"]*)"/i)
        if (descMatch) {
          metadata.description = descMatch[1]
            .replace(/&amp;/g, '&').replace(/&#39;/g, "'").replace(/&quot;/g, '"')
        }
      }
      if (!metadata.thumbnail) {
        const thumbMatch = html.match(/<meta\s+property="og:image"\s+content="([^"]*)"/i)
        if (thumbMatch) metadata.thumbnail = thumbMatch[1]
      }
    }
  } catch (err) {
    console.log('[youtube] Page fetch error:', err.message)
  }
  return metadata
}

async function fetchYoutubeTranscript(videoId) {
  try {
    const pageRes = await fetch(`https://www.youtube.com/watch?v=${videoId}`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131.0.0.0 Safari/537.36',
      },
      signal: AbortSignal.timeout(10000),
    })
    if (!pageRes.ok) return null
    const html = await pageRes.text()
    const match = html.match(/ytInitialPlayerResponse\s*=\s*({.*?});/)
    if (!match) return null
    const data = JSON.parse(match[1])
    const tracks = data?.captions?.playerCaptionsTracklistRenderer?.captionTracks
    if (!tracks || !tracks.length) return null
    const enTrack = tracks.find(t => t.languageCode === 'en' || t.languageCode === 'en-US')
    if (!enTrack) return null
    const transcriptUrl = enTrack.baseUrl + '&fmt=json3'
    const transcriptRes = await fetch(transcriptUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
      signal: AbortSignal.timeout(10000),
    })
    if (!transcriptRes.ok) return null
    const transcriptData = await transcriptRes.json()
    const texts = []
    for (const event of transcriptData.events || []) {
      if (event.segs) {
        for (const seg of event.segs) {
          if (seg.utf8) texts.push(seg.utf8)
        }
      }
    }
    if (texts.length < 5) return null
    return texts.join(' ')
  } catch (err) {
    console.log('[youtube] Transcript error:', err.message)
    return null
  }
}

async function tryYoutubeExtraction(url) {
  console.log('[youtube] Starting YouTube extraction for:', url)
  const videoId = extractYoutubeVideoId(url)
  if (!videoId) {
    console.log('[youtube] Could not extract video ID')
    return null
  }
  console.log('[youtube] Video ID:', videoId)

  const metadata = await fetchYoutubeMetadata(videoId)
  console.log('[youtube] Metadata:', JSON.stringify({ title: metadata.title?.slice(0, 60), descLen: metadata.description?.length, hasThumb: !!metadata.thumbnail }))

  let text = ''
  if (metadata.title) text += `Recipe Video Title: ${metadata.title}\n\n`
  if (metadata.description) text += `Video Description:\n${metadata.description}\n\n`

  const transcript = await fetchYoutubeTranscript(videoId)
  if (transcript) {
    console.log('[youtube] Transcript length:', transcript.length)
    text += `Video Transcript:\n${transcript.slice(0, 5000)}`
  } else {
    console.log('[youtube] No transcript available')
  }

  if (!text || text.length < 20) {
    console.log('[youtube] Not enough text for AI extraction')
    return null
  }

  const recipe = await tryAiExtraction(text, url, 'YouTube')
  if (!recipe) {
    console.log('[youtube] AI extraction returned null')
    return null
  }

  recipe.sourceType = 'youtube'
  recipe.sourceUrl = url
  if (metadata.thumbnail) recipe.thumbnail = metadata.thumbnail

  if (recipe.ingredients.length < 2 || recipe.steps.length < 1) {
    recipe.warning = 'Recipe extraction may be incomplete. Please review before saving.'
  }

  console.log('[youtube] Extraction result:', recipe.name, 'ingredients:', recipe.ingredients.length, 'steps:', recipe.steps.length)
  return recipe
}

async function tryAiExtraction(text, sourceUrl, label) {
  console.log(`[extract] ${label}: AI extraction starting, text length: ${text.length}`)
  if (!process.env.NVIDIA_API_KEY) {
    console.log(`[extract] ${label}: No NVIDIA_API_KEY, skipping AI`)
    return null
  }
  const recipeSection = findRecipeContent(text)
  console.log(`[extract] ${label}: Recipe section length: ${recipeSection.length}`)
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
          { role: 'user', content: recipeSection },
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

  // ── YouTube detour ──
  if (isYoutubeUrl(url)) {
    console.log('[extract-recipe] Detected YouTube URL')
    const recipe = await tryYoutubeExtraction(url)
    if (recipe) {
      console.log('[extract-recipe] YouTube extraction succeeded')
      return res.json(recipe)
    }
    console.log('[extract-recipe] YouTube extraction failed')
    return res.status(422).json({
      error: 'We couldn\'t extract enough recipe details from this YouTube link. Paste the video description or transcript manually.',
    })
  }

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

  // ── Step 2: Log all JSON-LD blocks found ──
  if (directHtml) {
    logAllJsonLdBlocks(directHtml, 'direct-HTML')
  }

  // Detect error page
  const directIsError = directHtml ? isErrorPage(directHtml) : false
  const wasBlocked = directHtml ? isBlockedPage(directHtml) : false
  if (directIsError) {
    console.log('[extract-recipe] Direct HTML is an error page (blocked:', wasBlocked, '), marking as failed')
    directFetchFailed = true
  }

  // ── Step 2a: Try proxy HTML fetch if direct fetch failed ──
  let proxyHtml = null
  if (directFetchFailed) {
    console.log('[extract-recipe] Step 2a: Trying proxy HTML fetch')
    proxyHtml = await fetchViaProxy(url)
    if (proxyHtml) {
      logAllJsonLdBlocks(proxyHtml, 'proxy-HTML')
    }
  }

  // ── Step 2b: Try JSON-LD from proxy HTML ──
  if (proxyHtml) {
    console.log('[extract-recipe] Step 2b: Looking for JSON-LD in proxy HTML')
    const jsonLd = extractJsonLd(proxyHtml)
    if (jsonLd) {
      const recipe = jsonLdToRecipe(jsonLd, url)
      const hasIngredients = recipe.ingredients.length > 0
      const hasSteps = recipe.steps.length > 0
      console.log('[extract-recipe] Step 2b: JSON-LD from proxy, ingredients:', recipe.ingredients.length, 'steps:', recipe.steps.length)
      if (hasIngredients && hasSteps) {
        console.log('[extract-recipe] Step 2b: Complete JSON-LD from proxy, returning')
        return res.json(recipe)
      }
      if (hasIngredients || hasSteps) {
        console.log('[extract-recipe] Step 2b: Partial JSON-LD from proxy, saving as fallback')
        if (!fallbackRecipe) fallbackRecipe = recipe
      }
    } else {
      console.log('[extract-recipe] Step 2b: No JSON-LD in proxy HTML')
    }
  }

  // ── Step 2c: Try JSON-LD from direct HTML ──
  let fallbackRecipe = null
  if (directHtml && !directIsError) {
    console.log('[extract-recipe] Step 2c: Looking for JSON-LD schema.org Recipe in direct HTML')
    const jsonLd = extractJsonLd(directHtml)
    if (jsonLd) {
      const recipe = jsonLdToRecipe(jsonLd, url)
      const hasIngredients = recipe.ingredients.length > 0
      const hasSteps = recipe.steps.length > 0
      console.log('[extract-recipe] Step 2c: JSON-LD found, ingredients:', recipe.ingredients.length, 'steps:', recipe.steps.length)
      if (hasIngredients && hasSteps) {
        console.log('[extract-recipe] Step 2c: Complete JSON-LD recipe, returning')
        return res.json(recipe)
      }
      // Partial JSON-LD: save as fallback, continue to AI/Jina
      console.log('[extract-recipe] Step 2c: Partial JSON-LD, saving as fallback')
      fallbackRecipe = recipe
    } else {
      console.log('[extract-recipe] Step 2c: No JSON-LD found')
    }
  }

  // ── Step 3: Try AI on cleaned direct-fetch text ──
  if (directHtml && !directFetchFailed && !directIsError) {
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
      // Partial: save as fallback, continue to AI
      if (hasIngredients || hasSteps) {
        if (!fallbackRecipe) fallbackRecipe = recipe
      }
    }
  }

  // ── Step 6: Try AI on Jina text ──
  if (jinaText && jinaText.length > 100 && !isErrorPage(jinaText)) {
    console.log('[extract-recipe] Step 6: AI extraction on Jina content')
    const recipe = await tryAiExtraction(jinaText, url, 'Jina-AI')
    if (recipe) {
      console.log('[extract-recipe] Step 6: AI on Jina succeeded')
      return res.json(recipe)
    }
    console.log('[extract-recipe] Step 6: AI on Jina returned null')
  } else if (jinaText && isErrorPage(jinaText)) {
    console.log('[extract-recipe] Step 6: Skipping AI on Jina (page is error page)')
  }

  // ── Step 7: Return fallback (partial JSON-LD) if available ──
  if (fallbackRecipe) {
    console.log('[extract-recipe] Step 7: Returning fallback partial JSON-LD recipe')
    fallbackRecipe.warning = 'Recipe extraction may be incomplete. Please review before saving.'
    return res.json(fallbackRecipe)
  }

  // ── Step 8: Try OpenGraph from direct HTML as last resort ──
  if (directHtml && !directIsError) {
    const og = extractOpenGraph(directHtml)
    if (og.title) {
      const errorTitle = /^(access\s+denied|forbidden|error|403|attention\s+required|page\s+not\s+found)/i
      if (!errorTitle.test(og.title)) {
        console.log('[extract-recipe] Step 8: Returning OpenGraph fallback')
        const ogRecipe = {
          name: og.title,
          servings: '2',
          category: 'Dinner',
          ingredients: [],
          steps: [],
          sourceUrl: url,
          warning: 'We couldn\'t fully extract this recipe. Try another recipe site or paste the recipe text manually.',
        }
        return res.json(ogRecipe)
      }
      console.log('[extract-recipe] Step 8: Skipping OpenGraph (title is error page)')
    }
  }

  // ── Step 9: All methods failed ──
  console.log('[extract-recipe] All extraction methods failed for:', url)
  if (wasBlocked) {
    return res.status(422).json({
      error: 'This website blocks automated access. Paste recipe text instead.',
    })
  }
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
  if (/^(access\s+denied|forbidden|error|403|attention\s+required|page\s+not\s+found)/i.test(recipe.name)) {
    recipe.name = 'Imported Recipe'
  }
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
