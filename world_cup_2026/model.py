import pandas as pd
import numpy as np
from scipy.optimize import minimize
from datetime import datetime
import json

def rho_correction(x, y, lambda_x, mu_y, rho):
    if x == 0 and y == 0:
        return 1 - lambda_x * mu_y * rho
    elif x == 0 and y == 1:
        return 1 + lambda_x * rho
    elif x == 1 and y == 0:
        return 1 + mu_y * rho
    elif x == 1 and y == 1:
        return 1 - rho
    return 1

def log_likelihood(params, games_data, n_teams, time_decay_phi):
    alpha = params[:n_teams]
    beta = params[n_teams:2*n_teams]
    gamma = params[2*n_teams]
    rho = params[2*n_teams + 1]

    log_l = 0
    for h_idx, a_idx, h_g, a_g, weight in games_data:
        lam = np.exp(alpha[h_idx] + beta[a_idx] + gamma)
        mu = np.exp(alpha[a_idx] + beta[h_idx])

        log_poisson_home = h_g * np.log(lam) - lam
        log_poisson_away = a_g * np.log(mu) - mu

        rho_corr = rho_correction(h_g, a_g, lam, mu, rho)
        log_rho = np.log(max(1e-10, rho_corr))

        log_l += weight * (log_poisson_home + log_poisson_away + log_rho)

    return -log_l

class DixonColesModel:
    def __init__(self, phi=0.5):
        self.phi = phi
        self.teams = []
        self.alpha = {}
        self.beta = {}
        self.gamma = 0
        self.rho = 0

    def fit(self, games):
        self.teams = sorted(list(set(games['Home']) | set(games['Away'])))
        team_to_idx = {t: i for i, t in enumerate(self.teams)}
        n_teams = len(self.teams)

        current_date = datetime(2026, 6, 1)
        games_data = []
        for _, row in games.iterrows():
            days_ago = (current_date - row['Date']).days
            # Combined Weight: Time Decay * Prestige Weight
            weight = np.exp(-self.phi * (days_ago / 365.0)) * row.get('PrestigeWeight', 1.0)

            games_data.append((
                team_to_idx[row['Home']],
                team_to_idx[row['Away']],
                row['HomeGoals'],
                row['AwayGoals'],
                weight
            ))

        init_params = np.concatenate([
            np.zeros(n_teams),
            np.zeros(n_teams),
            [0.1],
            [0.0]
        ])

        res = minimize(log_likelihood, init_params, args=(games_data, n_teams, self.phi), method='L-BFGS-B', options={'maxiter': 100})

        self.alpha = dict(zip(self.teams, res.x[:n_teams]))
        self.beta = dict(zip(self.teams, res.x[n_teams:2*n_teams]))
        self.gamma = float(res.x[2*n_teams])
        self.rho = float(res.x[2*n_teams + 1])

if __name__ == "__main__":
    df_matches = pd.read_csv('world_cup_2026/data/matches_cleaned.csv')
    df_matches['Date'] = pd.to_datetime(df_matches['Date'])

    df_fixtures = pd.read_csv('world_cup_2026/data/fixtures_cleaned.csv')
    wc_teams = set(df_fixtures['Home Team']) | set(df_fixtures['Away Team'])

    df_matches_wc = df_matches[df_matches['Home'].isin(wc_teams) & df_matches['Away'].isin(wc_teams)]

    # We use a higher phi (0.8) to give even more weight to very recent games (Euro 2024, Copa 2024)
    model = DixonColesModel(phi=0.8)
    model.fit(df_matches_wc)

    results = {
        'alpha': model.alpha,
        'beta': model.beta,
        'gamma': model.gamma,
        'rho': model.rho
    }
    with open('world_cup_2026/data/model_params.json', 'w') as f:
        json.dump(results, f)
    print("Model parameters saved with weighted importance.")
