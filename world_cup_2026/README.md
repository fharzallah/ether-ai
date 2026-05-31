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

### Étapes (Recommandé pour Mac/Linux)
Il est fortement conseillé d'utiliser un environnement virtuel :

1. **Ouvrez votre terminal** dans le dossier du projet.
2. **Créez l'environnement virtuel** :
   ```bash
   python3 -m venv venv
   ```
3. **Activez-le** :
   - Sur macOS/Linux : `source venv/bin/activate`
   - Sur Windows : `venv\Scripts\activate`
4. **Installez les dépendances** :
   ```bash
   pip install pandas openpyxl scipy numpy
   ```

## Utilisation

Le projet est divisé en étapes logiques :

1. **Pré-traitement des données** :
   ```bash
   python3 world_cup_2026/preprocess.py
   ```
2. **Entraînement du modèle** :
   ```bash
   python3 world_cup_2026/model.py
   python3 world_cup_2026/adjust_model.py
   ```
3. **Lancement de la simulation (100k itérations)** :
   ```bash
   python3 world_cup_2026/simulator_parallel.py
   ```
4. **Génération du rapport** :
   ```bash
   python3 world_cup_2026/report.py
   ```
   *Ouvrez ensuite `world_cup_2026/prediction_report.html` dans votre navigateur.*

## Tests
Pour vérifier que tout fonctionne correctement :
```bash
python3 world_cup_2026/test_logic.py
```
