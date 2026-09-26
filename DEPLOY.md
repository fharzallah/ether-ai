# Déployer ta propre instance d'ETHER

Tout tient dans un seul Cloudflare Worker : il sert le site et l'API. Le palier gratuit de Cloudflare suffit pour un usage personnel ou un petit groupe.

Chaque instance a **ses propres clés API**, **son propre stockage** et **son propre code d'invitation** : rien n'est partagé avec l'instance d'origine.

## 1. Prérequis

- Node.js 18+ et un compte [Cloudflare](https://dash.cloudflare.com/sign-up) (gratuit)
- Au moins une clé de fournisseur IA :

| Fournisseur | Où créer la clé | Secret |
|---|---|---|
| OpenRouter (palier gratuit, sans carte) | [openrouter.ai/keys](https://openrouter.ai/keys) | `OPENROUTER_KEY` |
| Groq | [console.groq.com/keys](https://console.groq.com/keys) | `GROQ_KEY` |
| Gemini | [aistudio.google.com/apikey](https://aistudio.google.com/apikey) | `GEMINI_KEY` |
| Mistral | [console.mistral.ai](https://console.mistral.ai) | `MISTRAL_KEY` |
| Cerebras | [cloud.cerebras.ai](https://cloud.cerebras.ai) | `CEREBRAS_KEY` |

Plus tu en configures, mieux ETHER encaisse les quotas épuisés : le routage saute automatiquement un fournisseur indisponible. Groq est aussi utilisé pour la dictée vocale, Gemini pour l'analyse d'images.

## 2. Installer et se connecter

```bash
git clone https://github.com/<ton-compte>/ether-ai.git
cd ether-ai
npm install
npx wrangler login
```

## 3. Créer le stockage (Workers KV)

Comptes, quotas et conversations vivent dans un namespace KV.

```bash
cd worker
npx wrangler kv namespace create ETHER_KV
```

La commande affiche un `id` : remplace celui de `[[kv_namespaces]]` dans `worker/wrangler.toml`. Sans ce binding, les quotas ne bloquent personne et rien n'est synchronisé.

## 4. Poser les secrets

Depuis `worker/`, chaque commande te demande la valeur. Elle est chiffrée chez Cloudflare et n'apparaît jamais dans le code.

```bash
npx wrangler secret put JWT_SECRET       # OBLIGATOIRE : longue chaîne aléatoire
npx wrangler secret put OPENROUTER_KEY   # au moins un fournisseur IA
npx wrangler secret put GROQ_KEY         # optionnel, idem pour GEMINI_KEY, MISTRAL_KEY, CEREBRAS_KEY
```

Pour générer `JWT_SECRET` :

```bash
openssl rand -base64 48
```

**Sans `JWT_SECRET`, l'authentification est désactivée** et n'importe qui peut consommer tes clés. Ne déploie jamais sans.

### Recherche web (optionnel)

Sans clé, la recherche utilise Wikipedia et DuckDuckGo. Pour de vrais résultats web, pose `SEARCH_KEY` ; le fournisseur est reconnu à la clé :

| Fournisseur | Palier gratuit | Format de clé |
|---|---|---|
| [Tavily](https://app.tavily.com) (recommandé) | 1000 recherches/mois, sans carte | `tvly-...` |
| [Brave Search](https://brave.com/search/api/) | crédit mensuel | `BSA...` |
| [Serper](https://serper.dev) | 2500 requêtes à l'inscription | autre |

```bash
npx wrangler secret put SEARCH_KEY
```

### Accès sur invitation (optionnel)

```bash
npx wrangler secret put INVITE_CODE
```

Sans `INVITE_CODE`, l'inscription est ouverte à tous. Avec, seuls ceux qui ont le lien peuvent créer un compte :

```
https://<ton-worker>.workers.dev/?code=<INVITE_CODE>
```

Le code est mémorisé dans le navigateur puis retiré de la barre d'adresse. Pour révoquer tous les liens, change la valeur du secret.

## 5. Déployer

Depuis la racine du projet :

```bash
npm run deploy
```

Le script copie le site dans `worker/public/` puis lance `wrangler deploy`. L'URL finale s'affiche à la fin (`https://ether-api.<ton-sous-domaine>.workers.dev`). Pour changer le nom du worker, modifie `name` dans `worker/wrangler.toml`.

Vérifie ensuite quels fournisseurs répondent :

```bash
curl https://<ton-worker>.workers.dev/api/providers
```

## 6. Mettre à jour et revenir en arrière

```bash
git pull && npm run deploy          # mettre à jour
cd worker && npx wrangler rollback  # revenir à la version précédente
```

## 7. Développement local

```bash
cp worker/.dev.vars.example worker/.dev.vars   # ignoré par git
npm run dev                                     # http://localhost:8787
```

En local, le KV est simulé et laisser `JWT_SECRET` vide désactive l'authentification.

## Paiement (expérimental)

Les routes `/api/stripe/*` sont une ébauche : le webhook ne vérifie pas encore la signature Stripe et n'active rien, et l'URL de retour est codée en dur. **Ne pose pas `STRIPE_SECRET` en production** tant que ce n'est pas terminé.
