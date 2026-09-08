import { createHash, timingSafeEqual } from 'node:crypto'
import { AIError, LIMITS, onlyKeys, text, invalid } from './protocol.js'
export * from './protocol.js'

export function validatePDF(input) {
  onlyKeys(input, ['action', 'file', 'consent'])
  if (input.consent !== true) throw new AIError(400, 'CONSENT_REQUIRED', 'Autoriza el envío del PDF a Claude para continuar.')
  const file = onlyKeys(input.file, ['name', 'mime', 'base64', 'sha256'])
  const name = text(file.name, 200)
  if (file.mime !== 'application/pdf' || !/\.pdf$/i.test(name)) {
    throw new AIError(400, 'INVALID_PDF', 'Selecciona un archivo PDF.')
  }
  if (typeof file.base64 !== 'string') invalid()
  if (file.base64.length > Math.ceil(LIMITS.maxPdfBytes / 3) * 4) {
    throw new AIError(413, 'PDF_TOO_LARGE', 'El PDF debe pesar como máximo 3 MB.')
  }
  if (!file.base64.length || file.base64.length % 4 !== 0 || !/^[A-Za-z0-9+/]*={0,2}$/.test(file.base64)) invalid('El archivo PDF no tiene una codificación válida.')
  const bytes = Buffer.from(file.base64, 'base64')
  if (bytes.toString('base64') !== file.base64 || bytes.length < 8 || bytes.subarray(0, 5).toString('ascii') !== '%PDF-') {
    throw new AIError(400, 'INVALID_PDF', 'El archivo no parece ser un PDF válido.')
  }
  if (bytes.length > LIMITS.maxPdfBytes) throw new AIError(413, 'PDF_TOO_LARGE', 'El PDF debe pesar como máximo 3 MB.')
  const sha256 = createHash('sha256').update(bytes).digest('hex')
  if (typeof file.sha256 !== 'string' || !/^[a-fA-F0-9]{64}$/.test(file.sha256) || !timingSafeEqual(Buffer.from(sha256, 'hex'), Buffer.from(file.sha256, 'hex'))) {
    throw new AIError(400, 'FILE_HASH_MISMATCH', 'El archivo cambió durante la lectura. Vuelve a seleccionarlo.')
  }
  return { name, base64: file.base64, sha256 }
}
