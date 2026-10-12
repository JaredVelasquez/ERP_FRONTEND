import { useEffect, useRef, type PointerEvent } from 'react'
import { Button } from '@/shared/ui/button'
import { FieldError, FieldLabel, FieldStack } from '@/shared/ui/fields'
import { voucherMessages } from '../messages'

type SignaturePadProps = {
  onChange: (value: string) => void
  onLeave?: () => void
  error?: string | null
}

export function SignaturePad({ onChange, onLeave, error }: SignaturePadProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const drawing = useRef(false)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) {
      return
    }
    const ctx = canvas.getContext('2d')
    if (!ctx) {
      return
    }
    ctx.strokeStyle = '#1c1917'
    ctx.lineWidth = 2
    ctx.lineCap = 'round'
  }, [])

  function surface() {
    const canvas = canvasRef.current
    if (!canvas) {
      return null
    }
    const ctx = canvas.getContext('2d')
    if (!ctx) {
      return null
    }
    return { canvas, ctx }
  }

  function position(event: PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current
    if (!canvas) {
      return null
    }
    const rect = canvas.getBoundingClientRect()
    return {
      x: ((event.clientX - rect.left) / rect.width) * canvas.width,
      y: ((event.clientY - rect.top) / rect.height) * canvas.height,
    }
  }

  function onPointerDown(event: PointerEvent<HTMLCanvasElement>) {
    const point = position(event)
    const drawingSurface = surface()
    if (!point || !drawingSurface) {
      return
    }
    drawing.current = true
    drawingSurface.canvas.setPointerCapture(event.pointerId)
    drawingSurface.ctx.beginPath()
    drawingSurface.ctx.moveTo(point.x, point.y)
  }

  function onPointerMove(event: PointerEvent<HTMLCanvasElement>) {
    if (!drawing.current) {
      return
    }
    const point = position(event)
    const drawingSurface = surface()
    if (!point || !drawingSurface) {
      return
    }
    drawingSurface.ctx.lineTo(point.x, point.y)
    drawingSurface.ctx.stroke()
  }

  function onPointerUp() {
    if (!drawing.current) {
      return
    }
    drawing.current = false
    const drawingSurface = surface()
    if (!drawingSurface) {
      return
    }
    onChange(drawingSurface.canvas.toDataURL('image/png'))
    onLeave?.()
  }

  function clear() {
    const drawingSurface = surface()
    if (!drawingSurface) {
      return
    }
    drawingSurface.ctx.clearRect(0, 0, drawingSurface.canvas.width, drawingSurface.canvas.height)
    onChange('')
  }

  return (
    <FieldStack wide>
      <FieldLabel id="signature-label" htmlFor="signature-canvas">{voucherMessages.signature}</FieldLabel>
      <canvas
        id="signature-canvas"
        ref={canvasRef}
        width={640}
        height={200}
        aria-labelledby="signature-label"
        className="signature-pad"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onPointerLeave={() => onLeave?.()}
      />
      {error ? <FieldError>{error}</FieldError> : null}
      <Button type="button" variant="quiet" onClick={clear}>
        {voucherMessages.clearSignature}
      </Button>
    </FieldStack>
  )
}
