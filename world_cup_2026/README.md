# Coupe du Monde 2026 - Algorithme de Prédiction

Ce projet simule la Coupe du Monde 2026 à 48 équipes en utilisant le modèle mathématique **Dixon-Coles** ajusté par les performances individuelles des joueurs.

## Fonctionnalités
- **Modèle Dixon-Coles** : Estimation des forces d'attaque et de défense avec pondération temporelle (Time-Decay).
- **Ajustement Joueurs** : Les paramètres des équipes sont affinés selon la forme réelle des joueurs (buts/passes décisives en sélections).
- **Simulation Monte Carlo** : 100 000 simulations du tournoi complet pour des probabilités robustes.
- **Format 2026** : Gestion des 12 groupes de 4 et du repêchage des 8 meilleurs troisièmes.
- **Rapport HTML** : Génération d'une interface visuelle avec toutes les probabilités par stade.

## Installation

### Prérequis
- Python 3.8+
- pip (gestionnaire de paquets Python)

### Étapes
1. Clonez ce répertoire.
2. Installez les dépendances nécessaires :
   ```bash
   pip install pandas openpyxl scipy numpy
   ```

## Utilisation

Le projet est divisé en étapes logiques :

1. **Pré-traitement des données** :
   ```bash
   python world_cup_2026/preprocess.py
   ```
   *Nettoie les noms d'équipes et prépare les fichiers CSV.*

2. **Entraînement du modèle** :
   ```bash
   python world_cup_2026/model.py
   python world_cup_2026/adjust_model.py
   ```
   *Calcule les forces Dixon-Coles et applique les ajustements de performance des joueurs.*

3. **Lancement de la simulation (100k itérations)** :
   ```bash
   python world_cup_2026/simulator_parallel.py
   ```
   *Cette étape peut prendre quelques minutes selon votre processeur.*

4. **Génération du rapport** :
   ```bash
   python world_cup_2026/report.py
   ```
   *Crée le fichier `world_cup_2026/prediction_report.html`.*

## Structure des fichiers
- `data/` : Contient les datasets bruts et les résultats de simulation.
- `preprocess.py` : Script de nettoyage des données.
- `model.py` : Implémentation du modèle Dixon-Coles.
- `adjust_model.py` : Intégration des statistiques joueurs.
- `simulator_parallel.py` : Moteur de simulation haute performance.
- `report.py` : Générateur de l'interface visuelle.

## Tests
Pour vérifier que tout fonctionne correctement, lancez :
```bash
python world_cup_2026/test_logic.py
```
