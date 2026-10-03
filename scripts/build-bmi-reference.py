"""Generate all CDC 2000 BMI-for-age month bins (ages 2 to under 20)."""
import csv
import json
from pathlib import Path

root = Path(__file__).resolve().parents[1]
source = root / 'src/features/health/data/bmiagerev.csv'
target = root / 'src/features/health/cdc-bmi.json'
with source.open(newline='') as handle:
    rows = [
        {'sex': int(r['Sex']), 'month': float(r['Agemos']),
         'p5': float(r['P5']), 'p85': float(r['P85']), 'p95': float(r['P95'])}
        for r in csv.DictReader(handle)
        if r['Agemos'] != 'Agemos' and 24 <= float(r['Agemos']) < 240 and float(r['Agemos']) % 1 == .5
    ]
assert len(rows) == 432
assert all(sum(r['sex'] == sex for r in rows) == 216 for sex in (1, 2))
target.write_text(json.dumps(rows, indent=2) + '\n')
print(f'{target.name}: {len(rows)} rows, ages 2–19')
