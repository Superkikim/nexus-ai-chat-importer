# IMPLÉMENTATION - Logique Artifacts vs Callouts

## 🎯 LOGIQUE IMPLÉMENTÉE

### Principe
- **`create_file`** → Récupère le contenu des fichiers texte exploitables
- **`computer:///`** → Identifie le format du produit final et décide si artifact ou callout

---

## 📋 WORKFLOW

### Phase 1A : Extraction des liens `computer:///`
```typescript
// Parcourir TOUS les messages
// Extraire TOUS les liens computer:/// dans les blocks text
// Stocker dans finalProductLinks
```

### Phase 1B : Collecte des artifacts
```typescript
Pour chaque create_file:
  SI file_text.length < 200:
    → SKIP (description courte, fichier binaire)
  
  SINON:
    SI lien computer:/// trouvé pour ce fichier:
      Extraire extension du produit final
      SI extension texte exploitable (.md, .py, .js, etc.):
        → EXTRAIRE comme ARTIFACT
      SINON (extension binaire/visuelle .svg, .png, .pdf, etc.):
        → SKIP (sera callout via computer:/// link)
    
    SINON (pas de lien computer:///):
      → EXTRAIRE comme ARTIFACT (fichier demandé explicitement)
```

### Phase 2 : Traitement des artifacts
- Créer les fichiers artifacts extraits
- Construire artifactVersionMap

### Phase 3 : Affichage
```typescript
Pour chaque create_file:
  SI présent dans artifactVersionMap:
    → Afficher lien artifact
  SINON:
    → Ignoré (sera géré par computer:/// link)

Pour chaque block text:
  Remplacer computer:/// links par callouts
```

---

## 🔧 EXTENSIONS

### Extensions texte exploitables (ARTIFACT)
```typescript
'py', 'js', 'ts', 'java', 'cpp', 'c', 'h', 'cs', 'go', 'rs',
'php', 'rb', 'swift', 'kt', 'scala', 'r', 'sh', 'bash',
'html', 'css', 'scss', 'sass', 'less', 'vue', 'jsx', 'tsx',
'json', 'xml', 'yaml', 'yml', 'toml', 'ini', 'env',
'md', 'txt', 'rst', 'adoc',
'sql'
```

### Extensions binaires/visuelles (CALLOUT)
```typescript
Images: 'svg', 'png', 'jpg', 'jpeg', 'gif', 'webp'
Documents: 'pdf', 'docx', 'pptx', 'xlsx', 'odt', 'ods'
Médias: 'mp4', 'mp3', 'wav'
```

---

## 📊 RÉSULTAT ATTENDU (conversation test)

### ✅ ARTIFACTS (4 fichiers)
1. `documentation_projet_table_multiplication.md` - Markdown exploitable
2. `lettre_table.js` - JavaScript exploitable
3. `guide_vente.py` - Python exploitable
4. `create_presentation.py` - Python exploitable

### ⚠️ CALLOUTS (8 fichiers - liens computer:///)
1. `table_multiplication.xlsx` - Excel (binaire)
2. `lettre_table_multiplication.docx` - Word (binaire)
3. `guide_vente_vendeurs.pdf` - PDF (binaire)
4. `presentation_vendeurs.pptx` - PowerPoint (binaire)
5. `logo_table_multiplication.svg` - SVG (image)
6. `logo_table_multiplication.png` - PNG (image)
7. `logo_horizontal.svg` - SVG (image)
8. `logo_horizontal.png` - PNG (image)

---

## 🎨 FORMAT DES CALLOUTS

### Artifact
```markdown
>[!nexus_artifact] **Titre** v1
> 🎨 [[path/to/artifact|View Artifact]]
```

### Callout (fichier binaire)
```markdown
>[!nexus_attachment] **filename.ext** (Type de fichier)
> ⚠️ File generated on Anthropic server, not included in archive. [Open original conversation](https://claude.ai/chat/xxx)
```

---

## ✅ TESTS À FAIRE

1. Importer `nouvelle_conversation_artifact.json`
2. Vérifier que 4 artifacts sont créés
3. Vérifier que 8 callouts sont affichés
4. Vérifier que les liens computer:/// sont remplacés
5. Vérifier que les artifacts sont accessibles via wikilinks

---

## 🚀 PRÊT POUR TEST UTILISATEUR

