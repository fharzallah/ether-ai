import unittest
import numpy as np
import json
import os
import pandas as pd
import sys

# Add current directory to path to allow imports
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from world_cup_2026.simulator_parallel import WorldCupSimulator

class TestWorldCupLogic(unittest.TestCase):

    @classmethod
    def setUpClass(cls):
        # Create a dummy params for testing
        cls.test_params = {
            'alpha': {'France': 1.5, 'Brazil': 1.4, 'Japan': 0.8, 'Ecuador': 0.7},
            'beta': {'France': -1.2, 'Brazil': -1.1, 'Japan': -0.5, 'Ecuador': -0.4},
            'gamma': 0.0,
            'rho': -0.05
        }

        # Create a dummy fixtures file
        data = {
            'Match': [1, 2],
            'Home Team': ['France', 'Japan'],
            'Away Team': ['Brazil', 'Ecuador'],
            'Stage': ['Group Stage', 'Group Stage'],
            'Group / Knockout': ['Group A', 'Group A']
        }
        cls.fixtures_df = pd.DataFrame(data)

        cls.sim = WorldCupSimulator(cls.test_params, cls.fixtures_df)

    def test_match_simulation(self):
        h, a = self.sim.simulate_match('France', 'Brazil')
        self.assertIsInstance(h, (int, np.integer))
        self.assertIsInstance(a, (int, np.integer))
        self.assertGreaterEqual(h, 0)
        self.assertGreaterEqual(a, 0)

    def test_tournament_logic_small(self):
        # We need to mock more teams if we want to run a full tournament
        # But we can at least test simulate_match multiple times
        for _ in range(10):
            h, a = self.sim.simulate_match('Japan', 'Ecuador')
            self.assertGreaterEqual(h, 0)
            self.assertGreaterEqual(a, 0)

if __name__ == '__main__':
    unittest.main()
