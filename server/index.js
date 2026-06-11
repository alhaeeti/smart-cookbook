import app from './app.js'

const PORT = process.env.PORT || 3001

app.listen(PORT, () => {
  console.log(`Recipe server running on http://localhost:${PORT}`)
  console.log('[server] Environment check - NVIDIA_API_KEY set:', !!process.env.NVIDIA_API_KEY)
  console.log('[server] Environment check - NVIDIA_MODEL:', process.env.NVIDIA_MODEL || 'default')
})
