from statsbombpy import sb
import pandas as pd
import numpy as np
import os

def get_advanced_stats(competition_id, season_id, label):
    print(f"Fetching matches for {label}...")
    matches = sb.matches(competition_id=competition_id, season_id=season_id)
    team_stats = []

    total = len(matches)
    for i, match_id in enumerate(matches['match_id']):
        if i % 10 == 0:
            print(f"Processing match {i}/{total} (ID: {match_id})...")

        try:
            events = sb.events(match_id=match_id)

            match_info = matches[matches['match_id'] == match_id].iloc[0]
            home = match_info['home_team']
            away = match_info['away_team']

            # 1. xG
            xg_home, xg_away = 0, 0
            if 'type' in events.columns and 'shot_statsbomb_xg' in events.columns:
                shots = events[events['type'] == 'Shot'].copy()
                match_xg = shots.groupby('team')['shot_statsbomb_xg'].sum()
                xg_home = match_xg.get(home, 0)
                xg_away = match_xg.get(away, 0)

            # 2. Possession (Pass share)
            pos_home, pos_away = 50, 50
            if 'type' in events.columns:
                passes = events[events['type'] == 'Pass']
                pass_counts = passes.groupby('team').size()
                total_passes = pass_counts.sum()
                if total_passes > 0:
                    pos_home = (pass_counts.get(home, 0) / total_passes) * 100
                    pos_away = (pass_counts.get(away, 0) / total_passes) * 100

            # 3. Pressing (Defensive Action Height)
            # Proxy: Mean 'x' coordinate of defensive actions
            def_home, def_away = 40, 40 # Default mid-block
            if 'type' in events.columns and 'location' in events.columns:
                def_actions = events[events['type'].isin(['Interception', 'Tackle', 'Pressure', 'Foul Committed'])]
                def_actions = def_actions.dropna(subset=['location'])
                def_actions['x'] = def_actions['location'].apply(lambda l: l[0])

                match_def = def_actions.groupby('team')['x'].mean()
                def_home = match_def.get(home, 40)
                def_away = match_def.get(away, 40)

            team_stats.append({'team': home, 'match_id': match_id, 'xg': xg_home, 'xga': xg_away, 'possession': pos_home, 'def_height': def_home})
            team_stats.append({'team': away, 'match_id': match_id, 'xg': xg_away, 'xga': xg_home, 'possession': pos_away, 'def_height': def_away})

        except Exception as e:
            print(f"Error in match {match_id}: {e}")

    df = pd.DataFrame(team_stats)
    if df.empty:
        return pd.DataFrame()

    summary = df.groupby('team').agg({
        'xg': 'mean',
        'xga': 'mean',
        'possession': 'mean',
        'def_height': 'mean',
        'match_id': 'count'
    }).rename(columns={'xg': 'avg_xg', 'xga': 'avg_xga', 'match_id': 'games'})

    return summary

if __name__ == "__main__":
    os.makedirs('world_cup_2026/data', exist_ok=True)

    configs = [
        (43, 106, "WC 2022", "wc2022_advanced.csv"),
        (55, 282, "Euro 2024", "euro2024_advanced.csv"),
        (1267, 107, "AFCON 2023", "afcon2023_advanced.csv"),
        (223, 282, "Copa America 2024", "copa2024_advanced.csv")
    ]

    all_summaries = []

    for c_id, s_id, label, filename in configs:
        try:
            print(f"\n--- {label} ---")
            summary = get_advanced_stats(c_id, s_id, label)
            if not summary.empty:
                summary.to_csv(f'world_cup_2026/data/{filename}')
                summary['competition'] = label
                all_summaries.append(summary.reset_index())
                print(f"Saved {label} stats.")
        except Exception as e:
            print(f"Error {label}: {e}")

    if all_summaries:
        combined = pd.concat(all_summaries)
        final_summary = combined.groupby('team').agg({
            'avg_xg': 'mean',
            'avg_xga': 'mean',
            'possession': 'mean',
            'def_height': 'mean',
            'games': 'sum'
        })
        final_summary.to_csv('world_cup_2026/data/advanced_stats_combined.csv')
        print("\nCombined advanced stats saved to world_cup_2026/data/advanced_stats_combined.csv")
