# Pipeline ZIP unifié

Ce document décrit le pipeline ZIP de `dev-1.5.7`.

## Principes

- Desktop : lecture lazy via `yauzl`
- Mobile : lecture random-access via `File.slice`
- Une seule abstraction interne : `ZipArchiveReader`
- Aucun fallback mobile qui recharge toute l'archive en mémoire
- Une seule entrée binaire décompressée au moment de l'écriture

## API interne

Le code d'import et les extracteurs utilisent maintenant :

- `ZipArchiveReader.listEntries()`
- `ZipArchiveReader.has(path)`
- `ZipArchiveReader.get(path)`
- `ZipEntryHandle.readText()`
- `ZipEntryHandle.readBytes()`

Les extracteurs ne dépendent plus du faux contrat `JSZip` dans le chemin nominal.

## Backends

### Desktop

Le backend desktop repose sur `yauzl` :

- lecture du central directory
- indexation des entrées sans décompression
- lecture d'une entrée à la demande uniquement

### Mobile

Le backend mobile repose sur :

- `FileReader`
- lecture de l'EOCD
- parsing du Central Directory
- lecture ciblée du local header
- décompression unitaire avec `DecompressionStream`

Si l'archive ne peut pas être traitée proprement sur mobile, l'import échoue avec
une erreur explicite au lieu de retomber sur un chargement complet risqué.

## Lookup des attachements

Chaque archive construit un index metadata-only :

- `byExactPath`
- `byBaseName`
- `byFileId`
- `byDalleId`

Le but est d'éviter les rescans complets de l'archive pendant le traitement des images.

## Traitement des conversations

- ChatGPT / Claude / Le Chat : streaming par défaut
- Gemini : chemin all-at-once conservé tant que le regroupement par index l'exige

## Traitement des attachements

Le chemin nominal est :

1. trouver l'entrée via l'index
2. ouvrir un seul `ZipEntryHandle`
3. lire une seule fois le contenu
4. écrire immédiatement dans le vault
5. libérer la référence locale

Ce design évite de dépendre des pauses GC pour la sûreté mémoire.
