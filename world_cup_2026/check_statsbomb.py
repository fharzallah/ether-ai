from statsbombpy import sb
import pandas as pd

def check_available_data():
    comps = sb.competitions()
    wc_euros = comps[comps['competition_name'].isin(['FIFA World Cup', 'UEFA Euro'])]
    print(wc_euros[['competition_id', 'season_id', 'competition_name', 'season_name']])

if __name__ == "__main__":
    check_available_data()
