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
    'Congo DR': 'D.R. Congo',
    'Cape Verde Islands': 'Cape Verde',
    "Côte d'Ivoire": 'Ivory Coast'
}

def clean_name(name):
    if pd.isna(name): return name
    name = str(name).strip()
    return TEAM_MAPPING.get(name, name)

def preprocess():
    # Matches
    df_matches = pd.read_excel('world_cup_2026/data/matches.xlsx')
    df_matches['Date'] = pd.to_datetime(df_matches['Date'])
    df_matches = df_matches[df_matches['Date'] >= '2022-01-01']
    df_matches['Home'] = df_matches['Home'].apply(clean_name)
    df_matches['Away'] = df_matches['Away'].apply(clean_name)
    df_matches = df_matches.rename(columns={'Home.1': 'HomeGoals', 'Away.1': 'AwayGoals'})
    df_matches['Home Ranking'] = df_matches['Home Ranking'].fillna(150)
    df_matches['Away Ranking'] = df_matches['Away Ranking'].fillna(150)

    df_matches['PrestigeWeight'] = 1.0 / np.sqrt((df_matches['Home Ranking'] + df_matches['Away Ranking']) / 2.0)
    df_matches['PrestigeWeight'] = df_matches['PrestigeWeight'] / df_matches['PrestigeWeight'].mean()

    df_matches = df_matches[['Date', 'Home', 'Away', 'HomeGoals', 'AwayGoals', 'PrestigeWeight']]
    df_matches = df_matches.dropna(subset=['HomeGoals', 'AwayGoals'])
    df_matches.to_csv('world_cup_2026/data/matches_cleaned.csv', index=False)

    # Players
    df_players = pd.read_excel('world_cup_2026/data/players.xlsx', header=1)
    df_players['Team'] = df_players['Team'].apply(clean_name)
    df_players.to_csv('world_cup_2026/data/players_cleaned.csv', index=False)

    # Advanced Stats (mapping names)
    if pd.io.common.file_exists('world_cup_2026/data/advanced_stats_combined.csv'):
        df_adv = pd.read_csv('world_cup_2026/data/advanced_stats_combined.csv')
        df_adv['team'] = df_adv['team'].apply(clean_name)
        df_adv.to_csv('world_cup_2026/data/advanced_stats_cleaned.csv', index=False)

    # Fixtures
    df_fixtures = pd.read_excel('world_cup_2026/data/fixtures.xlsx')
    df_fixtures['Home Team'] = df_fixtures['Home Team'].apply(clean_name)
    df_fixtures['Away Team'] = df_fixtures['Away Team'].apply(clean_name)
    df_fixtures.to_csv('world_cup_2026/data/fixtures_cleaned.csv', index=False)

    print("Preprocessing complete with Prestige weighting and Advanced Stats mapping.")

if __name__ == "__main__":
    preprocess()
