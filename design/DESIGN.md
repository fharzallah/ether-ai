# ETHER

ETHER est une IA franche : elle challenge tes idées au lieu de les valider. L'interface doit être agréable à utiliser longtemps, chaleureuse, et laisser la franchise au contenu. Le ton est dur, l'outil est doux.

Une seule identité, trois thèmes : **Sombre** (par défaut), **Clair**, **Minuit**, plus **Auto** qui suit le système.

## Le logo

Le logo est celui de l'appli, et il ne change plus : cinq pentagones rouges superposés, légèrement tournés les uns par rapport aux autres, avec des points sombres aux sommets des deux plus grands et deux triangles sombres au centre.

- Couleur : `brand` (#EF4136), couches remplies à 26 %, contour à 90 %.
- Une seule version, à toutes les tailles. Pas de version simplifiée.
- Animation : dans le code, chaque couche tourne à sa propre vitesse (40 s pour la plus grande, 12 s pour la plus petite, sens alternés). Lente à l'accueil et à la connexion, rapide pendant qu'ETHER répond. Arrêtée si l'utilisateur a demandé moins d'animations. Le fichier du groupe Logos est la version fixe : l'outil d'import retire les animations des SVG.
- Le mot-symbole : « ETHER » en Syne 700, capitales, espacement 0.32em. C'est le seul endroit où Syne apparaît.

## Le contenu : comment ETHER parle

- Tutoiement partout, y compris dans l'interface. « Comment puis-je vous aider ? » devient une phrase propre au mode : « Expose une idée. Je cherche ce qui casse. »
- Phrases courtes, voix active. Pas d'emoji. Pas de tiret long.
- Tous les accents. L'appli actuelle n'en a aucun (« mesuree », « Parametres », « Debat ») : c'est le premier défaut à corriger.
- Les messages d'erreur disent quoi faire : « Erreur : écris ton adresse e-mail. »

## Couleur

Des neutres chauds, légèrement brun-gris, plutôt que des gris froids : c'est ce qui rend l'interface agréable sans la rendre molle.

- `bg`, `sidebar`, `surface`, `surface-2` : quatre niveaux de profondeur. La barre latérale est un ton plus clair que le fond, les cartes et fenêtres encore un ton au-dessus.
- `brand` est le rouge du logo. `accent` est le même rouge un peu plus profond, pour que le texte blanc reste lisible sur les boutons. `accent-text` est le rouge éclairci qui sert de texte sur fond sombre.
- `accent-soft` est une teinte rouge transparente : fond du mode actif, halo de focus, avatar. Elle donne de la chaleur sans crier.
- Une seule couleur d'état en plus : un vert (#3FB37F) pour le point « Actif » des fournisseurs.

**Règle de dosage :** un seul aplat rouge plein par zone (le bouton principal ou Envoyer). Le reste du rouge est en texte ou en teinte légère. Dans l'appli actuelle, icônes, chiffres, bulles et bordures sont tous rouges, donc plus rien ne ressort.

## Typographie

- **Fraunces** pour les titres, avec l'axe `SOFT` à 100 : les empattements deviennent arrondis. Elle garde le côté éditorial du brief, sans la raideur.
- **Geist** pour tout le reste, réponses d'ETHER comprises (16px, interligne 27px).
- **Geist Mono** pour le code, les points d'accès et les fichiers joints.
- **Syne** uniquement pour le mot-symbole.

```html
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght,SOFT,WONK@9..144,300..700,0..100,0..1&family=Geist:wght@400;500;600&family=Geist+Mono:wght@400;500&family=Syne:wght@700&display=swap">
```

## Formes

Les coins sont arrondis, avec une échelle claire : plus un objet est grand et flottant, plus il est rond.

| Rayon | Valeur | Où |
|---|---|---|
| `radius-xs` | 6px | code en ligne |
| `radius-sm` | 8px | navigation, petits boutons |
| `radius-md` | 12px | boutons, champs, cartes de réglages |
| `radius-lg` | 16px | suggestions, compteurs |
| `radius-xl` | 22px | barre de saisie, fenêtres, carte de connexion |
| `radius-full` | 999px | modes, pastilles, Envoyer, interrupteur, avatar |

Ombres douces uniquement sous ce qui flotte : barre de saisie (`shadow`), fenêtres et menus (`shadow-lg`). Pas de lueur, pas de verre, pas de dégradé violet.

Mouvement : transitions de 150ms sur les survols, apparition des fenêtres en 180ms. Rien ne bouge si l'utilisateur a demandé moins d'animations.

## Écrans

| Écran | Composant | L'essentiel |
|---|---|---|
| Connexion | Login | Carte centrée, logo qui tourne lentement, onglets segmentés, « Essayer sans compte » en secondaire. |
| Navigation | Sidebar | Fond `sidebar`, sections repliables, discussion active en carte, icônes grises. |
| Accueil | Home | « Bonjour, Fadi. » en Fraunces douce, phrase du mode, 4 suggestions en cartes. |
| Saisie | Composer | Modes en pilules, actif en teinte rouge. Barre flottante arrondie avec ombre. |
| Fil | Messages | Ta bulle à droite, la réponse d'ETHER en texte libre à côté du logo. |
| Paramètres | Settings | Raccourcis en haut, vignettes de thèmes, cartes de fournisseurs. |
| Suivi | Stats | Compteurs en Fraunces, barre de niveau arrondie. |

Le prototype cliquable montre tout en marche.

## Textes à corriger dans l'appli

| Aujourd'hui | Correction |
|---|---|
| Aucun accent nulle part | Rétablir tous les accents (vérifier l'encodage UTF-8). |
| « Comment puis-je vous aider ? » | Tutoyer. Phrase propre au mode. |
| « Teacher » | « Tuteur » |
| « Pourcontre le télétravail » | « Pour ou contre le télétravail » |
| « http://[object Object]:3456 » | L'adresse IP réelle. Le code affiche l'objet au lieu de sa propriété. |
| « MODES PERSONNALISES » | « Modes personnalisés », en Fraunces comme les autres titres. |
| Neuf thèmes, chacun avec son accent | Auto, Sombre, Clair, Minuit. Le rouge ne change jamais. |

## Une contradiction à trancher

Le brief dit « mentor impitoyable ». La connexion dit « IA franche, mesurée et transparente ». Et ETHER répond aujourd'hui à « hey bonjour » par « je suis prêt à t'écouter et à te donner mon avis ». Le design ne peut pas porter un caractère que le prompt système ne tient pas. Il faut choisir, puis réécrire le prompt.
