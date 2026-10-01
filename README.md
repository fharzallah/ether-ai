# ETHER

**Ton partenaire intellectuel sans complaisance.**

ETHER est un assistant IA open-source qui te dit ce qui ne va pas dans ton idée, ton texte ou ton raisonnement, et comment le corriger. Il est gratuit, auto-hébergeable en une dizaine de minutes, et tes clés API ne quittent jamais le serveur.

[![Licence MIT](https://img.shields.io/badge/licence-MIT-blue.svg)](LICENSE)
[![Version](https://img.shields.io/badge/version-2.1.0-black.svg)](package.json)
[![Cloudflare Workers](https://img.shields.io/badge/propulsé%20par-Cloudflare%20Workers-orange.svg)](https://workers.cloudflare.com)

## Le problème

La plupart des assistants IA sont réglés pour te faire plaisir. Tu présentes une idée moyenne, on te répond qu'elle est « super intéressante ». Tu repars content et tu n'as rien appris.

ETHER fait l'inverse. Il part du principe que ta première version a des défauts, et il te les montre.

> Exemple illustratif, pas une conversation enregistrée.
>
> **Toi** : Je vais lancer un blog d'actualité pour les jeunes. Je publierai tous les jours.
>
> **Un assistant classique** : Excellente idée ! Un blog d'actualité pour les jeunes a un vrai potentiel. Voici quelques conseils pour bien démarrer…
>
> **ETHER** : « Actualité pour les jeunes » ne dit rien. Tous les médias généralistes visent déjà cette cible, et tu n'as pas leurs moyens. Publier tous les jours pendant trois mois, seul, est un plan qui s'arrête à la troisième semaine. Choisis un angle précis, par exemple décrypter une seule actualité par semaine en trois minutes de lecture. Voici comment tester cet angle en deux semaines…

Trois principes guident ETHER :

- **Aucune fausse politesse.** La contradiction est attendue, pas évitée.
- **Analyse critique systématique.** Une idée faible se fait démonter, avec les raisons et une correction.
- **Longueur adaptative.** Court quand la question est simple, détaillé avec des exemples quand le sujet l'exige.

## Pour qui

- Les **jeunes créateurs** qui veulent un avis honnête sur leurs projets (blog, vidéos, entreprise).
- Les **élèves et étudiants** qui préparent un débat, un exposé ou une dissertation et veulent des objections solides.
- Toute personne qui en a assez d'un assistant qui approuve tout.

## Ce que tu peux faire avec ETHER

| Besoin | Ce que fait ETHER |
|---|---|
| Tester une idée | Il cherche les failles, classe les risques et propose une version plus solide |
| Comprendre un sujet complexe | Le mode **Teacher** explique pas à pas, avec des exemples |
| Préparer un débat | Le mode **Débat** défend la position inverse de la tienne |
| Écrire | Les modes **Écriture** et **Créatif** retravaillent tes textes |
| Aller en profondeur | **Réflexion approfondie** : décomposition, recherche web, analyse, critique, synthèse |
| Obtenir un document | Génère de vrais fichiers `.docx` et `.xlsx` |
| Illustrer | Génère des images avec FLUX, et analyse tes images (vision) |
| Parler au lieu d'écrire | Dictée vocale |

Tu peux aussi créer tes **propres modes**. Un assistant te guide, tu les testes avant de les enregistrer, et ils **s'activent tout seuls** quand ta demande s'y prête. Chaque mode peut avoir ses documents de référence.

Le reste de l'essentiel : comptes avec synchronisation entre appareils, trois thèmes (Dark, Light, Midnight), recherche web, accès sur invitation.

## Gratuit, et honnête sur les limites

ETHER tourne sur le palier gratuit de Cloudflare. Le modèle **Workers AI** (Llama 3.3 70B) fonctionne sans aucune clé. Tu peux ajouter des fournisseurs gratuits ou payants (Groq, Gemini, Mistral, Cerebras, OpenRouter) pour plus de puissance et de marge.

Les limites à connaître :

- Chaque utilisateur a **100 messages par jour**. Seuls les messages que tu envoies comptent : les tâches internes (résumé de la conversation, mémoire, étapes de la réflexion approfondie) n'entament pas ce quota. Un plafond plus large sur l'ensemble des appels protège le serveur des abus.
- Le budget quotidien de Workers AI est partagé par tous les utilisateurs d'une instance. À 95 %, ETHER passe sur un autre fournisseur.
- Avec **ta propre clé API**, tes messages ne comptent plus dans le quota.

C'est pour cela qu'ETHER est pensé pour être auto-hébergé : chaque instance apporte son propre quota gratuit.

## Confidentialité et sécurité

- **Tes clés API restent côté serveur.** Elles ne sont jamais envoyées au navigateur.
- **Ta clé personnelle n'est jamais stockée.** Elle reste dans ton navigateur et passe par un en-tête, que le serveur relaie sans l'enregistrer. Le code est public : tu peux le vérifier.
- **Mots de passe hachés** (PBKDF2), blocage après 10 échecs, sessions révoquées après une réinitialisation.
- **Code de secours** remis à l'inscription : aucun service d'email nécessaire.
- **Tes données t'appartiennent.** Export JSON et suppression du compte dans Paramètres > « Mes données ».
- Protection contre les requêtes vers des adresses internes (SSRF), politique CSP et en-têtes de sécurité.

Pour signaler une faille, lis [SECURITY.md](SECURITY.md).

## Comment ça marche

Tout tient dans un seul **Cloudflare Worker**. Il sert le site, porte l'API, détient les clés et stocke comptes, quotas et conversations dans Workers KV.

```
navigateur ──► Cloudflare Worker (worker/src/index.js)
               ├─ fichiers statiques : index.html, style.css, renderer/*.js
               ├─ /api/chat, /api/chat/stream  → fournisseurs IA
               ├─ /api/search, /api/fetch      → recherche et lecture de pages
               ├─ /api/auth/*, /api/quota      → comptes (JWT) et quotas
               ├─ /api/account/*               → export et suppression
               └─ /api/persist                 → conversations, dans Workers KV
```

**Le routage.** Pour chaque message, ETHER essaie les fournisseurs dans cet ordre : Mistral, Gemini, Groq, Cerebras, Workers AI, puis OpenRouter en dernier recours. Un fournisseur à court de quota est détecté et sauté. Si tu en choisis un à la main, ETHER respecte ton choix : en cas d'échec, tu vois l'erreur au lieu d'un changement silencieux.

**Le front** est en HTML, CSS et JavaScript vanilla, sans framework ni étape de build. `renderer/platform-web.js` expose l'API de plateforme (`window.etherDesktop`, nom hérité de l'ancienne version de bureau).

## Utiliser ETHER

| Tu veux | Fais ceci |
|---|---|
| Ton propre ETHER, en ligne | Déploie-le sur Cloudflare (ci-dessous) |
| Essayer en local | Lance-le sur ta machine (ci-dessous) |
| Utiliser l'instance de quelqu'un d'autre | Ouvre son lien. Si l'accès est sur invitation, le lien se termine par `?code=…` |

### Déployer ta propre instance

Prérequis : Node.js 18+ et un compte [Cloudflare](https://dash.cloudflare.com/sign-up) gratuit.

```bash
git clone https://github.com/fharzallah/ether-ai.git
cd ether-ai
npm install
npx wrangler login
npx wrangler kv namespace create ETHER_KV
```

Reporte l'identifiant affiché dans `worker/wrangler.toml`, puis :

```bash
cd worker
npx wrangler secret put JWT_SECRET
cd ..
npm run deploy
```

Le guide complet (fournisseurs, recherche web, code d'invitation, mise à jour, retour arrière) est dans **[DEPLOY.md](DEPLOY.md)**.

### Lancer en local

```bash
git clone https://github.com/fharzallah/ether-ai.git
cd ether-ai
npm install
cp worker/.dev.vars.example worker/.dev.vars
npm run dev
```

Ouvre ensuite `worker/.dev.vars` pour y mettre tes clés. Le site tourne sur http://localhost:8787. Ce fichier est ignoré par git : tes clés ne quittent pas ta machine.

## Commandes utiles

| Commande | Rôle |
|---|---|
| `npm run dev` | Site et API en local avec `wrangler dev` |
| `npm run deploy` | Construit `worker/public/` et déploie sur Cloudflare |
| `npm run lint` | Vérifie la syntaxe du front et du worker |
| `npm test` | Tests de fumée : structure, absence de clés, CSP, non-régression |

## Limites connues

- L'import de fichiers ne lit que le **texte brut**. PDF, Word et Excel ne sont pas encore extraits côté web.
- Pas de réinitialisation par email : sans mot de passe ni code de secours, un compte est perdu.

## Feuille de route

Pas encore disponible, mais prévu :

- Installation en un clic comme application (PWA), sur ordinateur et téléphone.
- Mode d'essai sans compte, avec conversations gardées dans ton navigateur.
- Déploiement en un clic sur Cloudflare.

## Contribuer

Les contributions sont bienvenues, surtout sur les limites connues ci-dessus. Lis [CONTRIBUTING.md](CONTRIBUTING.md) avant ta première pull request.

## Licence

[MIT](LICENSE)
