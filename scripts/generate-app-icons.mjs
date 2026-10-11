import fs from 'node:fs/promises'
import path from 'node:path'
import sharp from 'sharp'

// Pure asset conversion using the prebuilt sharp runtime; no compiler needed.
const desktop = path.resolve('packages/desktop')
const input = await fs.readFile(process.argv[2] || path.join(desktop, 'static/icon.png'))
const sizes = [16, 24, 32, 48, 64, 128, 256, 512, 1024]
const images = new Map()
for (const size of sizes) {
  images.set(size, await sharp(input).resize(size, size, { fit: 'contain' }).png().toBuffer())
}
await fs.writeFile(path.join(desktop, 'static/icon.png'), input)
await fs.writeFile(path.join(desktop, 'build/icons/icon.png'), images.get(1024))
await fs.writeFile(path.join(desktop, 'src/renderer/src/assets/images/logo.png'), images.get(256))
await fs.writeFile(path.join(desktop, 'static/logo-small.png'), images.get(32))
await fs.writeFile(
  path.join(desktop, 'static/logo-96px.png'),
  await sharp(input).resize(96, 96).png().toBuffer()
)
for (const size of sizes.filter((size) => size <= 512)) {
  const dir = path.join(desktop, `build/icons/${size}x${size}`)
  await fs.mkdir(dir, { recursive: true })
  await fs.writeFile(path.join(dir, 'marktext.png'), images.get(size))
}
const icoSizes = sizes.filter((size) => size <= 256)
const header = Buffer.alloc(6 + icoSizes.length * 16)
header.writeUInt16LE(1, 2)
header.writeUInt16LE(icoSizes.length, 4)
let offset = header.length
icoSizes.forEach((size, i) => {
  const entry = 6 + i * 16
  const png = images.get(size)
  header[entry] = header[entry + 1] = size === 256 ? 0 : size
  header.writeUInt16LE(1, entry + 4)
  header.writeUInt16LE(32, entry + 6)
  header.writeUInt32LE(png.length, entry + 8)
  header.writeUInt32LE(offset, entry + 12)
  offset += png.length
})
const ico = Buffer.concat([header, ...icoSizes.map((size) => images.get(size))])
const chunks = [
  [16, 'icp4'],
  [32, 'icp5'],
  [64, 'icp6'],
  [128, 'ic07'],
  [256, 'ic08'],
  [512, 'ic09'],
  [1024, 'ic10']
].map(([size, type]) => {
  const png = images.get(size)
  const block = Buffer.alloc(8)
  block.write(type)
  block.writeUInt32BE(8 + png.length, 4)
  return Buffer.concat([block, png])
})
const icnsHeader = Buffer.alloc(8)
icnsHeader.write('icns')
icnsHeader.writeUInt32BE(8 + chunks.reduce((sum, b) => sum + b.length, 0), 4)
const icns = Buffer.concat([icnsHeader, ...chunks])
for (const dir of ['static', 'build/icons']) {
  await fs.writeFile(path.join(desktop, dir, 'icon.ico'), ico)
  await fs.writeFile(path.join(desktop, dir, 'icon.icns'), icns)
}
console.log('Generated application icons in PNG, ICO and ICNS formats.')
