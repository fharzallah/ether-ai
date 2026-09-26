# Politique de sécurité

## Signaler une vulnérabilité

**N'ouvre pas d'issue publique pour une faille de sécurité.**

Utilise le [signalement privé de GitHub](https://github.com/fharzallah/ether-ai/security/advisories/new) (onglet *Security* → *Report a vulnerability*). Décris :

- ce qui est touché (route de l'API, fichier, fonctionnalité) ;
- comment reproduire ;
- l'impact possible.

Tu recevras une première réponse sous 7 jours. Merci de laisser le temps de corriger avant toute divulgation publique.

## Périmètre

Sont concernés : le code de ce dépôt (`worker/`, `renderer/`, `index.html`) et l'instance publique d'origine.

Chaque instance auto-hébergée est sous la responsabilité de la personne qui la déploie, notamment pour ses clés et son `JWT_SECRET`.

## Bonnes pratiques pour les instances auto-hébergées

- Pose toujours `JWT_SECRET` : sans lui, l'authentification est désactivée.
- Ne commite jamais `worker/.dev.vars` ni aucune clé.
- Utilise `INVITE_CODE` si ton instance n'est pas destinée au public.
- En cas de fuite d'une clé, révoque-la chez le fournisseur puis repose-la avec `wrangler secret put`.
