import pandas as pd
import json

def adjust_params():
    with open('world_cup_2026/data/model_params.json', 'r') as f:
        params = json.load(f)
    df_players = pd.read_csv('world_cup_2026/data/players_cleaned.csv')
    team_stats = df_players.groupby('Team').agg({'Non penalty goals and assists': 'mean'}).reset_index()
    team_stats['form_factor'] = team_stats['Non penalty goals and assists'] / team_stats['Non penalty goals and assists'].mean()
    for team, alpha in params['alpha'].items():
        stats = team_stats[team_stats['Team'] == team]
        if not stats.empty:
            factor = stats['form_factor'].values[0]
            adjustment = (factor - 1) * 0.05
            params['alpha'][team] += adjustment
            params['beta'][team] -= adjustment
    with open('world_cup_2026/data/model_params_adjusted.json', 'w') as f:
        json.dump(params, f)
    print("Adjusted model parameters saved.")

if __name__ == "__main__":
    adjust_params()
