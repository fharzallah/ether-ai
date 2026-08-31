# ETHER — Ton partenaire intellectuel sans complaisance

ETHER est une application de chat IA de bureau (Electron) qui route intelligemment tes requêtes entre plusieurs fournisseurs d'API — **Groq, Gemini, Mistral AI et Cerebras** — plus un modèle local via **Ollama** en dernier recours, tout en gardant une personnalité distincte : honnête, directe, sans complaisance.

La plupart des assistants IA sont conçus pour valider tes idées. ETHER fait l'inverse : il les challenge.

## Ce qui rend ETHER différent

- **Aucune fausse politesse** — La contradiction est attendue, pas évitée.
- **Analyse critique systématique** — Une idée faible se fait démonter, avec les raisons et la correction.
- **Longueur de réponse adaptative** — Concis quand il le faut, détaillé avec exemples concrets quand le sujet l'exige.
- **Pas de blabla creux** — Les réponses vides et les tutoriels trop techniques sont évités par design.

## Fonctionnalités principales

- **Routing multi-provider intelligent** — Bascule entre Groq (Llama 3.3 70B, Qwen3 32B), Gemini 2.5 Flash (rotation automatique sur jusqu'à 3 clés), Mistral Large/Small et Cerebras selon la tâche.
- **Fallback local via Ollama** — Si tous les providers cloud sont indisponibles (quota épuisé, panne réseau), ETHER bascule automatiquement sur un modèle tournant en local. Aucune clé, aucun quota, ne dépend de rien d'externe.
- **Providers personnalisés** — Possibilité de brancher un endpoint compatible OpenAI ou l'API Anthropic directement dans les réglages.
- **Modes de conversation** — Teacher (apprentissage guidé), Créatif, Débat (argumentation contradictoire), Écriture, et modes 100% personnalisés.
- **Génération et lecture de documents** — Import/analyse de PDF, Word (`.docx`) et Excel (`.xlsx`) via `pdf-parse`, `mammoth` et `xlsx`.
- **Recherche web** — Intégration DuckDuckGo pour enrichir les réponses avec des résultats récents.
- **Thèmes** — Dark, Light et Midnight.
- **Auto-update** — Mise à jour automatique via GitHub Releases (`electron-updater`).
- **Backend Cloudflare Workers** (optionnel) — API serverless pour l'orchestration multi-utilisateurs, l'authentification et un futur module de paiement Stripe (`worker/`).

## Stack technique

- **Application** — Electron (process principal `main.js`, UI en HTML/CSS/JS vanilla dans `index.html` + `renderer/`, `preload.js` en `contextBridge` avec `contextIsolation`)
- **Providers IA** — Groq, Google Gemini, Mistral AI, Cerebras, Ollama (local, fallback)
- **Backend optionnel** — Cloudflare Workers (`worker/`)
- **Environnement** — Node.js 18+, clés API chargées via `.env` (jamais committées)

## Démarrage

### Prérequis

- Node.js 18+
- Au moins une clé API parmi : Groq, Gemini, Mistral, Cerebras — ou [Ollama](https://ollama.com) installé en local (aucune clé requise)

### Installation

```bash
git clone https://github.com/fharzallah/ether-ai.git
cd ether-ai
npm install
```

### Configuration

Crée un fichier `.env` à la racine du projet :

```env
GROQ_KEY=ta_cle_groq
GEMINI_KEY_1=ta_cle_gemini_1
GEMINI_KEY_2=ta_cle_gemini_2
GEMINI_KEY_3=ta_cle_gemini_3
MISTRAL_KEY=ta_cle_mistral
CEREBRAS_KEY=ta_cle_cerebras
```

Seule une clé est nécessaire pour démarrer ; les autres providers restent simplement indisponibles tant qu'ils ne sont pas configurés.

### Ollama (fallback local, optionnel mais recommandé)

```bash
brew install ollama
brew services start ollama
ollama pull llama3.2:3b          # rapide, usage general
ollama pull qwen2.5:3b-instruct  # raisonnement (analyse, critique, mode Teacher/Debat)
```

Aucune configuration côté ETHER : si un serveur Ollama tourne sur `http://127.0.0.1:11434`, il est détecté et utilisé automatiquement comme dernier recours quand les providers cloud sont en échec — y compris dans le pipeline "Réflexion approfondie" (Décomposition/Analyse/Critique/Synthèse), qui bascule sur Ollama à chaque étape si besoin. Pour changer d'URL ou de modèles : variables d'environnement `OLLAMA_URL`, `OLLAMA_MODEL`, `OLLAMA_MODEL_FAST`, `OLLAMA_MODEL_REASONING` dans `.env`.

### Lancer l'app

```bash
npm start
```

### Tests

```bash
npm run lint   # vérifie la syntaxe de main.js, preload.js et renderer/*.js
npm test       # smoke tests (structure, sécurité, CSP, contextBridge...)
```

### Build (macOS)

```bash
npm run build
```

## Backend Cloudflare Workers (optionnel)

Le dossier `worker/` contient une API serverless Cloudflare Workers pour l'orchestration multi-utilisateurs et un futur module Stripe. Voir [DEPLOY.md](DEPLOY.md) pour le guide de déploiement complet (releases GitHub, Workers, Stripe).

```bash
cd worker/
cp .dev.vars.example .dev.vars   # renseigne tes clés localement, jamais commité
npx wrangler dev
```

## Sécurité

- Aucune clé API n'est codée en dur dans le code source : tout passe par des variables d'environnement (`.env`, `worker/.dev.vars`), toutes deux exclues du dépôt via `.gitignore`.
- Le renderer tourne avec `contextIsolation` activé ; toute communication avec le process principal passe par `contextBridge` (`preload.js`).
- Une politique CSP (Content-Security-Policy) est appliquée à la fenêtre principale.

Si tu repères une faille de sécurité, ouvre une issue privée ou contacte directement le mainteneur plutôt que de la divulguer publiquement.

## Statut du projet

En développement actif (v1.2.0). Projet personnel — retours et contributions bienvenus via issues et pull requests.

## Licence

[MIT](LICENSE)
