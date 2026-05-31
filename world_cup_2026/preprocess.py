import pandas as pd
import numpy as np
from datetime import datetime

TEAM_MAPPING = {
    'South Korea': 'South Korea',
    'Bosnia & Herzegovina': 'Bosnia & Herzegovina',
    'Bosnia': 'Bosnia & Herzegovina',
    'Netherlands': 'Netherlands',
    'Switzerland': 'Switzerland',
    'Congo': 'D.R. Congo',
    'RD Congo': 'D.R. Congo',
    'Czech Republic': 'Czech Republic',
    'Ivory Coast': 'Ivory Coast',
    'Cape Verde': 'Cape Verde',
    'South Africa': 'South Africa',
    'Saudi Arabia': 'Saudi Arabia',
    'New Zealand': 'New Zealand',
    'USA': 'USA',
    'United States': 'USA',
    'États-Unis': 'USA',
    'Mexique': 'Mexico',
    'Angleterre': 'England',
    'France': 'France',
    'Croatie': 'Croatia',
    'Portugal': 'Portugal',
    'Norvège': 'Norway',
    'Allemagne': 'Germany',
    'Pays-Bas': 'Netherlands',
    'Espagne': 'Spain',
    'Écosse': 'Scotland',
    'Suisse': 'Switzerland',
    'Autriche': 'Austria',
    'Belgique': 'Belgium',
    'Turquie': 'Turkey',
    'Tchéquie': 'Czech Republic',
    'Suède': 'Sweden',
    'Maroc': 'Morocco',
    'Tunisie': 'Tunisia',
    'Égypte': 'Egypt',
    'Algérie': 'Algeria',
    'Ghana': 'Ghana',
    'Cap-Vert': 'Cape Verde',
    'Afrique du Sud': 'South Africa',
    'Sénégal': 'Senegal',
    'Côte d’Ivoire': 'Ivory Coast',
    'Japon': 'Japan',
    'Iran': 'Iran',
    'Ouzbékistan': 'Uzbekistan',
    'Jordanie': 'Jordan',
    'Corée du Sud': 'South Korea',
    'Australie': 'Australia',
    'Qatar': 'Qatar',
    'Arabie saoudite': 'Saudi Arabia',
    'Panama': 'Panama',
    'Haïti': 'Haiti',
    'Curaçao': 'Curacao',
    'Argentine': 'Argentina',
    'Brésil': 'Brazil',
    'Uruguay': 'Uruguay',
    'Équateur': 'Ecuador',
    'Colombie': 'Colombia',
    'Paraguay': 'Paraguay',
    'Nouvelle-Zélande': 'New Zealand',
    'Irak': 'Iraq',
    'Nethernlands': 'Netherlands',
    'Switzlernad': 'Switzerland',
    'Korea': 'South Korea',
    'Congo DR': 'D.R. Congo'
}

# Prestige weights (multipliers for Dixon-Coles likelihood or rating boost)
PRESTIGE_TEAMS = {
    'Spain': 1.25,      # Euro 2024 Winner, Nations League
    'Argentina': 1.25,  # WC 2022, Copa America 2024
    'France': 1.15,     # World Class squad consistency
    'Brazil': 1.10,     # Historical prestige
    'England': 1.10,    # Top squad value
    'Netherlands': 1.05,
    'Italy': 1.05,
    'Portugal': 1.05
}

def clean_name(name):
    if pd.isna(name): return name
    name = str(name).strip()
    return TEAM_MAPPING.get(name, name)

def preprocess():
    df_matches = pd.read_excel('world_cup_2026/data/matches.xlsx')
    df_matches['Date'] = pd.to_datetime(df_matches['Date'])

    # Keep matches from 2022
    df_matches = df_matches[df_matches['Date'] >= '2022-01-01']

    df_matches['Home'] = df_matches['Home'].apply(clean_name)
    df_matches['Away'] = df_matches['Away'].apply(clean_name)

    # Include ranking data to weight game importance
    # If a team with high rank beats another high rank, it should weight more
    # We use Home Ranking and Away Ranking (Lower is better)

    df_matches = df_matches.rename(columns={'Home.1': 'HomeGoals', 'Away.1': 'AwayGoals'})

    # Fill missing rankings with a high number (poor rank)
    df_matches['Home Ranking'] = df_matches['Home Ranking'].fillna(150)
    df_matches['Away Ranking'] = df_matches['Away Ranking'].fillna(150)

    # Calculate match importance based on prestige of opponents
    # We use a formula: weight = 1 / sqrt(Avg Ranking)
    df_matches['PrestigeWeight'] = 1.0 / np.sqrt((df_matches['Home Ranking'] + df_matches['Away Ranking']) / 2.0)
    # Normalize weight to mean 1.0
    df_matches['PrestigeWeight'] = df_matches['PrestigeWeight'] / df_matches['PrestigeWeight'].mean()

    df_matches = df_matches[['Date', 'Home', 'Away', 'HomeGoals', 'AwayGoals', 'PrestigeWeight']]
    df_matches = df_matches.dropna(subset=['HomeGoals', 'AwayGoals'])

    # Players
    df_players = pd.read_excel('world_cup_2026/data/players.xlsx', header=1)
    df_players['Team'] = df_players['Team'].apply(clean_name)

    # Fixtures
    df_fixtures = pd.read_excel('world_cup_2026/data/fixtures.xlsx')
    df_fixtures['Home Team'] = df_fixtures['Home Team'].apply(clean_name)
    df_fixtures['Away Team'] = df_fixtures['Away Team'].apply(clean_name)

    df_matches.to_csv('world_cup_2026/data/matches_cleaned.csv', index=False)
    df_players.to_csv('world_cup_2026/data/players_cleaned.csv', index=False)
    df_fixtures.to_csv('world_cup_2026/data/fixtures_cleaned.csv', index=False)
    print("Preprocessing complete with Prestige weighting.")

if __name__ == "__main__":
    preprocess()
