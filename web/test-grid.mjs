import { PDFDocument, rgb, StandardFonts } from 'pdf-lib'
import fs from 'fs'
import path from 'path'

const WEB_DIR = '/sessions/magical-friendly-sagan/mnt/logiSSign/web'
const OUTPUT_DIR = '/sessions/magical-friendly-sagan/mnt/logiSSign'

async function drawGrid() {
  const templateBytes = fs.readFileSync(path.join(WEB_DIR, 'public/contract-templates/form-permit-application.pdf'))
  const pdfDoc = await PDFDocument.load(templateBytes)
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica)
  const page = pdfDoc.getPages()[0]
  const { width, height } = page.getSize()
  console.log(`Page: ${width} x ${height}`)

  // Draw horizontal lines every 20pt with labels
  for (let y = 0; y <= height; y += 20) {
    const isHundred = y % 100 === 0
    page.drawLine({
      start: { x: 0, y },
      end: { x: width, y },
      thickness: isHundred ? 0.5 : 0.2,
      color: isHundred ? rgb(1, 0, 0) : rgb(0.7, 0.7, 1),
      opacity: 0.5,
    })
    if (y % 40 === 0) {
      page.drawText(`y=${y}`, {
        x: 2, y: y + 1, size: 6, font, color: rgb(1, 0, 0), opacity: 0.7,
      })
    }
  }

  // Draw vertical lines every 50pt
  for (let x = 0; x <= width; x += 50) {
    page.drawLine({
      start: { x, y: 0 },
      end: { x, y: height },
      thickness: x % 100 === 0 ? 0.5 : 0.2,
      color: rgb(0, 0.7, 0),
      opacity: 0.4,
    })
    if (x % 100 === 0) {
      page.drawText(`x=${x}`, {
        x: x + 1, y: 5, size: 6, font, color: rgb(0, 0.5, 0), opacity: 0.7,
      })
    }
  }

  const bytes = await pdfDoc.save()
  const out = path.join(OUTPUT_DIR, 'test-form1-grid.pdf')
  fs.writeFileSync(out, bytes)
  console.log(`✅ Grid PDF saved: ${out}`)
}

drawGrid().catch(console.error)
