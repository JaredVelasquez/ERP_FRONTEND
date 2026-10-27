import { useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { ListSkeleton } from '@/shared/ui/skeleton'
import { chat, executeAction, getConversation, listConversations, type ChatAudio, type ChatImage, type ConversationSummary, type ProposedAction } from './api'
import { prepareMedia } from './prepare-media'

interface AttachmentPreview { name: string; label: string; kind: 'image' | 'pdf' | 'video'; url: string; frameCount: number }
interface AudioPreview { url: string; seconds: number }
interface Turn { role: 'user' | 'assistant'; content: string; actions?: ProposedAction[]; attachment?: AttachmentPreview; audio?: AudioPreview; deliveryError?: boolean; retryMedia?: { images: ChatImage[]; audio?: ChatAudio } }

interface AssistantPanelProps {
  variant?: 'floating' | 'page'
  initialConversationId?: string
}

export function AssistantPanel({ variant = 'floating', initialConversationId }: AssistantPanelProps) {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const fileInput = useRef<HTMLInputElement>(null)
  const threadEnd = useRef<HTMLDivElement>(null)
  const recorder = useRef<MediaRecorder | null>(null)
  const audioStream = useRef<MediaStream | null>(null)
  const recordingChunks = useRef<Blob[]>([])
  const recordingStartedAt = useRef(0)
  const recordingTimer = useRef<number | null>(null)
  const previewUrls = useRef(new Set<string>())
  const [open, setOpen] = useState(false)
  const [conversationId, setConversationId] = useState<string | null>(initialConversationId ?? null)
  const [historyOpen, setHistoryOpen] = useState(variant === 'page')
  const [historyPage, setHistoryPage] = useState(1)
  const [historyRevision, setHistoryRevision] = useState(0)
  const [historyItems, setHistoryItems] = useState<ConversationSummary[]>([])
  const [historyTotalPages, setHistoryTotalPages] = useState(0)
  const [historyBusy, setHistoryBusy] = useState(false)
  const [historyError, setHistoryError] = useState('')
  const [turns, setTurns] = useState<Turn[]>([])
  const [draft, setDraft] = useState('')
  const [images, setImages] = useState<ChatImage[]>([])
  const [attachment, setAttachment] = useState<AttachmentPreview | null>(null)
  const [busy, setBusy] = useState(false)
  const [preparingAttachment, setPreparingAttachment] = useState(false)
  const [notice, setNotice] = useState('')
  const [recording, setRecording] = useState(false)
  const [processingRecording, setProcessingRecording] = useState(false)
  const [recordingSeconds, setRecordingSeconds] = useState(0)
  const [recordedAudio, setRecordedAudio] = useState<{ audio: ChatAudio; url: string; seconds: number } | null>(null)

  useEffect(() => {
    if (variant !== 'page' && !historyOpen) return
    let active = true
    setHistoryBusy(true)
    setHistoryError('')
    void listConversations(historyPage, 30).then((result) => {
      if (!active) return
      setHistoryItems(result.items)
      setHistoryTotalPages(result.totalPages)
    }).catch((error: unknown) => {
      if (!active) return
      setHistoryError(error instanceof Error ? error.message : 'No se pudo cargar el historial.')
    }).finally(() => {
      if (active) setHistoryBusy(false)
    })
    return () => { active = false }
  }, [historyOpen, historyPage, historyRevision, variant])

  useEffect(() => {
    if (!initialConversationId) return
    let active = true
    void getConversation(initialConversationId).then((conversation) => {
      if (!active) return
      setConversationId(conversation.id)
      setTurns(conversation.messages.map((message) => ({ role: message.role, content: message.content })))
    }).catch((error: unknown) => {
      if (active) setNotice(error instanceof Error ? error.message : 'No se pudo abrir la conversación.')
    })
    return () => { active = false }
  }, [initialConversationId])

  useEffect(() => {
    threadEnd.current?.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'end' })
  }, [turns.length, busy])

  useEffect(() => () => {
    if (recordingTimer.current !== null) window.clearInterval(recordingTimer.current)
    if (recorder.current?.state === 'recording') {
      recorder.current.onstop = null
      recorder.current.stop()
    }
    audioStream.current?.getTracks().forEach((track) => track.stop())
    previewUrls.current.forEach((url) => URL.revokeObjectURL(url))
    previewUrls.current.clear()
  }, [])

  async function startRecording() {
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      setNotice('Este navegador no permite grabar audio. Abre el ERP en Chrome o Edge actualizado.')
      return
    }
    setNotice('')
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      audioStream.current = stream
      const mimeType = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg'].find((candidate) => MediaRecorder.isTypeSupported(candidate))
      const nextRecorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream)
      recordingChunks.current = []
      recordingStartedAt.current = Date.now()
      nextRecorder.ondataavailable = (event) => { if (event.data.size > 0) recordingChunks.current.push(event.data) }
      nextRecorder.onerror = () => {
        setRecording(false)
        setProcessingRecording(false)
        setNotice('La grabación se interrumpió. Revisa el micrófono e inténtalo de nuevo.')
        stopAudioTracks()
      }
      nextRecorder.onstop = () => void finishRecording(nextRecorder.mimeType || 'audio/webm')
      recorder.current = nextRecorder
      nextRecorder.start(250)
      setRecording(true)
      setRecordingSeconds(0)
      recordingTimer.current = window.setInterval(() => {
        const seconds = Math.floor((Date.now() - recordingStartedAt.current) / 1000)
        setRecordingSeconds(seconds)
        if (seconds >= 120) stopRecording()
      }, 500)
    } catch (error) {
      stopAudioTracks()
      const issue = error instanceof DOMException && error.name === 'NotAllowedError'
        ? 'Permite el acceso al micrófono en el navegador para grabar.'
        : 'No se pudo iniciar la grabación. Comprueba que haya un micrófono disponible.'
      setNotice(issue)
    }
  }

  function stopRecording() {
    if (recorder.current?.state !== 'recording') return
    setRecording(false)
    setProcessingRecording(true)
    recorder.current.stop()
    clearRecordingTimer()
  }

  async function finishRecording(mimeType: string) {
    const blob = new Blob(recordingChunks.current, { type: mimeType })
    const seconds = Math.max(1, Math.round((Date.now() - recordingStartedAt.current) / 1000))
    stopAudioTracks()
    if (blob.size === 0 || blob.size > 4 * 1024 * 1024) {
      setProcessingRecording(false)
      setNotice(blob.size === 0 ? 'La grabación está vacía. Graba un mensaje antes de enviarlo.' : 'La grabación supera 4 MB. Haz un mensaje más corto.')
      return
    }
    const mediaType = normalizeAudioType(blob.type)
    if (!mediaType) {
      setProcessingRecording(false)
      setNotice('El formato de audio de este navegador no es compatible. Usa Chrome o Edge actualizado.')
      return
    }
    const bytes = new Uint8Array(await blob.arrayBuffer())
    const binary = Array.from(bytes, (byte) => String.fromCharCode(byte)).join('')
    releasePreviewUrl(recordedAudio?.url)
    const url = URL.createObjectURL(blob)
    previewUrls.current.add(url)
    setRecordedAudio({ audio: { mediaType, data: btoa(binary) }, url, seconds })
    setProcessingRecording(false)
    setNotice('')
  }

  function stopAudioTracks() {
    audioStream.current?.getTracks().forEach((track) => track.stop())
    audioStream.current = null
    recorder.current = null
  }

  function clearRecordingTimer() {
    if (recordingTimer.current === null) return
    window.clearInterval(recordingTimer.current)
    recordingTimer.current = null
  }

  function releasePreviewUrl(url?: string) {
    if (!url || !previewUrls.current.has(url)) return
    URL.revokeObjectURL(url)
    previewUrls.current.delete(url)
  }

  function releaseConversationPreviews() {
    previewUrls.current.forEach((url) => URL.revokeObjectURL(url))
    previewUrls.current.clear()
  }

  async function attach(file?: File) {
    if (!file || preparingAttachment || busy) return
    setNotice('')
    setPreparingAttachment(true)
    try {
      const prepared = await prepareMedia(file)
      releasePreviewUrl(attachment?.url)
      const url = URL.createObjectURL(file)
      previewUrls.current.add(url)
      setImages(prepared.images)
      setAttachment({ name: file.name, label: prepared.label, kind: file.type === 'application/pdf' ? 'pdf' : file.type.startsWith('video/') ? 'video' : 'image', url, frameCount: file.type.startsWith('video/') ? prepared.images.length : 0 })
      if (fileInput.current) fileInput.current.value = ''
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'No se pudo leer el archivo.')
    } finally {
      setPreparingAttachment(false)
    }
  }

  async function send(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const content = draft.trim() || (images.length ? 'Analiza este archivo y dime qué información útil contiene.' : recordedAudio ? 'Escucha este mensaje de voz y ayúdame con lo que solicito.' : '')
    if (!content || busy || preparingAttachment || recording || processingRecording) return
    const submittedImages = images
    const submittedAudio = recordedAudio
    const submittedAttachment = attachment
    setTurns((current) => [...(current.at(-1)?.deliveryError ? current.slice(0, -1) : current), {
      role: 'user', content, attachment: submittedAttachment ?? undefined,
      audio: submittedAudio ? { url: submittedAudio.url, seconds: submittedAudio.seconds } : undefined,
      retryMedia: { images: submittedImages, ...(submittedAudio ? { audio: submittedAudio.audio } : {}) },
    }])
    setDraft('')
    setImages([])
    setAttachment(null)
    setRecordedAudio(null)
    if (fileInput.current) fileInput.current.value = ''
    setBusy(true)
    setNotice('')
    try {
      const result = await chat({ conversationId, message: content, images: submittedImages, audio: submittedAudio?.audio })
      setConversationId(result.conversationId)
      setTurns((current) => [...current.map((turn, index) => index === current.length - 1 ? { ...turn, retryMedia: undefined } : turn), { role: 'assistant', content: result.reply, actions: result.actions }])
      setHistoryPage(1)
      setHistoryRevision((revision) => revision + 1)
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'No se pudo contactar al asistente.')
      setTurns((current) => current.map((turn, index) => index === current.length - 1 ? { ...turn, deliveryError: true } : turn))
    } finally {
      setBusy(false)
    }
  }

  async function retryTurn(turnIndex: number, turn: Turn) {
    if (busy || !turn.retryMedia) return
    setBusy(true)
    setNotice('')
    setTurns((current) => current.map((item, index) => index === turnIndex ? { ...item, deliveryError: false } : item))
    try {
      const result = await chat({ conversationId, message: turn.content, images: turn.retryMedia.images, audio: turn.retryMedia.audio })
      setConversationId(result.conversationId)
      setTurns((current) => [...current.map((item, index) => index === turnIndex ? { ...item, retryMedia: undefined, deliveryError: false } : item), { role: 'assistant', content: result.reply, actions: result.actions }])
      setHistoryPage(1)
      setHistoryRevision((revision) => revision + 1)
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'No se pudo contactar al asistente.')
      setTurns((current) => current.map((item, index) => index === turnIndex ? { ...item, deliveryError: true } : item))
    } finally {
      setBusy(false)
    }
  }

  async function confirm(action: ProposedAction) {
    setBusy(true)
    setNotice('')
    try {
      const result = await executeAction(action)
      setTurns((current) => [...current, { role: 'assistant', content: `Gestión ${action.name} completada. Resultado: ${JSON.stringify(result).slice(0, 1200)}` }])
      await queryClient.invalidateQueries().catch(() => undefined)
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'No se pudo confirmar la gestión.')
      throw error
    } finally {
      setBusy(false)
    }
  }

  async function selectConversation(id: string) {
    setBusy(true)
    setNotice('')
    try {
      const conversation = await getConversation(id)
      setConversationId(conversation.id)
      setTurns(conversation.messages.map((message) => ({ role: message.role, content: message.content })))
      setHistoryOpen(false)
      setImages([])
      setAttachment(null)
      releaseConversationPreviews()
      setRecordedAudio(null)
      if (fileInput.current) fileInput.current.value = ''
      if (variant === 'page') void navigate({ to: '/assistant', search: { conversationId: id } })
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'No se pudo abrir la conversación.')
    } finally {
      setBusy(false)
    }
  }

  function startNewConversation() {
    if (busy) return
    setConversationId(null)
    setTurns([])
    setDraft('')
    setImages([])
    setAttachment(null)
    releaseConversationPreviews()
    setNotice('')
    releasePreviewUrl(recordedAudio?.url)
    setRecordedAudio(null)
    if (fileInput.current) fileInput.current.value = ''
    setHistoryOpen(false)
    if (variant === 'page') void navigate({ to: '/assistant', search: { conversationId: undefined } })
  }

  function openFullScreen() {
    void navigate({ to: '/assistant', search: { conversationId: conversationId ?? undefined } })
  }

  const history = <aside className={`assistant-history${historyOpen ? ' assistant-history--open' : ''}`} aria-label="Historial de conversaciones">
    <div className="assistant-history-heading"><div><span className="assistant-kicker">HISTORIAL</span><h2>Conversaciones</h2></div><button type="button" className="assistant-new-chat" onClick={startNewConversation} disabled={busy}>+ Nueva</button></div>
    {historyBusy ? <ListSkeleton rows={4} label="Cargando conversaciones…" /> : null}
    {historyError ? <p className="assistant-history-error" role="alert">{historyError}</p> : null}
    {!historyBusy && !historyError && historyItems.length === 0 ? <p className="assistant-history-note">Tus conversaciones aparecerán aquí.</p> : null}
    <div className="assistant-history-list" aria-label="Conversaciones guardadas">
      {historyItems.map((item) => <button key={item.id} type="button" className="assistant-history-item" aria-current={item.id === conversationId ? 'true' : undefined} onClick={() => void selectConversation(item.id)} disabled={busy}>
        <strong>{item.title || 'Conversación nueva'}</strong><span>{formatHistoryDate(item.updatedAt)}</span>
      </button>)}
    </div>
    {historyTotalPages > 1 ? <div className="assistant-history-pagination"><button type="button" onClick={() => setHistoryPage((page) => page - 1)} disabled={historyPage <= 1 || historyBusy}>Anterior</button><span>{historyPage} / {historyTotalPages}</span><button type="button" onClick={() => setHistoryPage((page) => page + 1)} disabled={historyPage >= historyTotalPages || historyBusy}>Siguiente</button></div> : null}
  </aside>

  const chatSurface = <div className="assistant-chat-surface">
    <div className="assistant-thread" role="log" aria-live="polite" aria-label="Conversación con el asistente">
      {turns.length === 0 ? <div className="assistant-welcome"><span aria-hidden="true">✦</span><strong>¿Qué quieres resolver?</strong><p>Busca productos, revisa precios o adjunta una factura. Las gestiones que cambian datos requieren tu confirmación.</p><div className="assistant-prompts"><button type="button" onClick={() => setDraft('Busca un producto por nombre')}>Buscar producto</button><button type="button" onClick={() => setDraft('Ayúdame a registrar una factura de compra')}>Registrar factura</button></div></div> : null}
      {turns.map((turn, index) => <div key={`${conversationId ?? 'new'}-${index}`} className={`assistant-turn assistant-turn--${turn.role}`}><p>{turn.content}</p>{turn.attachment ? <AttachmentCard attachment={turn.attachment} /> : null}{turn.audio ? <div className="assistant-turn-audio"><span>Mensaje de voz · {formatDuration(turn.audio.seconds)}</span><audio controls preload="metadata" src={turn.audio.url} aria-label="Reproducir mensaje de voz" /></div> : null}{turn.deliveryError ? <div className="assistant-turn-error" role="status"><span>No se pudo enviar este mensaje.</span>{turn.retryMedia ? <button type="button" disabled={busy} onClick={() => void retryTurn(index, turn)}>Reintentar</button> : null}</div> : null}{turn.actions?.map((action, actionIndex) => <ActionCard key={`${index}-${actionIndex}`} action={action} disabled={busy} onConfirm={confirm} />)}</div>)}
      <div ref={threadEnd} aria-hidden="true" />
      {busy ? <p className="assistant-thinking" role="status">Procesando…</p> : null}
    </div>
    {notice ? <p className="assistant-notice" role="alert">{notice}</p> : null}
    <form className="assistant-compose" onSubmit={(event) => void send(event)}>
      {attachment ? <AttachmentCard attachment={attachment} onRemove={() => { releasePreviewUrl(attachment.url); setImages([]); setAttachment(null); if (fileInput.current) fileInput.current.value = '' }} removable /> : null}
      {recordedAudio ? <div className="assistant-audio-preview"><span>Mensaje de voz · {formatDuration(recordedAudio.seconds)}</span><audio controls preload="metadata" src={recordedAudio.url} aria-label="Escuchar mensaje de voz" /><button type="button" aria-label="Quitar grabación" onClick={() => { releasePreviewUrl(recordedAudio.url); setRecordedAudio(null) }}>Quitar</button></div> : null}
      {recording ? <p className="assistant-recording-status" role="status">Grabando · {formatDuration(recordingSeconds)} / 02:00</p> : null}
      {processingRecording ? <p className="assistant-recording-status" role="status">Preparando grabación…</p> : null}
      {preparingAttachment ? <p className="assistant-attachment-status" role="status">Preparando vista previa y archivo para analizar…</p> : null}
      <textarea aria-label="Mensaje al asistente" placeholder="Escribe una pregunta o una gestión…" value={draft} maxLength={4000} rows={2} onChange={(event) => setDraft(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); event.currentTarget.form?.requestSubmit() } }} />
      <div className="assistant-compose-actions"><label className="assistant-attach" aria-label={preparingAttachment ? 'Preparando archivo' : attachment ? 'Cambiar archivo adjunto' : 'Adjuntar imagen, PDF o video'} title={preparingAttachment ? 'Preparando archivo' : attachment ? 'Cambiar archivo adjunto' : 'Adjuntar imagen, PDF o video'}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false"><path d="m20.5 11.5-8.1 8.1a5.3 5.3 0 0 1-7.5-7.5l8.5-8.5a3.5 3.5 0 0 1 5 5l-8.6 8.6a1.8 1.8 0 0 1-2.5-2.5l7.8-7.8" /></svg><input ref={fileInput} type="file" aria-label="Adjuntar imagen, PDF o video" accept="image/*,video/*,application/pdf" disabled={busy || preparingAttachment || recording || processingRecording || Boolean(recordedAudio)} onChange={(event) => void attach(event.target.files?.[0])} /></label><div className="assistant-compose-buttons"><button type="button" className={`assistant-record${recording ? ' assistant-record--active' : ''}`} aria-label={recording ? 'Detener grabación' : 'Grabar audio'} title={recording ? 'Detener grabación' : 'Grabar audio'} aria-pressed={recording} disabled={busy || preparingAttachment || processingRecording || Boolean(attachment) || images.length > 0 || Boolean(recordedAudio)} onClick={() => recording ? stopRecording() : void startRecording()}>{recording ? <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false"><rect x="6" y="6" width="12" height="12" rx="2" /></svg> : <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false"><rect x="9" y="3" width="6" height="12" rx="3" /><path d="M5.5 11.5a6.5 6.5 0 0 0 13 0M12 18v3m-4 0h8" /></svg>}</button><button type="submit" aria-label="Enviar mensaje" title="Enviar mensaje" disabled={busy || preparingAttachment || recording || processingRecording || (!draft.trim() && images.length === 0 && !recordedAudio)}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false"><path d="M12 19V5m-7 7 7-7 7 7" /></svg></button></div></div>
    </form>
  </div>

  if (variant === 'page') {
    return <main className="assistant-full-page">
      <header className="assistant-full-heading"><div><span className="assistant-kicker">MICHELLE AI</span><h1>Asistente ERP</h1><p>Consulta, identifica y prepara gestiones. Tú confirmas los cambios antes de aplicarlos.</p></div><button type="button" className="assistant-back-button" onClick={() => void navigate({ to: '/dashboard' })}>Volver al tablero</button></header>
      <div className="assistant-full-layout">
        {history}
        <section className="assistant-full-chat" aria-label="Chat con el asistente">
          <header className="assistant-full-chat-heading"><div><h2>{conversationId ? historyItems.find((item) => item.id === conversationId)?.title ?? 'Conversación' : 'Nueva conversación'}</h2><p>Las conversaciones son privadas de tu usuario y empresa.</p></div><div className="assistant-full-chat-actions"><button type="button" className="assistant-history-mobile-toggle" aria-expanded={historyOpen} onClick={() => setHistoryOpen(!historyOpen)}>Conversaciones</button><button type="button" className="assistant-new-chat" onClick={startNewConversation} disabled={busy}>+ Nueva</button></div></header>
          {chatSurface}
        </section>
      </div>
    </main>
  }

  return <div className="assistant-root">
    {open ? <section className="assistant-panel" aria-label="Asistente ERP">
      <header className="assistant-header"><div><span className="assistant-kicker">MICHELLE AI</span><h2>Asistente ERP</h2><p>Consulta, identifica y prepara gestiones</p></div><div className="assistant-header-actions"><button type="button" className="assistant-panel-action" aria-expanded={historyOpen} onClick={() => setHistoryOpen(!historyOpen)}>Historial</button><button type="button" className="assistant-panel-action" onClick={startNewConversation} disabled={busy}>Nueva</button><button type="button" className="assistant-panel-action" aria-label="Abrir en pantalla completa" title="Abrir en pantalla completa" onClick={openFullScreen}>⤢</button><button type="button" className="assistant-close" aria-label="Cerrar asistente" onClick={() => setOpen(false)}>×</button></div></header>
      {historyOpen ? history : null}
      {chatSurface}
    </section> : null}
    <button type="button" className="assistant-launcher" aria-expanded={open} aria-label={open ? 'Cerrar asistente ERP' : 'Abrir asistente ERP'} onClick={() => setOpen(!open)}><span aria-hidden="true">✦</span><span>Asistente</span></button>
  </div>
}

function AttachmentCard({ attachment, onRemove, removable = false }: { attachment: AttachmentPreview; onRemove?: () => void; removable?: boolean }) {
  return <figure className={`assistant-file-preview assistant-file-preview--${attachment.kind}`}>
    <figcaption><span><strong>{attachment.name}</strong><small>{attachment.kind === 'video' ? `Video · ${attachment.frameCount} fotogramas analizados` : attachment.kind === 'pdf' ? 'Documento PDF analizado' : 'Imagen analizada'}</small></span>{removable ? <button type="button" aria-label="Quitar archivo adjunto" onClick={onRemove}>Quitar</button> : null}</figcaption>
    {attachment.kind === 'image' ? <img src={attachment.url} alt={`Vista previa de ${attachment.name}`} /> : null}
    {attachment.kind === 'video' ? <video src={attachment.url} controls preload="metadata" aria-label={`Vista previa de ${attachment.name}`} /> : null}
    {attachment.kind === 'pdf' ? <iframe src={`${attachment.url}#toolbar=0&navpanes=0`} title={`Vista previa de ${attachment.name}`} loading="lazy" /> : null}
    <a href={attachment.url} target="_blank" rel="noreferrer">Abrir archivo</a>
  </figure>
}

function normalizeAudioType(value: string): ChatAudio['mediaType'] | null {
  const mimeType = value.toLowerCase().split(';')[0]
  if (mimeType === 'audio/webm' || mimeType === 'audio/ogg' || mimeType === 'audio/mp4' || mimeType === 'audio/wav') return mimeType
  return null
}

function formatDuration(seconds: number): string {
  return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`
}

function formatHistoryDate(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return new Intl.DateTimeFormat('es-HN', { dateStyle: 'medium', timeStyle: 'short' }).format(date)
}

function ActionCard({ action, disabled, onConfirm }: { action: ProposedAction; disabled: boolean; onConfirm: (action: ProposedAction) => Promise<void> }) {
  const [editing, setEditing] = useState(false)
  const [reviewed, setReviewed] = useState(false)
  const [json, setJson] = useState(JSON.stringify(action.input, null, 2))
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')
  async function confirm() {
    try {
      const input: unknown = JSON.parse(json)
      if (typeof input !== 'object' || input === null || Array.isArray(input)) throw new Error('Los datos deben ser un objeto JSON.')
      await onConfirm({ name: action.name, input: input as Record<string, unknown> })
      setDone(true)
      setError('')
    } catch (issue) {
      setError(issue instanceof Error ? issue.message : 'Datos inválidos.')
    }
  }
  return <article className="assistant-action"><strong>Propuesta: {action.name}</strong><ActionSummary input={action.input} />{editing ? <textarea aria-label={`Editar datos de ${action.name}`} value={json} onChange={(event) => setJson(event.target.value)} rows={6} /> : null}<div><button type="button" onClick={() => { setEditing(!editing); setReviewed(true) }} disabled={done}>{editing ? 'Cerrar editor' : 'Revisar datos'}</button><button type="button" className="assistant-confirm" disabled={disabled || done || !reviewed} onClick={() => void confirm()}>{done ? 'Confirmado' : reviewed ? 'Confirmar gestión' : 'Revisa primero'}</button></div>{error ? <p role="alert">{error}</p> : null}</article>
}

function ActionSummary({ input }: { input: Record<string, unknown> }) {
  const entries = Object.entries(input).filter(([key]) => key !== 'companyId')
  return <dl className="assistant-action-summary">{entries.slice(0, 10).map(([key, value]) => <div key={key}><dt>{key}</dt><dd>{key === 'csv' && typeof value === 'string' ? `CSV de ${value.split(/\r?\n/).length} líneas` : key === 'signature' ? 'Firma adjunta' : Array.isArray(value) ? `${value.length} líneas` : typeof value === 'object' ? 'Datos adjuntos' : String(value ?? '—').slice(0, 100)}</dd></div>)}{entries.length > 10 ? <div><dt>Otros datos</dt><dd>{entries.length - 10} campos</dd></div> : null}</dl>
}
