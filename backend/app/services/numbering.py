"""Concurrency-safe human-readable number allocation."""

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import NumberCounter


def next_number(db: Session, key: str, *, initial: int = 1) -> int:
    """Atomically reserve the next number for ``key``.

    PostgreSQL uses an upsert so two Vercel workers cannot receive the same
    value. SQLite keeps the local development path compatible with a row lock.
    The caller remains responsible for committing the surrounding transaction.
    """
    dialect = db.get_bind().dialect.name
    if dialect == "postgresql":
        from sqlalchemy.dialects.postgresql import insert

        region_id = db.info.get("region_id")
        if region_id is None:
            raise RuntimeError("A regional context is required for numbering")
        statement = (
            insert(NumberCounter)
            .values(region_id=region_id, key=key, next_value=initial + 1)
            .on_conflict_do_update(
                index_elements=[NumberCounter.region_id, NumberCounter.key],
                set_={"next_value": NumberCounter.next_value + 1},
            )
            .returning(NumberCounter.next_value)
        )
        stored_next = db.execute(statement).scalar_one()
        return int(stored_next) - 1

    counter = db.execute(
        select(NumberCounter)
        .where(NumberCounter.key == key)
        .with_for_update()
    ).scalar_one_or_none()
    if counter is None:
        counter = NumberCounter(key=key, next_value=initial + 1)
        db.add(counter)
        db.flush()
        return initial

    value = counter.next_value
    counter.next_value += 1
    db.flush()
    return value


def next_item_code(db: Session) -> str:
    """Reserve the next inventory code, e.g. ``ITM-0001``."""
    return f"ITM-{next_number(db, 'item_code'):04d}"
