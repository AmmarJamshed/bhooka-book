"""Generate single SQL file for all Karachi restaurants."""

import json
from pathlib import Path

from load_karachi_sql import BATCH_SIZE, build_batch

DATA = Path(__file__).parent.parent / "data" / "karachi_restaurants.json"
OUT = Path(__file__).parent.parent / "data" / "import_karachi.sql"

data = json.loads(DATA.read_text(encoding="utf-8"))
batches = [data[i : i + BATCH_SIZE] for i in range(0, len(data), BATCH_SIZE)]
sql = "\n\n".join(build_batch(b) for b in batches)
OUT.write_text(sql, encoding="utf-8")
print(f"Wrote {len(data)} restaurants in {len(batches)} statements to {OUT} ({OUT.stat().st_size} bytes)")
