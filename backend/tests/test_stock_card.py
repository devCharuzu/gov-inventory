"""Isolated regression checks; all database writes use an in-memory fixture."""

import unittest
import uuid
from datetime import datetime, timezone
from unittest.mock import patch

from fastapi import HTTPException
from pydantic import ValidationError
from sqlalchemy import create_engine
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

# Register the same regional scoping hooks used by application requests.
from app import database  # noqa: F401
from app.models import Base, Item, Region, ReportDocument, Transaction, TransactionType, User
from app.routers.transactions import hard_delete_transaction, list_transactions, stock_in, stock_out
from app.schemas.transaction import StockInCreate, StockOutCreate
from app.services.pdf_service import _env, _weasyprint_html, TEMPLATES_DIR
from app.services.report_files import _safe_name, get_report, save_transaction_report
from app.services.stock_card import build_stock_card


def date(day):
    return datetime(2026, 6, day, tzinfo=timezone.utc)


class StockCardTests(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine("sqlite://")
        Base.metadata.create_all(self.engine)
        self.db = Session(self.engine)
        self.region = Region(code="XIII", name="Regional Office XIII", admin_username="test-admin")
        self.db.add(self.region)
        self.db.flush()
        self.db.info["region_id"] = self.region.id
        self.user = User(username="test-admin", full_name="Test Admin", email="test@example.invalid", hashed_password="unused")
        self.item = Item(code="ITM-0001", name="Bondpaper (Long, 80 gsm)", unit="Ream", quantity=53, minimum_quantity=10)
        self.db.add_all([self.user, self.item])
        self.db.commit()

    def tearDown(self):
        self.db.close()
        self.engine.dispose()

    def movement(self, day, kind, quantity, *, voided=False, reference=None):
        txn = Transaction(
            item_id=self.item.id,
            created_by=self.user.id,
            transaction_type=kind,
            quantity=quantity,
            transaction_date=date(day),
            reference_number=reference or f"{kind.value}-{day}-{uuid.uuid4().hex[:6]}",
            recipient_department="Admin Unit" if kind == TransactionType.OUT else None,
            voided=voided,
        )
        if not voided:
            self.item.quantity += quantity if kind == TransactionType.IN else -quantity
        self.db.add(txn)
        self.db.commit()
        return txn

    def ledger(self):
        self.movement(1, TransactionType.OUT, 2)
        self.movement(2, TransactionType.OUT, 1)
        self.movement(3, TransactionType.IN, 15, reference="PO-2026-06-0059")

    def test_receipts_and_issues_reconcile_to_current_stock(self):
        self.ledger()
        card = build_stock_card(self.db, self.item.id)
        self.assertEqual(card["opening_balance"], 53)
        self.assertEqual([r["balance"] for r in card["rows"]], [51, 50, 65])
        self.assertEqual(card["closing_balance"], self.item.quantity)
        self.assertEqual([r["reference"] for r in card["rows"]], ["", "", "PO-2026-06-0059"])
        self.assertEqual(card["rows"][0]["office"], "Admin Unit")
        self.assertEqual(card["rows"][2]["receipt"], 15)

    def test_date_filter_carries_earlier_stock_and_excludes_later_receipts(self):
        self.ledger()
        card = build_stock_card(self.db, self.item.id, start_date=date(2), end_date=date(2))
        self.assertEqual(card["opening_balance"], 51)
        self.assertEqual([r["balance"] for r in card["rows"]], [50])
        self.assertEqual(card["closing_balance"], 50)

    def test_empty_range_has_the_correct_carried_balance(self):
        self.ledger()
        before = build_stock_card(self.db, self.item.id, end_date=date(1).replace(month=5))
        after = build_stock_card(self.db, self.item.id, start_date=date(10))
        self.assertEqual((before["opening_balance"], before["closing_balance"], before["rows"]), (None, None, []))
        self.assertEqual((after["opening_balance"], after["closing_balance"], after["rows"]), (None, None, []))

    def test_initial_stock_without_transactions(self):
        card = build_stock_card(self.db, self.item.id)
        self.assertEqual((card["opening_balance"], card["closing_balance"]), (None, None))
        self.assertEqual(card["rows"], [])
        self.assertEqual(card["blank_rows"], 32)

    def test_voided_transactions_do_not_change_card(self):
        self.ledger()
        self.movement(4, TransactionType.OUT, 30, voided=True)
        card = build_stock_card(self.db, self.item.id)
        self.assertEqual(len(card["rows"]), 3)
        self.assertEqual(card["closing_balance"], 65)

    def test_backdated_receipt_is_replayed_in_transaction_date_order(self):
        self.movement(3, TransactionType.OUT, 2)
        self.movement(1, TransactionType.IN, 15)
        card = build_stock_card(self.db, self.item.id)
        self.assertEqual([r["balance"] for r in card["rows"]], [68, 66])

    def test_other_region_cannot_read_item(self):
        self.db.info["region_id"] = uuid.uuid4()
        with self.assertRaises(HTTPException) as result:
            build_stock_card(self.db, self.item.id)
        self.assertEqual(result.exception.status_code, 404)

    def test_invalid_date_range_is_rejected(self):
        with self.assertRaises(HTTPException) as result:
            build_stock_card(self.db, self.item.id, start_date=date(3), end_date=date(1))
        self.assertEqual(result.exception.status_code, 422)

    @patch("app.routers.transactions.save_transaction_report")
    def test_duplicate_batch_reference_is_allowed_and_increases_stock(self, _save_pdf):
        payload = StockInCreate(item_id=self.item.id, reference_number="  PO-2026-06-0059  ", quantity=15)
        txn = stock_in(payload, request=None, current_user=self.user, db=self.db)
        self.assertEqual(txn.reference_number, "PO-2026-06-0059")
        self.assertEqual(self.item.quantity, 68)
        duplicate = stock_in(payload, request=None, current_user=self.user, db=self.db)
        self.assertEqual(duplicate.reference_number, "PO-2026-06-0059")
        self.assertEqual(self.item.quantity, 83)
        self.assertEqual(self.db.query(Transaction).count(), 2)

    @patch("app.routers.transactions.save_transaction_report")
    def test_reference_is_optional(self, _save_pdf):
        payload = StockInCreate(item_id=self.item.id, quantity=2)
        txn = stock_in(payload, request=None, current_user=self.user, db=self.db)
        self.assertIsNone(txn.reference_number)
        self.assertEqual(self.item.quantity, 55)
        self.assertIsNone(
            StockInCreate(
                item_id=self.item.id, quantity=1, reference_number="  "
            ).reference_number
        )

    def test_reference_validation(self):
        for reference in ["a" * 51, "PO\n123", "REL-2026-0001"]:
            with self.subTest(reference=reference), self.assertRaises(ValidationError):
                StockInCreate(item_id=self.item.id, quantity=1, reference_number=reference)

    @patch("app.routers.transactions.save_transaction_report")
    def test_blank_reference_stays_blank_on_stock_card(self, _save_pdf):
        stock_in(StockInCreate(item_id=self.item.id, quantity=2), request=None, current_user=self.user, db=self.db)
        card = build_stock_card(self.db, self.item.id)
        self.assertEqual(card["rows"][0]["reference"], "")
        self.assertEqual(card["rows"][0]["receipt"], 2)
        self.assertEqual(card["closing_balance"], 55)

    def test_reference_lookup_is_exact_and_scoped_to_region(self):
        first = self.movement(1, TransactionType.IN, 2, reference="BATCH-1")
        second = self.movement(2, TransactionType.IN, 3, reference="BATCH-1")
        self.movement(3, TransactionType.IN, 1, reference="BATCH-10")
        result = list_transactions(type=TransactionType.IN, reference_number=" BATCH-1 ", db=self.db)
        self.assertEqual({t.id for t in result.items}, {first.id, second.id})
        self.db.info["region_id"] = uuid.uuid4()
        self.assertEqual(list_transactions(reference_number="BATCH-1", db=self.db).total, 0)

    def test_transaction_date_range_includes_both_days_and_combines_filters(self):
        times = ["2026-06-01T15:59:59.999+00:00", "2026-06-01T16:00:00+00:00",
                 "2026-06-02T15:59:59.999+00:00", "2026-06-02T16:00:00+00:00"]
        txns = []
        for i, value in enumerate(times):
            txn = self.movement(i + 1, TransactionType.IN, 1)
            txn.transaction_date = datetime.fromisoformat(value)
            txns.append(txn)
        self.db.commit()
        start = datetime.fromisoformat("2026-06-02T00:00:00+08:00")
        end = datetime.fromisoformat("2026-06-02T23:59:59.999+08:00")
        result = list_transactions(start_date=start, end_date=end, type=TransactionType.IN,
                                   item_id=self.item.id, size=1, db=self.db)
        self.assertEqual(result.total, 2)
        self.assertEqual([t.id for t in result.items], [txns[2].id])
        result = list_transactions(start_date=start, end_date=end, page=2, size=1, db=self.db)
        self.assertEqual([t.id for t in result.items], [txns[1].id])
        self.assertEqual(list_transactions(start_date=start, db=self.db).total, 3)
        self.assertEqual(list_transactions(end_date=end, db=self.db).total, 3)
        with self.assertRaises(HTTPException) as error:
            list_transactions(start_date=end, end_date=start, db=self.db)
        self.assertEqual(error.exception.status_code, 422)

    @patch("app.services.report_files.build_transaction_pdf", return_value=b"test PDF")
    def test_shared_reference_reports_remain_separate_and_legacy_is_preserved(self, _pdf):
        original = self.movement(1, TransactionType.IN, 2, reference="BATCH-1")
        original.created_at = date(1)
        duplicate = self.movement(2, TransactionType.IN, 3, reference="BATCH-1")
        duplicate.created_at = date(2)
        legacy_name = _safe_name("BATCH-1")
        self.db.add(ReportDocument(name=legacy_name, content=b"legacy", size=6))
        self.db.commit()
        duplicate_name = save_transaction_report(self.db, duplicate)
        self.assertIsNotNone(duplicate_name)
        self.assertIsNotNone(get_report(self.db, legacy_name))
        hard_delete_transaction(duplicate.id, request=None, current_user=self.user, db=self.db)
        self.assertIsNone(get_report(self.db, duplicate_name))
        self.assertIsNotNone(get_report(self.db, legacy_name))
        self.assertEqual(self.item.quantity, 55)
        original_name = save_transaction_report(self.db, original)
        self.assertIsNotNone(get_report(self.db, original_name))
        self.assertIsNone(get_report(self.db, legacy_name))
        self.assertEqual(save_transaction_report(self.db, original), original_name)
        self.assertEqual(self.db.query(ReportDocument).count(), 1)

    @patch("app.services.report_files.build_transaction_pdf", return_value=b"test PDF")
    def test_two_batch_receipts_and_blank_receipts_have_distinct_reports(self, _pdf):
        first = self.movement(1, TransactionType.IN, 2, reference="BATCH-1")
        second = self.movement(2, TransactionType.IN, 3, reference="BATCH-1")
        third = self.movement(3, TransactionType.IN, 1)
        third.reference_number = None
        fourth = self.movement(4, TransactionType.IN, 1)
        fourth.reference_number = None
        self.db.commit()
        names = [save_transaction_report(self.db, txn) for txn in [first, second, third, fourth]]
        self.assertNotIn(None, names)
        self.assertEqual(len(set(names)), 4)
        hard_delete_transaction(first.id, request=None, current_user=self.user, db=self.db)
        self.assertIsNone(get_report(self.db, names[0]))
        for name in names[1:]:
            self.assertIsNotNone(get_report(self.db, name))

    def test_stock_out_references_remain_unique(self):
        self.movement(1, TransactionType.OUT, 1, reference="REL-2026-0001")
        duplicate = Transaction(
            item_id=self.item.id,
            created_by=self.user.id,
            transaction_type=TransactionType.OUT,
            quantity=1,
            transaction_date=date(2),
            reference_number="REL-2026-0001",
        )
        self.db.add(duplicate)
        with self.assertRaises(IntegrityError):
            self.db.flush()

    @patch("app.routers.transactions.save_transaction_report")
    def test_actual_transaction_routes_update_the_stock_card(self, _save_pdf):
        for day, quantity, expected in [(1, 2, 51), (2, 1, 50)]:
            stock_out(StockOutCreate(
                item_id=self.item.id, quantity=quantity,
                recipient_name="Test Employee", recipient_department="Admin Unit",
                transaction_date=date(day),
            ), request=None, current_user=self.user, db=self.db)
            self.assertEqual(self.item.quantity, expected)
            self.assertEqual(build_stock_card(self.db, self.item.id)["closing_balance"], expected)
        stock_in(StockInCreate(
            item_id=self.item.id, quantity=15, reference_number="PO-2026-06-0059",
            transaction_date=date(3),
        ), request=None, current_user=self.user, db=self.db)
        self.assertEqual(self.item.quantity, 65)
        self.assertEqual([r["balance"] for r in build_stock_card(self.db, self.item.id)["rows"]], [51, 50, 65])

    def test_local_date_boundaries_and_inactive_item_history(self):
        self.ledger()
        self.item.is_active = False
        self.db.commit()
        card = build_stock_card(
            self.db, self.item.id,
            start_date=datetime.fromisoformat("2026-06-02T00:00:00+08:00"),
            end_date=datetime.fromisoformat("2026-06-02T23:59:59.999+08:00"),
        )
        self.assertEqual([r["date"] for r in card["rows"]], ["6/2/26"])
        self.assertEqual(card["rows"][0]["balance"], 50)

    def test_pdf_layout_is_long_bond_with_repeated_headers(self):
        self.ledger()
        context = build_stock_card(self.db, self.item.id)
        context["region"] = "Regional Office XIII"
        template = _env.get_template("stock_card.html")
        for copies in [1, 30]:
            sample = {**context, "rows": context["rows"] * copies, "blank_rows": context["blank_rows"] if copies == 1 else 0}
            document = _weasyprint_html()(string=template.render(**sample), base_url=str(TEMPLATES_DIR)).render()
            self.assertEqual(len(document.pages), 1 if copies == 1 else 3)
            for page in document.pages:
                self.assertEqual((page.width, page.height), (816, 1248))
                text = " ".join(box.text for box in page._page_box.descendants() if hasattr(box, "text"))
                self.assertIn("Appendix 38", text)
                self.assertIn("STOCK CARD", text)
                self.assertIn("AO 6/15/02", text)
                self.assertNotIn("Balance brought forward", text)

    def test_blank_card_does_not_print_the_seed_quantity(self):
        context = build_stock_card(self.db, self.item.id)
        context["region"] = "Regional Office XIII"
        html = _env.get_template("stock_card.html").render(**context)
        document = _weasyprint_html()(string=html, base_url=str(TEMPLATES_DIR)).render()
        text = " ".join(box.text for box in document.pages[0]._page_box.descendants() if hasattr(box, "text"))
        self.assertNotIn("53", text)
        self.assertNotIn("Balance brought forward", text)

    def test_manual_reference_filenames_cannot_overwrite_one_another(self):
        self.assertNotEqual(_safe_name("PO/123"), _safe_name("PO_123"))
        self.assertEqual(_safe_name("RCV-2026-0001"), "RCV-2026-0001.pdf")
        self.assertTrue(_safe_name('PO-ñ/"123').isascii())
        self.assertNotEqual(
            _safe_name("PO-2026-06-0059", uuid.uuid4()),
            _safe_name("PO-2026-06-0059", uuid.uuid4()),
        )
        self.assertNotEqual(_safe_name(None, uuid.uuid4()), _safe_name(None, uuid.uuid4()))


if __name__ == "__main__":
    unittest.main()
