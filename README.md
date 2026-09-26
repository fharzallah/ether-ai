# ETHER — Ton partenaire intellectuel sans complaisance

ETHER est un assistant IA **web et open-source** qui route tes questions entre plusieurs fournisseurs de modèles (Groq, Gemini, Mistral, OpenRouter…), avec une personnalité assumée : honnête, directe, sans complaisance.

La plupart des assistants IA sont conçus pour valider tes idées. ETHER fait l'inverse : il les challenge.

Tout tourne sur un seul **Cloudflare Worker** : il sert le site, détient les clés API (jamais envoyées au navigateur) et stocke comptes, quotas et conversations dans Workers KV. Tu peux déployer ta propre instance gratuitement en une dizaine de minutes.

## Ce qui rend ETHER différent

- **Aucune fausse politesse** — la contradiction est attendue, pas évitée.
- **Analyse critique systématique** — une idée faible se fait démonter, avec les raisons et la correction.
- **Longueur adaptative** — concis quand il le faut, détaillé avec des exemples quand le sujet l'exige.

## Fonctionnalités

- **Routage multi-fournisseurs** — Mistral, Gemini, Groq, Cerebras, puis OpenRouter en dernier recours. Un fournisseur à court de quota est détecté et sauté automatiquement. Tu peux aussi en choisir un à la main.
- **Réflexion approfondie** — pipeline en 5 étapes (décomposition → recherche web → analyse → critique → synthèse).
- **Recherche web** — Wikipedia et DuckDuckGo sans clé ; vrais résultats web avec une clé Tavily, Brave ou Serper.
- **Modes** — Teacher, Débat, Créatif, Écriture, et modes personnalisés qui **s'activent tout seuls** selon la demande, avec leurs propres documents de référence. Un assistant guide leur création et permet de les tester avant de les enregistrer.
- **Synchronisation** — les conversations suivent le compte, sur tous tes appareils.
- **Accès sur invitation** (optionnel) — un lien `?code=…` suffit pour inviter quelqu'un.
- **Images, vision, dictée vocale**, thèmes Dark / Light / Midnight.

## Architecture

```
navigateur ──► Cloudflare Worker (worker/src/index.js)
               ├─ fichiers statiques : index.html, style.css, renderer/*.js
               ├─ /api/chat, /api/chat/stream  → Groq, Gemini, Mistral, OpenRouter…
               ├─ /api/search, /api/fetch      → recherche et lecture de pages
               ├─ /api/register, /api/quota    → comptes (JWT) et quotas
               └─ /api/persist                 → conversations, dans Workers KV
```

- **Front** — HTML/CSS/JS vanilla, sans framework ni étape de build. `renderer/platform-web.js` expose l'API de plateforme (`window.etherDesktop`, nom hérité de l'ancienne version de bureau) utilisée par le reste du code.
- **Back** — un seul fichier, `worker/src/index.js`.

## Démarrer en local

Prérequis : Node.js 18+ et au moins une clé de fournisseur IA ([OpenRouter](https://openrouter.ai/keys) a un palier gratuit sans carte).

```bash
git clone https://github.com/fharzallah/ether-ai.git
cd ether-ai
npm install
cp worker/.dev.vars.example worker/.dev.vars   # puis renseigne tes clés
npm run dev                                     # http://localhost:8787
```

`worker/.dev.vars` est ignoré par git : tes clés ne quittent pas ta machine.

## Déployer ta propre instance

Le guide complet (compte Cloudflare, KV, secrets, code d'invitation, Stripe) est dans **[DEPLOY.md](DEPLOY.md)**. En résumé :

```bash
npx wrangler login
npx wrangler kv namespace create ETHER_KV      # reporte l'id dans worker/wrangler.toml
cd worker && npx wrangler secret put JWT_SECRET && npx wrangler secret put OPENROUTER_KEY && cd ..
npm run deploy
```

## Scripts

| Commande | Rôle |
|---|---|
| `npm run dev` | Site + API en local avec `wrangler dev` |
| `npm run deploy` | Construit `worker/public/` et déploie sur Cloudflare |
| `npm run lint` | Vérifie la syntaxe du front et du worker |
| `npm test` | Tests de fumée : structure, absence de clés, CSP, non-régression |

## Limites connues

Bonnes premières contributions :

- L'import de fichiers ne lit que le **texte brut** : PDF, Word et Excel ne sont pas encore extraits côté web.
- Les **fournisseurs personnalisés** (endpoint compatible OpenAI) ne sont pas encore relayés par le worker.
- Le quota est fixe (30 messages/jour/utilisateur, `DAILY_LIMIT` dans le worker).

## Contribuer

Les contributions sont bienvenues : lis [CONTRIBUTING.md](CONTRIBUTING.md). Pour signaler une faille, suis [SECURITY.md](SECURITY.md) plutôt que d'ouvrir une issue publique.

## Licence

[MIT](LICENSE)
