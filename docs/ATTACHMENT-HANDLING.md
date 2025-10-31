# Gestion des Attachements

Ce document explique comment Nexus AI Chat Importer gère les différents types d'attachements lors de l'importation des conversations ChatGPT et Claude.

## Vue d'Ensemble

Le plugin utilise une stratégie de **"meilleur effort"** pour traiter les attachements :
- Si le fichier existe dans l'archive ZIP : il est extrait et lié
- Si le fichier est manquant : une note informative est créée
- Les statistiques d'attachements sont affichées dans les rapports d'importation

## Types d'Attachements Supportés

### ✅ Images Uploadées par l'Utilisateur

**Source** : Disponibles dans l'archive ZIP  
**Traitement** : Extraites et sauvegardées dans `Attachments/chatgpt/images/` ou `Attachments/claude/images/`  
**Formats supportés** : PNG, JPEG, GIF, WebP  
**Détection spéciale** : Magic bytes pour fichiers `.dat` (conversion automatique vers la bonne extension)

**Exemple** :
```
Attachments/chatgpt/images/image_abc123_1024x768.png
```

### ✅ Images DALL-E (ChatGPT uniquement)

**Source** : Disponibles dans le dossier `dalle-generations/` de l'archive ZIP  
**Traitement** : Extraites avec préservation du prompt de génération  
**Format** : PNG (généralement)  
**Nom de fichier** : `dalle_{genId}_{width}x{height}.png`  
**Contenu additionnel** : Le prompt utilisé pour générer l'image est préservé

**Exemple** :
```markdown
![dalle_gen123_1024x1024.png](Attachments/chatgpt/images/dalle_gen123_1024x1024.png)

> **Prompt DALL-E** : "A futuristic cityscape with flying cars"
```

### ✅ Fichiers Texte (Scripts, Markdown, Code, etc.)

**Source** : Contenu intégré directement dans les messages JSON  
**Traitement** : Intégrés directement dans le message, pas de fichier séparé  
**Formats** : Python, JavaScript, HTML, CSS, Markdown, etc.  
**Affichage** : Blocs de code avec coloration syntaxique

**Exemple** :
```markdown
**Fichier** : `script.py`
```python
def hello_world():
    print("Hello, World!")
```

### ❌ Documents (PDF, Word, etc.)

**Source** : Généralement absents des archives d'exportation  
**Traitement** : Marqués comme "missing" avec note explicative  
**Raison** : ChatGPT et Claude n'incluent généralement pas ces fichiers dans leurs exports  
**Statut** : Affiché comme "❌ missing" dans les rapports

### ❌ Fichiers Audio

**Source** : Peuvent être présents dans l'archive  
**Traitement** : **Volontairement ignorés**  
**Raison** : 
- Taille importante des fichiers
- Transcription déjà disponible dans le texte de la conversation
- Évite l'encombrement du vault

## Organisation des Fichiers

### Structure des Dossiers

```
Nexus AI Chat Imports/
├── Attachments/
│   ├── chatgpt/
│   │   ├── images/          # Images uploadées + DALL-E
│   │   ├── documents/       # Documents (si disponibles)
│   │   ├── audio/          # Audio (non traité)
│   │   └── files/          # Autres fichiers
│   └── claude/
│       ├── images/          # Images uploadées
│       ├── documents/       # Documents (si disponibles)
│       └── files/          # Autres fichiers
└── Conversations/
    ├── chatgpt/            # Conversations ChatGPT
    └── claude/             # Conversations Claude
```

### Gestion des Conflits

- **Noms de fichiers dupliqués** : Suffixe numérique ajouté (`image_1.png`, `image_2.png`)
- **Extensions incorrectes** : Détection automatique du format réel via magic bytes
- **Fichiers corrompus** : Marqués comme "failed" avec message d'erreur

## Détection des Formats

### Magic Bytes Supportés

Le plugin détecte automatiquement les formats réels des fichiers `.dat` :

| Format | Magic Bytes | Extension |
|--------|-------------|-----------|
| PNG | `89 50 4E 47` | `.png` |
| JPEG | `FF D8 FF` | `.jpg` |
| GIF | `47 49 46 38` | `.gif` |
| WebP | `52 49 46 46...57 45 42 50` | `.webp` |

## Statistiques dans les Rapports

### Affichage Global
```markdown
## Summary
- **Attachments**: 15/18 extracted (2 missing, 1 failed)
```

### Affichage par Conversation
```markdown
| Title | Created | Messages | Attachments |
|-------|---------|----------|-------------|
| ✨ Ma conversation | 2025-01-15 | 10 | ✅ 6 |
```

### Légende des Statuts
- **✅ 6** : Tous les attachements extraits avec succès
- **⚠️ 4/6** : Certains attachements manquants ou échoués
- **❌ 0/3** : Aucun attachement extrait
- **0** : Aucun attachement dans la conversation

## Résolution des Problèmes

### Attachements Manquants

**Causes possibles** :
1. Fichier non inclus dans l'export original
2. Conversation trop ancienne (avant que le provider sauvegarde les fichiers)
3. Type de fichier non supporté par l'export

**Solution** : Normal, le plugin crée une note explicative

### Attachements Échoués

**Causes possibles** :
1. Fichier corrompu dans l'archive
2. Permissions insuffisantes pour écrire dans le vault
3. Espace disque insuffisant

**Solution** : Vérifier les logs d'erreur et l'espace disque

### DALL-E Non Détectées

**Causes possibles** :
1. Archive ChatGPT incomplète
2. Version d'export non supportée

**Solution** : Réexporter depuis ChatGPT avec l'option complète
