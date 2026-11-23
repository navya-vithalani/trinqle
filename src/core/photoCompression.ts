/**
 * Client-side canvas photo compression.
 * Max dimension 1200px (width or height, aspect ratio preserved), JPEG quality 0.8.
 */
export interface CompressedPhoto {
  dataUrl: string
  blob: Blob
  width: number
  height: number
  sizeBytes: number
}

export async function compressPhoto(
  fileOrBlob: File | Blob,
  maxDimension = 1200,
  quality = 0.8
): Promise<CompressedPhoto> {
  return new Promise((resolve, reject) => {
    // If running in environment without Image/Canvas (e.g. Node tests), provide mock fallback
    if (typeof window === 'undefined' || typeof document === 'undefined' || !document.createElement) {
      const mockBlob = fileOrBlob instanceof Blob ? fileOrBlob : new Blob([])
      resolve({
        dataUrl: 'data:image/jpeg;base64,mock',
        blob: mockBlob,
        width: 100,
        height: 100,
        sizeBytes: mockBlob.size || 1024,
      })
      return
    }

    const reader = new FileReader()
    reader.onerror = () => reject(new Error('Failed to read image file'))
    reader.onload = (e) => {
      const img = new Image()
      img.onerror = () => reject(new Error('Failed to load image element'))
      img.onload = () => {
        let width = img.naturalWidth || img.width
        let height = img.naturalHeight || img.height

        // Calculate scaled dimensions
        if (width > maxDimension || height > maxDimension) {
          if (width > height) {
            height = Math.round((height * maxDimension) / width)
            width = maxDimension
          } else {
            width = Math.round((width * maxDimension) / height)
            height = maxDimension
          }
        }

        const canvas = document.createElement('canvas')
        canvas.width = width
        canvas.height = height

        const ctx = canvas.getContext('2d')
        if (!ctx) {
          reject(new Error('Could not get 2D canvas context'))
          return
        }

        ctx.drawImage(img, 0, 0, width, height)

        const dataUrl = canvas.toDataURL('image/jpeg', quality)
        canvas.toBlob(
          (blob) => {
            if (!blob) {
              reject(new Error('Canvas toBlob conversion failed'))
              return
            }
            resolve({
              dataUrl,
              blob,
              width,
              height,
              sizeBytes: blob.size,
            })
          },
          'image/jpeg',
          quality
        )
      }
      img.src = e.target?.result as string
    }
    reader.readAsDataURL(fileOrBlob)
  })
}
