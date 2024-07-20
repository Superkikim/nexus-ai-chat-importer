import { GeneralChat } from '../types';
import { loadZipFile } from '../utils';
import yaml from 'js-yaml';

export async function parseChatGPTArchive(archivePath: string, config: any): Promise<GeneralChat[]> {
  const zip = await loadZipFile(archivePath);
  const conversationsFile = zip.file(config.structure.conversationsFile);
  const content = await conversationsFile.async('string');
  const conversations = JSON.parse(content);

  return conversations.map((conversation: any) => ({
    id: conversation[config.mapping.conversationId],
    createDate: conversation.create_time,
    updateDate: conversation.update_time,
    messages: Object.values(conversation.mapping).map((message: any) => ({
      id: message.id,
      authorRole: message.author.role,
      content: message.content.parts,
      timestamp: message.create_time
    }))
  }));
}
