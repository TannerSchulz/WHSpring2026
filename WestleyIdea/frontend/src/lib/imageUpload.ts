// Reads an uploaded image file and returns a data URL suitable for localStorage.
// SVGs are kept as-is (they're small and scale perfectly); raster images are
// downscaled on a canvas so a phone photo doesn't blow the storage quota.

export const ACCEPTED_IMAGE_TYPES = 'image/png,image/jpeg,image/svg+xml,image/webp,image/gif'

export function processImageFile(file: File, maxDim: number): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) {
      reject(new Error('Please choose an image file (PNG, JPG, SVG, WebP, or GIF).'))
      return
    }
    const reader = new FileReader()
    reader.onerror = () => reject(new Error('Could not read that file.'))
    reader.onload = () => {
      const dataUrl = reader.result as string
      if (file.type === 'image/svg+xml') {
        resolve(dataUrl)
        return
      }
      const img = new Image()
      img.onerror = () => reject(new Error('That file doesn\'t look like a valid image.'))
      img.onload = () => {
        const scale = Math.min(1, maxDim / Math.max(img.width, img.height))
        if (scale === 1 && dataUrl.length < 150_000) {
          resolve(dataUrl)
          return
        }
        const canvas = document.createElement('canvas')
        canvas.width = Math.round(img.width * scale)
        canvas.height = Math.round(img.height * scale)
        const ctx = canvas.getContext('2d')
        if (!ctx) { resolve(dataUrl); return }
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
        // PNG preserves logo transparency; JPEG keeps photos small
        const isPhoto = file.type === 'image/jpeg'
        resolve(isPhoto ? canvas.toDataURL('image/jpeg', 0.85) : canvas.toDataURL('image/png'))
      }
      img.src = dataUrl
    }
    reader.readAsDataURL(file)
  })
}
