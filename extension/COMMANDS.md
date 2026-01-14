# 🛠️ Commandes utiles pour l'extension

## 📦 Build l'extension

```bash
cd extension/firefox
./build.sh
```

Cela créera :
- `build/` - Dossier avec les fichiers de l'extension
- `nexus-gemini-indexer-firefox.xpi` - Package pour distribution

## 🧪 Tester dans Firefox

### Méthode 1 : Chargement temporaire (développement)

```bash
# 1. Ouvrir Firefox
# 2. Aller à about:debugging#/runtime/this-firefox
# 3. Cliquer "Load Temporary Add-on"
# 4. Sélectionner extension/firefox/manifest.json
```

### Méthode 2 : Installer le .xpi

```bash
# 1. Build l'extension
cd extension/firefox
./build.sh

# 2. Ouvrir Firefox
# 3. Aller à about:addons
# 4. Cliquer sur l'icône ⚙️ → "Install Add-on From File"
# 5. Sélectionner nexus-gemini-indexer-firefox.xpi
```

## 🧪 Tester dans Chrome

```bash
# 1. Ouvrir Chrome
# 2. Aller à chrome://extensions/
# 3. Activer "Developer mode" (en haut à droite)
# 4. Cliquer "Load unpacked"
# 5. Sélectionner le dossier extension/firefox/
```

## 🔍 Débugger l'extension

### Voir les logs du content script

```bash
# 1. Ouvrir gemini.google.com
# 2. F12 → Console
# 3. Les logs du content-script.js apparaîtront ici
```

### Voir les logs du background script

```bash
# Firefox:
# 1. about:debugging#/runtime/this-firefox
# 2. Trouver "Nexus Gemini Indexer"
# 3. Cliquer "Inspect"

# Chrome:
# 1. chrome://extensions/
# 2. Trouver "Nexus Gemini Indexer"
# 3. Cliquer "background page" (sous "Inspect views")
```

### Voir les logs du popup

```bash
# 1. Cliquer sur l'icône de l'extension
# 2. Right-click dans le popup → "Inspect"
# 3. Une DevTools s'ouvre pour le popup
```

## 🧹 Nettoyer

```bash
cd extension/firefox
rm -rf build/
rm -f nexus-gemini-indexer-firefox.xpi
```

## 📝 Modifier et recharger

### Pendant le développement

```bash
# 1. Modifier les fichiers dans extension/firefox/src/
# 2. Dans Firefox: about:debugging → Reload l'extension
# 3. Dans Chrome: chrome://extensions/ → Reload l'extension
# 4. Rafraîchir la page gemini.google.com (F5)
```

## 🔬 Tester le script console

```bash
# 1. Ouvrir extension/firefox/test-console-script.js
# 2. Copier tout le contenu
# 3. Ouvrir gemini.google.com
# 4. F12 → Console
# 5. Coller et appuyer sur Entrée
# 6. Attendre 10 secondes et regarder les résultats
```

## 📊 Analyser les résultats du test

```javascript
// Dans la console après le test, tu peux aussi faire :

// Voir toutes les API calls
console.table(capturedAPICalls);

// Voir les conversations extraites
console.table(extractedConversations);

// Télécharger les résultats
const data = {
  apiCalls: capturedAPICalls,
  conversations: extractedConversations
};
const blob = new Blob([JSON.stringify(data, null, 2)], {type: 'application/json'});
const url = URL.createObjectURL(blob);
const a = document.createElement('a');
a.href = url;
a.download = 'test-results.json';
a.click();
```

## 🚀 Publier l'extension (futur)

### Firefox Add-ons (AMO)

```bash
# 1. Créer un compte sur https://addons.mozilla.org
# 2. Build l'extension
cd extension/firefox
./build.sh

# 3. Aller sur https://addons.mozilla.org/developers/
# 4. "Submit a New Add-on"
# 5. Upload nexus-gemini-indexer-firefox.xpi
# 6. Remplir les infos (description, screenshots, etc.)
# 7. Soumettre pour review (gratuit, ~1-7 jours)
```

### Chrome Web Store

```bash
# 1. Créer un compte développeur ($5 one-time fee)
#    https://chrome.google.com/webstore/devconsole/

# 2. Build et zipper
cd extension/firefox
./build.sh
# Le .xpi est juste un .zip, renommer si besoin

# 3. Upload sur Chrome Web Store
# 4. Remplir les infos
# 5. Soumettre pour review (~1-3 jours)
```

## 🔗 Liens utiles

- [Firefox Extension Workshop](https://extensionworkshop.com/)
- [Chrome Extension Docs](https://developer.chrome.com/docs/extensions/)
- [WebExtensions API](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions)
- [Debugging Extensions](https://extensionworkshop.com/documentation/develop/debugging/)

## 💡 Tips

### Recharger rapidement pendant le dev

```bash
# Firefox: Ctrl+R dans about:debugging
# Chrome: Ctrl+R dans chrome://extensions/
# Page Gemini: F5
```

### Voir les erreurs

```bash
# Toujours vérifier 3 endroits :
# 1. Console de la page (F12)
# 2. Console du background script
# 3. Console du popup
```

### Tester sans installer

```bash
# Le script console (test-console-script.js) permet de tester
# la logique sans installer l'extension !
```

