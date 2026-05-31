import pandas as pd
import numpy as np
import json
from collections import Counter
import multiprocessing
import os
import sys

# Add current directory to path to allow imports
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from world_cup_2026.simulator_parallel import WorldCupSimulator

def run_test_simulation(n=100):
    print(f"Running quick test simulation with {n} iterations...")
    with open('world_cup_2026/data/model_params_adjusted.json', 'r') as f:
        params = json.load(f)
    fixtures = pd.read_csv('world_cup_2026/data/fixtures_cleaned.csv')

    sim = WorldCupSimulator(params, fixtures)
    final_results = {t: Counter() for t in params['alpha'].keys()}

    for _ in range(n):
        stages = sim.simulate_tournament()
        for t, stage in stages.items():
            final_results[t][stage] += 1

    df_results = pd.DataFrame(final_results).T
    df_results = (df_results / n * 100).round(2)
    df_results = df_results.sort_values(by='Winner', ascending=False)

    df_results.to_csv('world_cup_2026/data/simulation_results_test.csv')
    print("Test simulation results saved.")

if __name__ == "__main__":
    run_test_simulation()
