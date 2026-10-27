import type { ChatImage } from './api'

const maxWidth = 1024
const maxFrames = 4

export async function prepareMedia(file: File): Promise<{ images: ChatImage[]; label: string }> {
  if (file.size > 50_000_000) throw new Error('El archivo supera 50 MB.')
  if (file.type === 'application/pdf') {
    if (file.size > 4_000_000) throw new Error('El PDF debe pesar menos de 4 MB.')
    const data = await readBase64(file)
    return { images: [{ mediaType: 'application/pdf', data }], label: `Factura PDF: ${file.name}` }
  }
  if (file.type.startsWith('image/')) {
    const bitmap = await createImageBitmap(file)
    try { return { images: [encode(bitmap)], label: `Imagen: ${file.name}` } } finally { bitmap.close() }
  }
  if (!file.type.startsWith('video/')) throw new Error('Adjunta una imagen, PDF o video.')
  const url = URL.createObjectURL(file)
  const video = document.createElement('video')
  video.preload = 'auto'
  video.muted = true
  video.playsInline = true
  video.src = url
  try {
    await waitFor(video, 'loadedmetadata')
    if (!Number.isFinite(video.duration) || video.duration <= 0) throw new Error('No se pudo leer el video.')
    const images: ChatImage[] = []
    for (let index = 0; index < maxFrames; index += 1) {
      video.currentTime = Math.min(video.duration - 0.05, video.duration * (index + 0.5) / maxFrames)
      await waitFor(video, 'seeked')
      images.push(encode(video))
    }
    return { images, label: `Video: ${file.name} · ${images.length} fotogramas` }
  } finally {
    video.removeAttribute('src')
    video.load()
    URL.revokeObjectURL(url)
  }
}

function readBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(new Error('No se pudo leer el PDF.'))
    reader.onload = () => {
      const data = String(reader.result ?? '').split(',')[1]
      if (!data) reject(new Error('PDF vacío.'))
      else resolve(data)
    }
    reader.readAsDataURL(file)
  })
}

function encode(source: CanvasImageSource & { width?: number; height?: number; videoWidth?: number; videoHeight?: number }): ChatImage {
  const width = source.videoWidth ?? source.width ?? 0
  const height = source.videoHeight ?? source.height ?? 0
  if (width <= 0 || height <= 0) throw new Error('No se pudo leer el archivo visual.')
  const scale = Math.min(1, maxWidth / width)
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(width * scale))
  canvas.height = Math.max(1, Math.round(height * scale))
  canvas.getContext('2d')?.drawImage(source, 0, 0, canvas.width, canvas.height)
  const data = canvas.toDataURL('image/jpeg', 0.7).split(',')[1]
  if (!data || data.length > 1_400_000) throw new Error('La imagen es demasiado grande para analizar.')
  return { mediaType: 'image/jpeg', data }
}

function waitFor(element: HTMLVideoElement, event: 'loadedmetadata' | 'seeked'): Promise<void> {
  if (event === 'loadedmetadata' && element.readyState >= 1) return Promise.resolve()
  return new Promise((resolve, reject) => {
    const timer = window.setTimeout(() => finish(new Error('Tiempo de lectura agotado.')), 12_000)
    const onReady = () => finish()
    const onError = () => finish(new Error('No se pudo procesar el video.'))
    function finish(error?: Error) {
      window.clearTimeout(timer)
      element.removeEventListener(event, onReady)
      element.removeEventListener('error', onError)
      if (error) reject(error)
      else resolve()
    }
    element.addEventListener(event, onReady, { once: true })
    element.addEventListener('error', onError, { once: true })
  })
}
