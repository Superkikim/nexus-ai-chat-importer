# 🔗 Intégration Extension ↔ Plugin Obsidian

## 📊 Workflow complet

```
1. User exporte Google Takeout
   ↓
2. User installe l'extension Firefox
   ↓
3. User va sur gemini.google.com
   ↓
4. User clique "Generate Index" dans l'extension
   ↓
5. Extension télécharge gemini_index.json
   ↓
6. User importe dans Obsidian :
   - Le ZIP Takeout
   - Le gemini_index.json
   ↓
7. Plugin fusionne les deux sources
   ↓
8. Résultat : Conversations groupées avec tous les détails
```

## 📥 Ce que contient le Takeout

```json
{
  "title": "Prompted Please turn us into Simpsons characters...",
  "time": "2025-12-28T00:33:59.851Z",
  "products": ["Gemini Apps"],
  "details": [
    {
      "name": "Gemini Apps Activity"
    }
  ]
}
```

**Problème** : Pas de `conversationId` !

## 📥 Ce que contient l'index (extension)

```json
{
  "conversations": [
    {
      "conversationId": "1a2b3c4d5e6f7g8h",
      "title": "Simpsons Character Transformation",
      "url": "https://gemini.google.com/app/1a2b3c4d5e6f7g8h",
      "messages": [
        {
          "timestamp": "2025-12-28T00:33:59.851Z",
          "promptPreview": "Please turn us into Simpsons cha..."
        }
      ]
    }
  ]
}
```

**Solution** : Contient le `conversationId` !

## 🔀 Algorithme de fusion (dans le plugin)

```typescript
function mergeIndexWithTakeout(
  takeoutEntries: GeminiActivityEntry[],
  index: GeminiIndex
): StandardConversation[] {
  
  const conversations = new Map<string, StandardConversation>();
  
  for (const entry of takeoutEntries) {
    // 1. Chercher le conversationId dans l'index
    const match = findMatchingConversation(entry, index);
    
    if (match) {
      // 2. Grouper par conversationId
      const convId = match.conversationId;
      
      if (!conversations.has(convId)) {
        conversations.set(convId, {
          id: convId,
          title: match.title,
          provider: 'gemini',
          createTime: parseTimestamp(entry.time),
          updateTime: parseTimestamp(entry.time),
          messages: [],
          chatUrl: match.url
        });
      }
      
      // 3. Ajouter les messages du Takeout
      const conversation = conversations.get(convId)!;
      conversation.messages.push(...convertEntryToMessages(entry));
      
    } else {
      // 4. Fallback : créer une conversation standalone
      const standaloneId = generateIdFromEntry(entry);
      conversations.set(standaloneId, {
        id: standaloneId,
        title: extractTitle(entry),
        provider: 'gemini',
        createTime: parseTimestamp(entry.time),
        updateTime: parseTimestamp(entry.time),
        messages: convertEntryToMessages(entry),
        chatUrl: null
      });
    }
  }
  
  return Array.from(conversations.values());
}

function findMatchingConversation(
  entry: GeminiActivityEntry,
  index: GeminiIndex
): IndexConversation | null {
  
  const entryTime = entry.time;
  const entryPrompt = entry.title
    .replace(/^(Prompted|Live Prompt|Asked)\s+/i, '')
    .substring(0, 30);
  
  // Stratégie 1 : Match exact par timestamp
  for (const conv of index.conversations) {
    const exactMatch = conv.messages.find(msg => msg.timestamp === entryTime);
    if (exactMatch) return conv;
  }
  
  // Stratégie 2 : Fuzzy match (timestamp proche + prompt similaire)
  for (const conv of index.conversations) {
    for (const msg of conv.messages) {
      const timeDiff = Math.abs(
        new Date(entryTime).getTime() - new Date(msg.timestamp).getTime()
      );
      
      // Moins de 5 secondes d'écart
      if (timeDiff < 5000) {
        // Prompt similaire
        if (msg.promptPreview.toLowerCase().startsWith(
          entryPrompt.toLowerCase().substring(0, 20)
        )) {
          return conv;
        }
      }
    }
  }
  
  return null;
}
```

## 📝 Résultat dans Obsidian

### Avant (sans index)

```
Nexus/Conversations/gemini/2025/12/
├── 20251228-003359 - Please turn us into Simpsons.md
├── 20251228-003512 - Now make it black and white.md
├── 20251228-003645 - Can you add speech bubbles.md
├── 20251227-142210 - How do I read a CSV file.md
└── 20251227-142533 - Can you show me how to handle.md
```

**Problème** : 5 notes séparées pour 2 conversations !

### Après (avec index)

```
Nexus/Conversations/gemini/2025/12/
├── 20251228-003359 - Simpsons Character Transformation.md
└── 20251227-142210 - Python Data Analysis Help.md
```

**Résultat** : 2 notes groupées avec tout l'historique !

### Contenu d'une note groupée

```markdown
---
nexus: nexus-ai-chat-importer
plugin_version: "1.5.0"
provider: gemini
conversation_id: 1a2b3c4d5e6f7g8h
conversation_url: https://gemini.google.com/app/1a2b3c4d5e6f7g8h
title: Simpsons Character Transformation
create_time: 2025-12-28T00:33:59.000Z
update_time: 2025-12-28T00:36:45.000Z
---

# Simpsons Character Transformation

Created: 28/12/2025 at 01:33:59
Last Updated: 28/12/2025 at 01:36:45

🔗 [Open in Gemini](https://gemini.google.com/app/1a2b3c4d5e6f7g8h)

>[!nexus_user] **User** - 28.12.2025 01:33:59
> Please turn us into Simpsons characters and make it line art...
>>[!nexus_attachment] **image.png** (image/png) - 231.23 KB
>>
>> ![[Nexus/Attachments/gemini/images/image.png]]

>[!nexus_agent] **Assistant** - 28.12.2025 01:34:05
> Here's your Simpsons-style transformation!
>>[!nexus_attachment] **generated-image.png** (image/png) - 1.02 MB
>>
>> ![[Nexus/Attachments/gemini/images/generated-image.png]]

>[!nexus_user] **User** - 28.12.2025 01:35:12
> Now make it black and white line art for coloring

>[!nexus_agent] **Assistant** - 28.12.2025 01:35:18
> Here's the black and white version!
>>[!nexus_attachment] **bw-version.png** (image/png) - 856.45 KB
>>
>> ![[Nexus/Attachments/gemini/images/bw-version.png]]

>[!nexus_user] **User** - 28.12.2025 01:36:45
> Can you add speech bubbles with funny quotes?

>[!nexus_agent] **Assistant** - 28.12.2025 01:36:52
> Sure! Here's the version with speech bubbles...
```

## 🎯 Avantages de cette approche

### Pour l'utilisateur

✅ **Conversations groupées** au lieu de notes séparées
✅ **Titres propres** (de Gemini, pas générés)
✅ **Liens directs** vers les conversations en ligne
✅ **Historique complet** de chaque conversation
✅ **Tous les attachments** préservés

### Pour le développeur

✅ **Matching robuste** (timestamp exact + fuzzy fallback)
✅ **Pas de perte de données** (fallback si pas de match)
✅ **Extensible** (facile d'ajouter d'autres métadonnées)
✅ **Testable** (peut tester avec/sans index)

## 🔧 Modifications nécessaires dans le plugin

### 1. Nouveau type pour l'index

```typescript
// src/types/gemini-index.ts
export interface GeminiIndex {
  conversations: IndexConversation[];
  exportDate: string;
  totalConversations: number;
  source: string;
}

export interface IndexConversation {
  conversationId: string;
  title: string;
  url: string;
  messages: IndexMessage[];
}

export interface IndexMessage {
  timestamp: string;
  promptPreview: string;
}
```

### 2. Nouveau service de fusion

```typescript
// src/services/gemini-index-merger.ts
export class GeminiIndexMerger {
  mergeIndexWithTakeout(
    takeoutEntries: GeminiActivityEntry[],
    index: GeminiIndex | null
  ): StandardConversation[] {
    // Implémentation du merge
  }
}
```

### 3. Mise à jour du GeminiAdapter

```typescript
// src/providers/gemini/gemini-adapter.ts
export class GeminiAdapter implements ProviderAdapter<GeminiActivityEntry> {
  
  async convertWithIndex(
    entries: GeminiActivityEntry[],
    index: GeminiIndex | null
  ): Promise<StandardConversation[]> {
    
    if (index) {
      // Utiliser l'index pour grouper
      return this.indexMerger.mergeIndexWithTakeout(entries, index);
    } else {
      // Fallback : mode activity log (1 note par interaction)
      return this.convertWithoutIndex(entries);
    }
  }
}
```

### 4. Mise à jour du dialog d'import

```typescript
// Permettre de sélectionner un fichier index optionnel
const indexFile = await selectOptionalIndexFile();

if (indexFile) {
  const index = JSON.parse(await indexFile.text());
  conversations = await adapter.convertWithIndex(entries, index);
} else {
  conversations = await adapter.convertWithoutIndex(entries);
}
```

## 📋 Checklist d'intégration

- [ ] Créer les types `GeminiIndex`, `IndexConversation`, `IndexMessage`
- [ ] Créer le service `GeminiIndexMerger`
- [ ] Implémenter l'algorithme de matching
- [ ] Ajouter le support de l'index dans `GeminiAdapter`
- [ ] Mettre à jour le dialog d'import pour accepter l'index
- [ ] Tester avec des données réelles
- [ ] Documenter le workflow complet
- [ ] Ajouter des tests unitaires pour le matching

---

**Note** : Tout cela sera implémenté dans la v1.5.0, après avoir validé que l'extension fonctionne ! 🚀

