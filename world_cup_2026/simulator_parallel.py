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
        for group in group_matches_fixtures['Group / Knockout'].unique():
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

        results_map = {}
        thirds_stats = []
        for g in sorted(group_standings.keys()):
            gid = g.split()[-1]
            results_map[f"1{gid}"] = group_standings[g][0]
            results_map[f"2{gid}"] = group_standings[g][1]
            t3 = group_standings[g][2]
            thirds_stats.append((t3, all_stats[t3]['pts'], all_stats[t3]['gd'], all_stats[t3]['gs']))

        best_thirds = sorted(thirds_stats, key=lambda x: (x[1], x[2], x[3]), reverse=True)[:8]
        results_map["3ABCDF"] = best_thirds[0][0]
        results_map["3CDFGH"] = best_thirds[1][0]
        results_map["3CEFHI"] = best_thirds[2][0]
        results_map["3EHIJK"] = best_thirds[3][0]
        results_map["3AEHIJ"] = best_thirds[4][0]
        results_map["3BEFIJ"] = best_thirds[5][0]
        results_map["3EFGIJ"] = best_thirds[6][0]
        results_map["3DEIJL"] = best_thirds[7][0]

        # Cumulative stages reached
        stages_reached = {t: {'Group Stage'} for t in self.teams}
        for t in results_map.values():
            if t in stages_reached:
                stages_reached[t].add('Round of 32')

        knockout_fixtures = self.fixtures[self.fixtures['Stage'] != 'Group Stage'].sort_values('Match')
        match_winners = {}
        match_losers = {}

        stage_map = {
            'Round of 32': 'Round of 16',
            'Round of 16': 'Quarterfinals',
            'Quarterfinals': 'Semifinals',
            'Semifinals': 'Final',
            'Final': 'Winner'
        }

        for _, m in knockout_fixtures.iterrows():
            m_id = str(int(m['Match']))
            h_ref = str(m['Home Team'])
            a_ref = str(m['Away Team'])

            # Resolve team references
            def resolve(ref):
                if ref in results_map: return results_map[ref]
                if ref.startswith('W'): return match_winners.get(ref[1:])
                if ref.startswith('RU'): return match_losers.get(ref[2:])
                return match_winners.get(ref) # Fallback

            t1 = resolve(h_ref)
            t2 = resolve(a_ref)

            if not t1 or not t2:
                 winner = t1 or t2 or self.teams[0]
                 loser = t2 if winner == t1 else t1
            else:
                hg, ag = self.simulate_match(t1, t2)
                while hg == ag: hg, ag = self.simulate_match(t1, t2)
                if hg > ag:
                    winner, loser = t1, t2
                else:
                    winner, loser = t2, t1

            match_winners[m_id] = winner
            match_losers[m_id] = loser

            reached = stage_map.get(m['Stage'])
            if reached and winner in stages_reached:
                stages_reached[winner].add(reached)

        return stages_reached

def run_simulation_batch(n_batch, params, fixtures):
    sim = WorldCupSimulator(params, fixtures)
    batch_results = {t: Counter() for t in sim.teams}
    for _ in range(n_batch):
        all_reached = sim.simulate_tournament()
        for t, stages in all_reached.items():
            for s in stages:
                batch_results[t][s] += 1
    return batch_results

def run_monte_carlo(n=100000):
    with open('world_cup_2026/data/model_params_adjusted.json', 'r') as f: params = json.load(f)
    fixtures = pd.read_csv('world_cup_2026/data/fixtures_cleaned.csv')
    num_cores = multiprocessing.cpu_count()
    batch_size = max(1, n // num_cores)
    total_sims = batch_size * num_cores
    with multiprocessing.Pool(num_cores) as pool:
        results_list = pool.starmap(run_simulation_batch, [(batch_size, params, fixtures)] * num_cores)
    final_results = {t: Counter() for t in params['alpha'].keys()}
    for batch_res in results_list:
        for team, stages in batch_res.items(): final_results[team].update(stages)
    df_results = pd.DataFrame(final_results).T
    df_results = (df_results / total_sims * 100).round(2)
    df_results = df_results.sort_values(by='Winner', ascending=False)
    df_results.to_csv('world_cup_2026/data/simulation_results_100k.csv')
    print(f"Full simulation results ({total_sims}) saved with corrected stage logic.")

if __name__ == "__main__":
    run_monte_carlo(100000)
