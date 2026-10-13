// Shrink an image in the browser before it's uploaded (SPEC M2c, POST /api/media):
// photos to 2000 px on the long edge as WebP (JPEG if the browser can't encode
// WebP); logos to 512 px as PNG, which keeps transparency and is the format
// the server's link-preview renderer can draw (it can't decode WebP).

export interface ShrunkImage {
  blob: Blob
  width: number
  height: number
  ext: 'webp' | 'jpg' | 'png'
}

function toBlob(canvas: HTMLCanvasElement, type: string, quality?: number): Promise<Blob | null> {
  return new Promise(resolve => canvas.toBlob(resolve, type, quality))
}

export async function shrinkImage(file: File, maxEdge: number, as: 'photo' | 'logo' = 'photo'): Promise<ShrunkImage> {
  let bitmap: ImageBitmap
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
  }
  catch {
    throw new Error('Couldn\'t read that image. Use JPG, PNG or WebP.')
  }
  const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height))
  const width = Math.max(1, Math.round(bitmap.width * scale))
  const height = Math.max(1, Math.round(bitmap.height * scale))
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, width, height)
  bitmap.close()

  if (as === 'logo') {
    const png = await toBlob(canvas, 'image/png')
    if (!png)
      throw new Error('Couldn\'t prepare that image')
    return { blob: png, width, height, ext: 'png' }
  }
  const webp = await toBlob(canvas, 'image/webp', 0.85)
  if (webp?.type === 'image/webp')
    return { blob: webp, width, height, ext: 'webp' }
  const jpeg = await toBlob(canvas, 'image/jpeg', 0.86)
  if (!jpeg)
    throw new Error('Couldn\'t prepare that image')
  return { blob: jpeg, width, height, ext: 'jpg' }
}
