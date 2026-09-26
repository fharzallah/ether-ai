# Contribuer à ETHER

Merci de ton intérêt ! Les issues comme les pull requests sont bienvenues, en français ou en anglais.

## Mettre en place l'environnement

```bash
git clone https://github.com/fharzallah/ether-ai.git
cd ether-ai
npm install
cp worker/.dev.vars.example worker/.dev.vars   # renseigne au moins une clé IA
npm run dev                                     # http://localhost:8787
```

## Où se trouve quoi

| Fichier | Rôle |
|---|---|
| `index.html`, `style.css` | Interface |
| `renderer/platform-web.js` | API de plateforme : chaque appel passe en HTTP par le worker |
| `renderer/core.js` | Stockage local, traductions, constantes des modèles |
| `renderer/engine.js` | Routage entre fournisseurs, prompts, réflexion approfondie |
| `renderer/app-main.js`, `renderer/ui.js` | Logique d'interface |
| `renderer/memory.js`, `renderer/skill-creator.js` | Mémoire utilisateur, création de modes |
| `worker/src/index.js` | Toute l'API : fournisseurs, auth, quotas, recherche, stockage |

Le front est en JavaScript vanilla, sans framework ni build : les fichiers sont servis tels quels.

## Avant d'ouvrir une pull request

1. `npm run lint` et `npm test` passent (la CI les lance aussi).
2. Tu as testé le changement dans le navigateur avec `npm run dev`.
3. Une PR = un sujet. Explique le **pourquoi** dans la description, pas seulement le quoi.
4. Un bug corrigé mérite un test de non-régression dans `test/smoke.js` quand c'est possible.

## Style de code

- Suis le style du fichier que tu modifies : ES5 (`var`, `function`) dans `renderer/`, JavaScript moderne dans `worker/`.
- Commentaires en français, qui expliquent le pourquoi.
- Messages de commit courts et au présent : `fix: ...`, `feat: ...`, `docs: ...`, `chore: ...`.

## Règles non négociables

- **Aucune clé API dans le code.** Les clés vivent dans les secrets Cloudflare (`wrangler secret put`) ou dans `worker/.dev.vars`, ignoré par git. Les tests refusent les motifs de clés connus.
- Le navigateur ne doit jamais recevoir de clé : tout appel à un fournisseur passe par le worker.
- Toute nouvelle route qui consomme une ressource payante passe par `verifyAuth`.

## Idées de contributions

Voir la section « Limites connues » du [README](README.md), et les issues marquées `good first issue`.
