import pandas as pd

def generate_report():
    df = pd.read_csv('world_cup_2026/data/simulation_results_100k.csv', index_col=0)
    html_content = f"""
    <!DOCTYPE html>
    <html lang="fr">
    <head>
        <meta charset="UTF-8">
        <title>Simulation Coupe du Monde 2026 - Prédictions Dixon-Coles</title>
        <style>
            body {{ font-family: Arial, sans-serif; background-color: #f4f4f9; margin: 0; padding: 20px; }}
            h1, h2 {{ color: #333; text-align: center; }}
            table {{ width: 100%; border-collapse: collapse; margin-top: 20px; background: white; }}
            th, td {{ border: 1px solid #ddd; padding: 12px; text-align: center; }}
            th {{ background-color: #007bff; color: white; }}
            tr:nth-child(even) {{ background-color: #f2f2f2; }}
            tr:hover {{ background-color: #ddd; }}
            .winner {{ font-weight: bold; color: #28a745; }}
            .container {{ max-width: 1200px; margin: auto; }}
        </style>
    </head>
    <body>
        <div class="container">
            <h1>Simulation Coupe du Monde 2026</h1>
            <p style="text-align: center;">Basée sur 100 000 itérations du modèle Dixon-Coles avec ajustements individuels des joueurs.</p>
            <h2>Probabilités par Équipe (%)</h2>
            <table>
                <thead>
                    <tr>
                        <th>Équipe</th>
                        <th>Phase de Groupes</th>
                        <th>16èmes</th>
                        <th>8èmes</th>
                        <th>Quarts</th>
                        <th>Demis</th>
                        <th>Finale</th>
                        <th class="winner">Vainqueur</th>
                    </tr>
                </thead>
                <tbody>
    """
    for team, row in df.iterrows():
        html_content += f"""
                    <tr>
                        <td>{team}</td>
                        <td>{row.get('Group Stage', 0):.2f}%</td>
                        <td>{row.get('Round of 32', 0):.2f}%</td>
                        <td>{row.get('Round of 16', 0):.2f}%</td>
                        <td>{row.get('Quarter-finals', 0):.2f}%</td>
                        <td>{row.get('Semi-finals', 0):.2f}%</td>
                        <td>{row.get('Final', 0):.2f}%</td>
                        <td class="winner">{row.get('Winner', 0):.2f}%</td>
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
    print("HTML report generated: world_cup_2026/prediction_report.html")

if __name__ == "__main__":
    generate_report()
