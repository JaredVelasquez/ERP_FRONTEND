import { AssistantPanel } from './assistant-panel'

export function AssistantPage({ conversationId }: { conversationId?: string }) {
  return <AssistantPanel variant="page" initialConversationId={conversationId} />
}
