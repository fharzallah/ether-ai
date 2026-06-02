import pandas as pd
import json
import numpy as np

# Prestige Boosts (Historical & Talent context)
PRESTIGE_BOOSTS = {
    'Spain': 0.85, 'France': 0.82, 'Argentina': 0.78, 'England': 0.80,
    'Brazil': 0.55, 'Netherlands': 0.52, 'Portugal': 0.48, 'Germany': 0.45,
    'Italy': 0.35, 'Belgium': 0.30, 'Uruguay': 0.30, 'Colombia': 0.10
}

def adjust_params():
    with open('world_cup_2026/data/model_params.json', 'r') as f:
        params = json.load(f)

    # 1. Player form (G/A)
    df_players = pd.read_csv('world_cup_2026/data/players_cleaned.csv')
    team_player_stats = df_players.groupby('Team').agg({
        'Non penalty goals and assists': 'mean'
    }).reset_index()
    avg_ga = team_player_stats['Non penalty goals and assists'].mean()
    team_player_stats['ga_factor'] = (team_player_stats['Non penalty goals and assists'] / avg_ga) - 1

    # 2. Advanced Stats (xG, xGA, Styles)
    df_adv = pd.read_csv('world_cup_2026/data/advanced_stats_cleaned.csv')
    # Domination Score = avg_xg / avg_xga
    df_adv['domination_score'] = np.log1p(df_adv['avg_xg']) - np.log1p(df_adv['avg_xga'])
    df_adv['domination_adj'] = df_adv['domination_score'] - df_adv['domination_score'].mean()

    adv_dict = df_adv.set_index('team').to_dict('index')
    player_dict = team_player_stats.set_index('Team')['ga_factor'].to_dict()

    # Style parameters to be stored in the JSON
    params['styles'] = {}

    for team in params['alpha'].keys():
        # A. Advanced Stats Adjustment (Weight: 40%)
        adv_data = adv_dict.get(team, {})
        adv_adj = adv_data.get('domination_adj', 0) * 0.40
        params['alpha'][team] += adv_adj
        params['beta'][team] -= adv_adj

        # B. Player form adjustment (Weight: 30%)
        ga_adj = player_dict.get(team, 0) * 0.30
        params['alpha'][team] += ga_adj
        params['beta'][team] -= ga_adj

        # C. Prestige/Title/Talent Boost (Weight: 30%)
        boost = PRESTIGE_BOOSTS.get(team, 0)
        params['alpha'][team] += boost
        params['beta'][team] -= boost

        # D. Store Style Info
        params['styles'][team] = {
            'possession': adv_data.get('possession', 50.0),
            'def_height': adv_data.get('def_height', 40.0)
        }

    with open('world_cup_2026/data/model_params_adjusted.json', 'w') as f:
        json.dump(params, f)
    print("Adjusted model parameters: xG/xGA (40%), Player Form (30%), Prestige (30%) + Styles exported.")

if __name__ == "__main__":
    adjust_params()
