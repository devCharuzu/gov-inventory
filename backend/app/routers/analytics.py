"""Analytics routes.

Aggregations are computed with Pandas over data pulled from the database.
Voided transactions are excluded from every calculation.
"""

import uuid
from datetime import datetime, timezone

import pandas as pd
from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Category, Item, Transaction, TransactionType, User
from app.schemas.analytics import (
    CategoryBreakdown,
    StockMovementPoint,
    Summary,
    TopItem,
    TopRequestingUnit,
    TrendPoint,
)
from app.utils.security import get_current_user

router = APIRouter(prefix="/analytics", tags=["analytics"])

_TXN_COLUMNS = [
    "id",
    "transaction_type",
    "item_id",
    "quantity",
    "transaction_date",
]


def _transactions_df(
    db: Session,
    *,
    item_id: uuid.UUID | None = None,
    txn_type: TransactionType | None = None,
    start_date: datetime | None = None,
    end_date: datetime | None = None,
) -> pd.DataFrame:
    """Load non-voided transactions into a DataFrame with optional filters."""
    stmt = select(
        Transaction.id,
        Transaction.transaction_type,
        Transaction.item_id,
        Transaction.quantity,
        Transaction.transaction_date,
    ).where(Transaction.voided.is_(False))
    if item_id is not None:
        stmt = stmt.where(Transaction.item_id == item_id)
    if txn_type is not None:
        stmt = stmt.where(Transaction.transaction_type == txn_type)
    if start_date is not None:
        stmt = stmt.where(Transaction.transaction_date >= start_date)
    if end_date is not None:
        stmt = stmt.where(Transaction.transaction_date <= end_date)

    rows = db.execute(stmt).all()
    df = pd.DataFrame(rows, columns=_TXN_COLUMNS)
    if not df.empty:
        df["transaction_date"] = pd.to_datetime(
            df["transaction_date"], utc=True
        )
        # Normalize the enum to its plain string value for grouping.
        df["transaction_type"] = df["transaction_type"].map(
            lambda t: t.value if isinstance(t, TransactionType) else t
        )
        df["quantity"] = df["quantity"].astype("int64")
    return df


@router.get("/summary", response_model=Summary)
def summary(
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
) -> Summary:
    """Return top-line dashboard counters."""
    now = datetime.now(timezone.utc)
    start_of_day = now.replace(hour=0, minute=0, second=0, microsecond=0)

    total_items = (
        db.query(Item).filter(Item.is_active.is_(True)).count()
    )
    low_stock_count = (
        db.query(Item)
        .filter(
            Item.is_active.is_(True),
            Item.quantity <= Item.minimum_quantity,
        )
        .count()
    )

    today_df = _transactions_df(db, start_date=start_of_day)
    if today_df.empty:
        total_in_today = total_out_today = 0
    else:
        by_type = today_df.groupby("transaction_type")["quantity"].sum()
        total_in_today = int(by_type.get(TransactionType.IN.value, 0))
        total_out_today = int(by_type.get(TransactionType.OUT.value, 0))

    return Summary(
        total_items=total_items,
        total_in_today=total_in_today,
        total_out_today=total_out_today,
        low_stock_count=low_stock_count,
    )


@router.get("/trends", response_model=list[TrendPoint])
def trends(
    period: str = Query("monthly", pattern="^(weekly|monthly|semester)$"),
    year: int | None = None,
    start_date: datetime | None = None,
    end_date: datetime | None = None,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
) -> list[TrendPoint]:
    """Return in/out/net totals grouped into period buckets."""
    if year is not None and start_date is None and end_date is None:
        start_date = datetime(year, 1, 1, tzinfo=timezone.utc)
        end_date = datetime(year, 12, 31, 23, 59, 59, tzinfo=timezone.utc)

    df = _transactions_df(db, start_date=start_date, end_date=end_date)
    if df.empty:
        return []

    df = df.set_index("transaction_date")
    # Pivot quantity by transaction type into in/out columns.
    pivot = (
        df.pivot_table(
            index=df.index,
            columns="transaction_type",
            values="quantity",
            aggfunc="sum",
            fill_value=0,
        )
    )
    for col in (TransactionType.IN.value, TransactionType.OUT.value):
        if col not in pivot.columns:
            pivot[col] = 0

    if period == "weekly":
        grouped = pivot.resample("W")
        labeled = [
            (idx.strftime("%G-W%V"), row) for idx, row in grouped.sum().iterrows()
        ]
    elif period == "monthly":
        grouped = pivot.resample("MS")
        labeled = [
            (idx.strftime("%Y-%m"), row) for idx, row in grouped.sum().iterrows()
        ]
    else:  # semester: two halves of the calendar year
        tmp = pivot.copy()
        tmp["__sem"] = [
            f"{ts.year}-S{1 if ts.month <= 6 else 2}" for ts in tmp.index
        ]
        agg = tmp.groupby("__sem")[
            [TransactionType.IN.value, TransactionType.OUT.value]
        ].sum()
        labeled = [(label, row) for label, row in agg.iterrows()]

    result: list[TrendPoint] = []
    for label, row in labeled:
        total_in = int(row[TransactionType.IN.value])
        total_out = int(row[TransactionType.OUT.value])
        result.append(
            TrendPoint(
                period_label=label,
                total_in=total_in,
                total_out=total_out,
                net=total_in - total_out,
            )
        )
    return result


@router.get("/top-items", response_model=list[TopItem])
def top_items(
    type: TransactionType | None = None,
    limit: int = 10,
    start_date: datetime | None = None,
    end_date: datetime | None = None,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
) -> list[TopItem]:
    """Return items ranked by total transacted quantity."""
    df = _transactions_df(
        db, txn_type=type, start_date=start_date, end_date=end_date
    )
    if df.empty:
        return []

    agg = (
        df.groupby("item_id")
        .agg(total_quantity=("quantity", "sum"), transaction_count=("id", "count"))
        .reset_index()
        .sort_values("total_quantity", ascending=False)
        .head(max(limit, 1))
    )

    item_ids = agg["item_id"].tolist()
    items = {
        i.id: i
        for i in db.query(Item).filter(Item.id.in_(item_ids)).all()
    }
    result: list[TopItem] = []
    for _row in agg.itertuples():
        item = items.get(_row.item_id)
        if not item:
            continue
        result.append(
            TopItem(
                item_id=item.id,
                item_name=item.name,
                item_code=item.code,
                total_quantity=int(_row.total_quantity),
                transaction_count=int(_row.transaction_count),
            )
        )
    return result


@router.get("/top-requesting-units", response_model=list[TopRequestingUnit])
def top_requesting_units(
    year: int | None = None,
    limit: int = 5,
    start_date: datetime | None = None,
    end_date: datetime | None = None,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
) -> list[TopRequestingUnit]:
    """Return units ranked by the number of non-voided OUT requests."""
    use_year_bounds = False
    if year is not None and start_date is None and end_date is None:
        use_year_bounds = True
        start_date = datetime(year, 1, 1, tzinfo=timezone.utc)
        end_date = datetime(year + 1, 1, 1, tzinfo=timezone.utc)

    request_count = func.count(Transaction.id)
    total_quantity = func.coalesce(func.sum(Transaction.quantity), 0)
    stmt = (
        select(
            Transaction.recipient_department,
            request_count,
            total_quantity,
        )
        .where(
            Transaction.transaction_type == TransactionType.OUT,
            Transaction.voided.is_(False),
            Transaction.recipient_department.is_not(None),
            func.trim(Transaction.recipient_department) != "",
        )
    )
    if start_date is not None:
        stmt = stmt.where(Transaction.transaction_date >= start_date)
    if end_date is not None:
        if use_year_bounds:
            stmt = stmt.where(Transaction.transaction_date < end_date)
        else:
            stmt = stmt.where(Transaction.transaction_date <= end_date)

    rows = db.execute(
        stmt.group_by(Transaction.recipient_department)
        .order_by(
            request_count.desc(),
            total_quantity.desc(),
            Transaction.recipient_department.asc(),
        )
        .limit(min(max(limit, 1), 50))
    ).all()
    return [
        TopRequestingUnit(
            unit_name=unit_name,
            request_count=int(count),
            total_quantity=int(quantity),
        )
        for unit_name, count, quantity in rows
    ]


@router.get("/stock-movement", response_model=list[StockMovementPoint])
def stock_movement(
    item_id: uuid.UUID = Query(...),
    start_date: datetime | None = None,
    end_date: datetime | None = None,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
) -> list[StockMovementPoint]:
    """Return daily in/out movement and a running balance for one item."""
    df = _transactions_df(
        db, item_id=item_id, start_date=start_date, end_date=end_date
    )
    if df.empty:
        return []

    df["day"] = df["transaction_date"].dt.date
    df["qty_in"] = df.apply(
        lambda r: r["quantity"]
        if r["transaction_type"] == TransactionType.IN.value
        else 0,
        axis=1,
    )
    df["qty_out"] = df.apply(
        lambda r: r["quantity"]
        if r["transaction_type"] == TransactionType.OUT.value
        else 0,
        axis=1,
    )
    daily = (
        df.groupby("day")[["qty_in", "qty_out"]].sum().sort_index()
    )
    daily["net"] = daily["qty_in"] - daily["qty_out"]
    daily["running_balance"] = daily["net"].cumsum()

    return [
        StockMovementPoint(
            date=day,
            quantity_in=int(row["qty_in"]),
            quantity_out=int(row["qty_out"]),
            running_balance=int(row["running_balance"]),
        )
        for day, row in daily.iterrows()
    ]


@router.get("/category-breakdown", response_model=list[CategoryBreakdown])
def category_breakdown(
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
) -> list[CategoryBreakdown]:
    """Return item counts and transacted totals grouped by category."""
    # Item -> category mapping.
    items = db.query(
        Item.id, Item.category_id
    ).all()
    items_df = pd.DataFrame(items, columns=["item_id", "category_id"])

    txn_df = _transactions_df(db)

    # Category lookup including a synthetic "Uncategorized" bucket.
    categories = {c.id: c.name for c in db.query(Category).all()}

    if items_df.empty:
        return []

    # Aggregate transaction quantities per item/type.
    if txn_df.empty:
        item_totals = pd.DataFrame(
            columns=["item_id", TransactionType.IN.value, TransactionType.OUT.value]
        )
    else:
        item_totals = (
            txn_df.pivot_table(
                index="item_id",
                columns="transaction_type",
                values="quantity",
                aggfunc="sum",
                fill_value=0,
            )
            .reset_index()
        )
    for col in (TransactionType.IN.value, TransactionType.OUT.value):
        if col not in item_totals.columns:
            item_totals[col] = 0

    merged = items_df.merge(item_totals, on="item_id", how="left")
    qty_cols = [TransactionType.IN.value, TransactionType.OUT.value]
    merged[qty_cols] = merged[qty_cols].fillna(0)

    # Group on a string key to avoid sorting a UUID/NaN mix; NULL -> sentinel.
    _UNCAT = "__uncategorized__"
    merged["category_key"] = merged["category_id"].apply(
        lambda x: _UNCAT if pd.isna(x) else str(x)
    )

    result: list[CategoryBreakdown] = []
    for category_key, group in merged.groupby("category_key", sort=False):
        cid = None if category_key == _UNCAT else uuid.UUID(category_key)
        result.append(
            CategoryBreakdown(
                category_id=cid,
                category_name=categories.get(cid, "Uncategorized"),
                item_count=int(group["item_id"].nunique()),
                total_in=int(group[TransactionType.IN.value].sum()),
                total_out=int(group[TransactionType.OUT.value].sum()),
            )
        )
    result.sort(key=lambda r: r.category_name)
    return result
