import app from '../server/app.js'

// Safe handler — catches init errors so Vercel returns JSON, never HTML
export default function handler(req, res) {
  try {
    app(req, res)
  } catch (err) {
    console.error('[api] Handler error:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
}
