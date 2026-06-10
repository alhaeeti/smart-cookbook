const fs = require('fs')
const path = require('path')

async function main() {
  const src = path.join(__dirname, '..', 'public', 'icons', 'app-icon.png')
  const out = path.join(__dirname, '..', 'public', 'icons')

  if (!fs.existsSync(src)) {
    console.error('ERROR: Place your logo at public/icons/app-icon.png first.')
    process.exit(1)
  }

  try {
    const sharp = require('sharp')
    const sizes = [192, 512]

    for (const s of sizes) {
      await sharp(src)
        .resize(s, s, { fit: 'cover' })
        .png()
        .toFile(path.join(out, `icon-${s}.png`))

      await sharp(src)
        .resize(s, s, { fit: 'cover' })
        .png()
        .toFile(path.join(out, `maskable-${s}.png`))
    }

    console.log('Icons generated:')
    for (const s of sizes) {
      const a = fs.statSync(path.join(out, `icon-${s}.png`)).size
      const b = fs.statSync(path.join(out, `maskable-${s}.png`)).size
      console.log(`  icon-${s}.png (${a} bytes), maskable-${s}.png (${b} bytes)`)
    }
  } catch (e) {
    console.error('ERROR:', e.message)
    console.error('Install sharp with: npm install sharp')
    process.exit(1)
  }
}

main()
