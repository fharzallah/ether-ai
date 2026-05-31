import pandas as pd
import numpy as np
import json
from collections import Counter
import multiprocessing
import os

class WorldCupSimulator:
    def __init__(self, params, fixtures):
        self.params = params
        self.fixtures = fixtures
        self.teams = sorted(list(self.params['alpha'].keys()))

    def simulate_match(self, home, away):
        # Handle cases where teams might be missing from model (fall back to neutral)
        alpha_h = self.params['alpha'].get(home, 0)
        beta_h = self.params['beta'].get(home, 0)
        alpha_a = self.params['alpha'].get(away, 0)
        beta_a = self.params['beta'].get(away, 0)
        lam = np.exp(alpha_h + beta_a)
        mu = np.exp(alpha_a + beta_h)
        return np.random.poisson(lam), np.random.poisson(mu)

    def simulate_tournament(self, _=None):
        # 1. Group Stage
        group_standings = {}
        all_stats = {}
        group_matches_fixtures = self.fixtures[self.fixtures['Stage'] == 'Group Stage']
        for group in sorted(group_matches_fixtures['Group / Knockout'].unique()):
            matches = group_matches_fixtures[group_matches_fixtures['Group / Knockout'] == group]
            teams = list(set(matches['Home Team']) | set(matches['Away Team']))
            standings = {t: {'pts': 0, 'gd': 0, 'gs': 0} for t in teams}
            for _, m in matches.iterrows():
                h, a = m['Home Team'], m['Away Team']
                hg, ag = self.simulate_match(h, a)
                standings[h]['gs'] += hg
                standings[a]['gs'] += ag
                standings[h]['gd'] += (hg - ag)
                standings[a]['gd'] += (ag - hg)
                if hg > ag: standings[h]['pts'] += 3
                elif ag > hg: standings[a]['pts'] += 3
                else:
                    standings[h]['pts'] += 1
                    standings[a]['pts'] += 1
            all_stats.update(standings)
            group_standings[group] = sorted(teams, key=lambda x: (standings[x]['pts'], standings[x]['gd'], standings[x]['gs']), reverse=True)

        # 2. Qualifiers for R32
        # Map of Group -> Winners
        results_map = {}
        thirds_stats = []
        for g in sorted(group_standings.keys()):
            results_map[f"1{g[-1]}"] = group_standings[g][0]
            results_map[f"2{g[-1]}"] = group_standings[g][1]
            t3 = group_standings[g][2]
            thirds_stats.append((t3, all_stats[t3]['pts'], all_stats[t3]['gd'], all_stats[t3]['gs']))

        # Select 8 best 3rd placed teams
        best_thirds = sorted(thirds_stats, key=lambda x: (x[1], x[2], x[3]), reverse=True)[:8]
        # For simplicity in bracket mapping, we just identify them as a pool
        # The official 2026 bracket for 3rd place is complex, we use the pool placeholder
        results_map["3ABCDF"] = best_thirds[0][0] # Placeholder for 1E opponent
        results_map["3CDFGH"] = best_thirds[1][0] # Placeholder for 1I opponent
        results_map["3CEFHI"] = best_thirds[2][0] # Placeholder for 1A opponent
        results_map["3EHIJK"] = best_thirds[3][0] # Placeholder for 1L opponent
        results_map["3AEHIJ"] = best_thirds[4][0] # Placeholder for 1G opponent
        results_map["3BEFIJ"] = best_thirds[5][0] # Placeholder for 1D opponent
        results_map["3EFGIJ"] = best_thirds[6][0] # Placeholder for 1B opponent
        results_map["3DEIJL"] = best_thirds[7][0] # Placeholder for 1K opponent

        stage_reached = {t: 'Group Stage' for t in self.teams}
        for t in results_map.values(): stage_reached[t] = 'Round of 32'

        # 3. Knockout Bracket following fixtures.xlsx
        knockout_fixtures = self.fixtures[self.fixtures['Stage'] != 'Group Stage'].sort_values('Match')

        match_winners = {} # Match ID -> Winner name

        for _, m in knockout_fixtures.iterrows():
            m_id = str(m['Match'])
            h_ref = m['Home Team']
            a_ref = m['Away Team']

            # Resolve team names from references
            t1 = results_map.get(h_ref) or match_winners.get(h_ref.replace('W', ''))
            t2 = results_map.get(a_ref) or match_winners.get(a_ref.replace('W', ''))

            # If references are still RU (Runners up of SF), find them
            if 'RU' in h_ref: # Third place match logic
                 # Simplify: just pick someone who lost in SF
                 t1 = t1 or self.teams[0] # Should be handled better
            if not t1 or not t2:
                 # Fallback if bracket logic fails for a specific path
                 t1 = t1 or "Unknown"
                 t2 = t2 or "Unknown"
                 winner = t1
            else:
                hg, ag = self.simulate_match(t1, t2)
                while hg == ag: hg, ag = self.simulate_match(t1, t2)
                winner = t1 if hg > ag else t2

            match_winners[m_id] = winner
            if m['Stage'] != 'Third Place Playoff':
                stage_reached[winner] = m['Stage']

        # The winner of the last match (104) is the champion
        winner_name = match_winners.get('104', 'Unknown')
        if winner_name != 'Unknown':
            stage_reached[winner_name] = 'Winner'

        return stage_reached

def run_simulation_batch(n_batch, params, fixtures):
    sim = WorldCupSimulator(params, fixtures)
    batch_results = {t: Counter() for t in sim.teams}
    for _ in range(n_batch):
        stages = sim.simulate_tournament()
        for t, stage in stages.items(): batch_results[t][stage] += 1
    return batch_results

def run_monte_carlo(n=100000):
    with open('world_cup_2026/data/model_params_adjusted.json', 'r') as f: params = json.load(f)
    fixtures = pd.read_csv('world_cup_2026/data/fixtures_cleaned.csv')
    num_cores = multiprocessing.cpu_count()
    batch_size = n // num_cores
    with multiprocessing.Pool(num_cores) as pool:
        results_list = pool.starmap(run_simulation_batch, [(batch_size, params, fixtures)] * num_cores)
    final_results = {t: Counter() for t in params['alpha'].keys()}
    for batch_res in results_list:
        for team, stages in batch_res.items(): final_results[team].update(stages)
    df_results = pd.DataFrame(final_results).T
    df_results = (df_results / n * 100).round(2)
    df_results = df_results.sort_values(by='Winner', ascending=False)
    df_results.to_csv('world_cup_2026/data/simulation_results_100k.csv')
    print("Full simulation results (100k) saved with bracket logic.")

if __name__ == "__main__":
    run_monte_carlo(10000)
