# 📖 Guide d'utilisation - Nexus Gemini Indexer (Firefox)

## 🎯 Objectif

Cette extension Firefox extrait les données des conversations Gemini avec **hachage SHA-256 des messages** pour permettre la comparaison avec les exports Google Takeout.

## 📦 Installation

### Méthode 1 : Chargement temporaire (développement)

1. Ouvrir Firefox
2. Naviguer vers `about:debugging#/runtime/this-firefox`
3. Cliquer sur "Load Temporary Add-on..." (Charger un module complémentaire temporaire)
4. Sélectionner le fichier `manifest.json` dans le dossier `extension/firefox/`

### Méthode 2 : Build et installation

```bash
cd extension/firefox
./build.sh
```

Puis charger le fichier `.zip` généré dans `build/`.

## 🚀 Utilisation

### 1. Extraire la conversation actuelle

1. Ouvrir une conversation Gemini : `https://gemini.google.com/app/c_xxxxx`
2. Cliquer sur l'icône de l'extension dans la barre d'outils
3. Cliquer sur **"📄 Extract Current Conversation"**
4. L'extension télécharge un fichier JSON : `gemini_conversation_c_xxxxx.json`

### 2. Format du JSON extrait

```json
{
  "conversationId": "c_785f8f69017f7c11",
  "title": "Titre de la conversation",
  "url": "https://gemini.google.com/app/c_785f8f69017f7c11",
  "extractedAt": "2026-01-14T12:45:30.123Z",
  "messageCount": 10,
  "messages": [
    {
      "messageId": "f92cc12dfbfa6748",
      "messageHash": "a3f5e8d9c2b1a4f6e7d8c9b0a1f2e3d4c5b6a7f8e9d0c1b2a3f4e5d6c7b8a9f0",
      "contentPreview": "Pourquoi dans l'historique...",
      "contentLength": 156,
      "fullContent": "Texte complet du message"
    }
  ]
}
```

### 3. Utilisation des hashes

Les **hashes SHA-256** permettent de :
- ✅ Identifier de manière unique chaque message
- ✅ Comparer avec les messages de Google Takeout
- ✅ Détecter les messages manquants ou modifiés
- ✅ Grouper les messages fragmentés dans Takeout

## 🔧 Développement

### Structure des fichiers

```
extension/firefox/
├── manifest.json           # Configuration de l'extension
├── src/
│   ├── popup.html         # Interface utilisateur
│   ├── popup.js           # Logique du popup
│   ├── popup.css          # Styles
│   ├── content-script.js  # Script d'extraction (DOM + hachage)
│   └── background.js      # Service worker
├── icons/                 # Icônes de l'extension
└── build/                 # Fichiers buildés
```

### Modifier l'extension

1. Éditer les fichiers dans `src/`
2. Recharger l'extension dans `about:debugging` (bouton "Reload")
3. Tester sur une page Gemini

### Debugging

1. Ouvrir la console du popup : Clic droit sur l'icône → "Inspecter"
2. Ouvrir la console de la page : F12 sur la page Gemini
3. Les logs de `content-script.js` apparaissent dans la console de la page

## 🧪 Test rapide

### Script de test dans la console

Copier-coller dans la console de la page Gemini :

```javascript
// Test d'extraction de la conversation courante
(async () => {
  const data = await extractGeminiConversationData();
  console.log('✅ Données extraites :', data);
  console.table(data.messages);
})();
```

## 📋 Prochaines étapes

- [x] Implémenter l'extraction de **toutes les conversations visibles dans la barre latérale**
- [ ] Créer un script de **comparaison avec Takeout**
- [ ] Ajouter un **système de cache** pour éviter de ré-extraire
- [ ] Gérer les **conversations très longues** (pagination)

## 🐛 Problèmes connus

- L'extraction fonctionne sur les conversations **visibles et cliquables** dans la barre latérale
- Les timestamps ne sont pas disponibles dans le DOM (d'où l'utilisation des hashes)
- Le lazy loading du panneau latéral doit être déclenché manuellement (scroller avant de lancer l'index)

