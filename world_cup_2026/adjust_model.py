import pandas as pd
import json

# ULTIMATE REALISM BOOSTS (Final V3)
# These values are carefully calibrated to ensure World Class teams
# reflect their true power levels, overcoming raw score noise.
PRESTIGE_BOOSTS = {
    'Spain': 0.85,      # Absolute peak form, Euro 2024 Winner
    'France': 0.82,     # Elite depth, serial finalist
    'Argentina': 0.78,  # WC & Copa Winner
    'England': 0.80,    # Top squad value, consistently deep in tournaments
    'Brazil': 0.55,     # Squad depth correction
    'Netherlands': 0.52, # Tactical elite
    'Portugal': 0.48,   # High talent
    'Germany': 0.45,    # Returning power
    'Italy': 0.35,      # Tactical pedigree
    'Belgium': 0.30,    # Quality base
    'Uruguay': 0.30,
    'Colombia': 0.05    # Colombia already has high raw stats, small boost to avoid over-inflation
}

def adjust_params():
    with open('world_cup_2026/data/model_params.json', 'r') as f:
        params = json.load(f)

    df_players = pd.read_csv('world_cup_2026/data/players_cleaned.csv')

    # Player performance proxy
    team_stats = df_players.groupby('Team').agg({
        'Non penalty goals and assists': 'mean'
    }).reset_index()

    avg_form = team_stats['Non penalty goals and assists'].mean()
    team_stats['form_factor'] = team_stats['Non penalty goals and assists'] / avg_form

    for team, alpha in params['alpha'].items():
        # 1. Player form adjustment (max 10%)
        stats = team_stats[team_stats['Team'] == team]
        if not stats.empty:
            factor = stats['form_factor'].values[0]
            form_adj = (factor - 1) * 0.10
            params['alpha'][team] += form_adj
            params['beta'][team] -= form_adj

        # 2. Final Prestige/Title/Talent Boost
        boost = PRESTIGE_BOOSTS.get(team, 0)
        params['alpha'][team] += boost
        params['beta'][team] -= boost

    with open('world_cup_2026/data/model_params_adjusted.json', 'w') as f:
        json.dump(params, f)
    print("Adjusted model parameters with FINAL V3 REALISM boosts.")

if __name__ == "__main__":
    adjust_params()
