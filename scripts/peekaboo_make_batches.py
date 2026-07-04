"""Split peekaboo export into MCP-sized SQL batch files."""

import json
from pathlib import Path

BATCH = 35


def esc(value: str | None) -> str:
    if value is None:
        return "NULL"
    return "'" + str(value).replace("'", "''") + "'"


def insert_sql(o: dict) -> str:
    return (
        "INSERT INTO special_offers (restaurant_id, title, description, discount_percent, "
        "valid_from, valid_until, is_active, source, card_name, bank_name, peekaboo_deal_id, "
        "peekaboo_entity_id, terms) VALUES ("
        f"{esc(o['restaurant_id'])}, {esc(o['title'])}, {esc(o.get('description'))}, "
        f"{o['discount_percent'] if o.get('discount_percent') is not None else 'NULL'}, "
        f"{esc(o.get('valid_from'))}, {esc(o.get('valid_until'))}, "
        "true, 'peekaboo', "
        f"{esc(o.get('card_name'))}, {esc(o.get('bank_name'))}, "
        f"{esc(o['peekaboo_deal_id'])}, {o['peekaboo_entity_id']}, {esc(o.get('description'))}"
        ") ON CONFLICT (restaurant_id, peekaboo_deal_id) WHERE peekaboo_deal_id IS NOT NULL "
        "DO UPDATE SET title = EXCLUDED.title, description = EXCLUDED.description, "
        "discount_percent = EXCLUDED.discount_percent, valid_from = EXCLUDED.valid_from, "
        "valid_until = EXCLUDED.valid_until, is_active = true, card_name = EXCLUDED.card_name, "
        "bank_name = EXCLUDED.bank_name, terms = EXCLUDED.terms;"
    )


def main() -> None:
    offers = json.loads(
        (Path(__file__).parent.parent / "data" / "peekaboo_offers_export.json").read_text(encoding="utf-8")
    )
    out = Path(__file__).parent.parent / "data" / "peekaboo_batches"
    out.mkdir(exist_ok=True)

    seen: set[tuple[str, int]] = set()
    entity_sql: list[str] = []
    for o in offers:
        key = (o["restaurant_id"], o["peekaboo_entity_id"])
        if key not in seen:
            seen.add(key)
            entity_sql.append(
                f"UPDATE restaurants SET peekaboo_entity_id = {o['peekaboo_entity_id']} "
                f"WHERE id = '{o['restaurant_id']}';"
            )
    (out / "00_entities.sql").write_text("\n".join(entity_sql), encoding="utf-8")

    for i in range(0, len(offers), BATCH):
        chunk = offers[i : i + BATCH]
        sql = "\n".join(insert_sql(o) for o in chunk)
        (out / f"batch_{i // BATCH + 1:02d}.sql").write_text(sql, encoding="utf-8")

    print(f"Wrote {len(entity_sql)} entity updates and {(len(offers) + BATCH - 1) // BATCH} offer batches ({len(offers)} offers)")


if __name__ == "__main__":
    main()
