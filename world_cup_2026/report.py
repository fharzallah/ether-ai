import pandas as pd
import numpy as np

def generate_report():
    # Read simulation results
    try:
        df = pd.read_csv('world_cup_2026/data/simulation_results_100k.csv', index_col=0)
    except FileNotFoundError:
        print("Erreur : Le fichier de résultats est introuvable. Lancez d'abord la simulation.")
        return

    df = df.fillna(0)

    # Internal keys from fixtures.xlsx/simulator
    # 'Group Stage', 'Round of 32', 'Round of 16', 'Quarterfinals', 'Semifinals', 'Final', 'Winner'

    cum_df = pd.DataFrame(index=df.index)

    # Directly use the columns from the simulator since they are now cumulative
    # Ensure we use the correct column names from the CSV
    cum_df['Vainqueur'] = df.get('Winner', 0)
    cum_df['Finale'] = df.get('Final', 0)
    cum_df['Demis'] = df.get('Semifinals', 0)
    cum_df['Quarts'] = df.get('Quarterfinals', 0)
    cum_df['8èmes'] = df.get('Round of 16', 0)
    cum_df['16èmes'] = df.get('Round of 32', 0)

    # Sort columns logic check - we want to ensure Final >= Winner etc.
    # The simulator should have handled this, but we can verify if needed.

    # Reaching Group Stage is 100% for everyone who participated
    cum_df['Groupes'] = 100.0

    html_content = f"""
    <!DOCTYPE html>
    <html lang="fr">
    <head>
        <meta charset="UTF-8">
        <title>Simulation Coupe du Monde 2026 - Prédictions Dixon-Coles</title>
        <style>
            body {{ font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f0f2f5; margin: 0; padding: 20px; }}
            .container {{ max-width: 1100px; margin: auto; background: white; padding: 30px; border-radius: 12px; box-shadow: 0 4px 20px rgba(0,0,0,0.1); }}
            h1 {{ color: #1a73e8; text-align: center; margin-bottom: 10px; }}
            p.subtitle {{ text-align: center; color: #666; margin-bottom: 30px; }}
            table {{ width: 100%; border-collapse: collapse; }}
            th, td {{ padding: 15px; text-align: center; border-bottom: 1px solid #eee; }}
            th {{ background-color: #1a73e8; color: white; position: sticky; top: 0; }}
            tr:hover {{ background-color: #f8f9fa; }}
            .winner-cell {{ font-weight: bold; color: #2e7d32; background-color: #e8f5e9; }}
            .team-name {{ text-align: left; font-weight: 600; color: #333; }}
            .prob-bar {{ height: 8px; background: #e0e0e0; border-radius: 4px; margin-top: 5px; overflow: hidden; }}
            .prob-fill {{ height: 100%; background: #1a73e8; }}
        </style>
    </head>
    <body>
        <div class="container">
            <h1>Simulation Coupe du Monde 2026</h1>
            <p class="subtitle">Modèle Dixon-Coles (Time-Decay) + Statistiques Individuelles Joueurs<br>100 000 itérations Monte Carlo</p>

            <table>
                <thead>
                    <tr>
                        <th style="text-align: left;">Équipe</th>
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

    # Sort by winner probability
    cum_df = cum_df.sort_values(by='Vainqueur', ascending=False)

    for team, row in cum_df.iterrows():
        html_content += f"""
                    <tr>
                        <td class="team-name">{team}</td>
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
