import pandas as pd
import numpy as np
import json

def generate_report():
    try:
        df = pd.read_csv('world_cup_2026/data/simulation_results_100k.csv', index_col=0)
    except FileNotFoundError:
        print("Erreur : Le fichier de résultats est introuvable.")
        return

    with open('world_cup_2026/data/model_params_adjusted.json', 'r') as f:
        params = json.load(f)

    styles = params.get('styles', {})
    df = df.fillna(0)

    cum_df = pd.DataFrame(index=df.index)
    cum_df['Vainqueur'] = df.get('Winner', 0)
    cum_df['Finale'] = df.get('Final', 0)
    cum_df['Demis'] = df.get('Semifinals', 0)
    cum_df['Quarts'] = df.get('Quarterfinals', 0)
    cum_df['8èmes'] = df.get('Round of 16', 0)
    cum_df['16èmes'] = df.get('Round of 32', 0)

    html_content = f"""
    <!DOCTYPE html>
    <html lang="fr">
    <head>
        <meta charset="UTF-8">
        <title>Simulation Coupe du Monde 2026 - Opta-Style Predictions</title>
        <style>
            body {{ font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f0f2f5; margin: 0; padding: 20px; }}
            .container {{ max-width: 1200px; margin: auto; background: white; padding: 30px; border-radius: 12px; box-shadow: 0 4px 20px rgba(0,0,0,0.1); }}
            h1 {{ color: #1a73e8; text-align: center; margin-bottom: 10px; }}
            p.subtitle {{ text-align: center; color: #666; margin-bottom: 30px; }}
            table {{ width: 100%; border-collapse: collapse; }}
            th, td {{ padding: 12px; text-align: center; border-bottom: 1px solid #eee; }}
            th {{ background-color: #1a73e8; color: white; position: sticky; top: 0; }}
            tr:hover {{ background-color: #f8f9fa; }}
            .winner-cell {{ font-weight: bold; color: #2e7d32; background-color: #e8f5e9; }}
            .team-name {{ text-align: left; font-weight: 600; color: #333; }}
            .style-tag {{ font-size: 0.8em; color: #777; font-weight: normal; display: block; }}
            .prob-bar {{ height: 8px; background: #e0e0e0; border-radius: 4px; margin-top: 5px; overflow: hidden; }}
            .prob-fill {{ height: 100%; background: #1a73e8; }}
        </style>
    </head>
    <body>
        <div class="container">
            <h1>Simulation Coupe du Monde 2026 - V4 (Opta Engine)</h1>
            <p class="subtitle">Modèle Dixon-Coles + xG/xGA (40%) + Forme Joueurs (30%) + Style & Prestige (30%)<br>Calculé sur les données StatsBomb (2022-2024)</p>

            <table>
                <thead>
                    <tr>
                        <th style="text-align: left;">Équipe & Style</th>
                        <th>Atteint 16èmes</th>
                        <th>Atteint 8èmes</th>
                        <th>Atteint Quarts</th>
                        <th>Atteint Demis</th>
                        <th>Atteint Finale</th>
                        <th class="winner-cell">Vainqueur</th>
                    </tr>
                </thead>
                <tbody>
    """

    cum_df = cum_df.sort_values(by='Vainqueur', ascending=False)

    for team, row in cum_df.iterrows():
        style = styles.get(team, {'possession': 50, 'def_height': 40})
        pos = style['possession']
        height = style['def_height']

        style_desc = "Standard"
        if pos > 55: style_desc = "Possession"
        elif pos < 45: style_desc = "Contre-attaque"

        if height > 55: style_desc += " / Ligne Haute"
        elif height < 35: style_desc += " / Bloc Bas"

        html_content += f"""
                    <tr>
                        <td class="team-name">
                            {team}
                            <span class="style-tag">{style_desc} (Poss: {pos:.1f}%)</span>
                        </td>
                        <td>{row['16èmes']:.1f}%</td>
                        <td>{row['8èmes']:.1f}%</td>
                        <td>{row['Quarts']:.1f}%</td>
                        <td>{row['Demis']:.1f}%</td>
                        <td>{row['Finale']:.1f}%</td>
                        <td class="winner-cell">
                            {row['Vainqueur']:.1f}%
                            <div class="prob-bar"><div class="prob-fill" style="width: {row['Vainqueur']}%"></div></div>
                        </td>
                    </tr>
        """

    html_content += """
                </tbody>
            </table>
        </div>
    </body>
    </html>
    """

    with open('world_cup_2026/prediction_report.html', 'w', encoding='utf-8') as f:
        f.write(html_content)
    print("HTML report updated: world_cup_2026/prediction_report.html")

if __name__ == "__main__":
    generate_report()
