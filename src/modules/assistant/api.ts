import { authenticatedFetch } from '@/shared/api/http-client'
import { z } from 'zod'
import { appConfig } from '@/app/config/app-config'

export interface ChatImage { mediaType: 'image/jpeg' | 'application/pdf'; data: string }
export interface ChatAudio { mediaType: 'audio/webm' | 'audio/ogg' | 'audio/mp4' | 'audio/wav'; data: string }
const actionSchema = z.object({ name: z.string(), input: z.record(z.string(), z.unknown()) })
export type ProposedAction = z.infer<typeof actionSchema>

const conversationSummarySchema = z.object({
  id: z.string().uuid(), title: z.string(), createdAt: z.string(), updatedAt: z.string(),
})
const conversationPageSchema = z.object({
  items: z.array(conversationSummarySchema), page: z.number(), pageSize: z.number(), total: z.number(), totalPages: z.number(),
})
const conversationSchema = conversationSummarySchema.extend({
  messages: z.array(z.object({ id: z.string().uuid(), role: z.enum(['user', 'assistant']), content: z.string(), createdAt: z.string() })),
})
const chatReplySchema = z.object({ conversationId: z.string().uuid(), reply: z.string(), actions: z.array(actionSchema) })
export type ConversationSummary = z.infer<typeof conversationSummarySchema>
export type ConversationPage = z.infer<typeof conversationPageSchema>
export type Conversation = z.infer<typeof conversationSchema>

export async function chat(input: { conversationId: string | null; message: string; images: ChatImage[]; audio?: ChatAudio }) {
  const response = await authenticatedFetch(new URL('/mcp/assistant/chat', appConfig.gatewayUrl), {
    method: 'POST', credentials: 'include', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ ...(input.conversationId ? { conversationId: input.conversationId } : {}), message: input.message, images: input.images, ...(input.audio ? { audio: input.audio } : {}) }),
  })
  if (!response.ok) throw await issue(response)
  return chatReplySchema.parse(await response.json())
}

export async function listConversations(page = 1, pageSize = 30): Promise<ConversationPage> {
  const response = await authenticatedFetch(new URL(`/mcp/assistant/conversations?page=${page}&pageSize=${pageSize}`, appConfig.gatewayUrl), { credentials: 'include' })
  if (!response.ok) throw await issue(response)
  return conversationPageSchema.parse(await response.json())
}

export async function getConversation(id: string): Promise<Conversation> {
  const response = await authenticatedFetch(new URL(`/mcp/assistant/conversations/${encodeURIComponent(id)}`, appConfig.gatewayUrl), { credentials: 'include' })
  if (!response.ok) throw await issue(response)
  return conversationSchema.parse(await response.json())
}

export async function executeAction(action: ProposedAction): Promise<unknown> {
  const response = await authenticatedFetch(new URL(`/mcp/tools/${encodeURIComponent(action.name)}`, appConfig.gatewayUrl), {
    method: 'POST', credentials: 'include', headers: { 'content-type': 'application/json' },
    body: JSON.stringify(action.input),
  })
  if (!response.ok) throw await issue(response)
  return response.json()
}

async function issue(response: Response): Promise<Error> {
  const payload: unknown = await response.json().catch(() => null)
  if (typeof payload === 'object' && payload !== null && 'message' in payload) {
    const message = payload.message
    if (typeof message === 'string') return new Error(message)
  }
  return new Error(`La operación no se pudo completar (${response.status}).`)
}
