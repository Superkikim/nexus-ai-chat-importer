import { GeneralChat } from '../types';
import { loadConfig } from '../utils';

export async function parseClaudeArchive(archivePath: string, config: any): Promise<GeneralChat[]> {
  const conversationsFile = await loadConfig(archivePath);
  const content = await conversationsFile.async('string');
  const conversations = JSON.parse(content);

  return conversations.map((conversation: any) => ({
    id: conversation[config.mapping.conversationId],
    createDate: conversation.created_at,
    updateDate: conversation.updated_at,
    messages: conversation.chat_messages.map((message: any) => ({
      id: message.uuid,
      authorRole: message.sender,
      content: message.text,
      timestamp: message.created_at
    }))
  }));
}
