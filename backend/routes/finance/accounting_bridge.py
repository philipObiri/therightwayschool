"""
Accounting Bridge - Auto-posts journal entries from Finance operations.
Maps fee invoices, payments, and reversals to double-entry accounting.
"""
from database import db
from models import gen_id
from datetime import datetime, timezone
from typing import Optional

METHOD_TO_ACCOUNT: dict[str, tuple[str, str]] = {
    "cash": ("1000", "Cash"),
    "bank_transfer": ("1010", "Bank - Main Account"),
    "mobile_money": ("1020", "Mobile Money"),
    "cheque": ("1010", "Bank - Main Account"),
    "other": ("1000", "Cash"),
}


async def _has_chart_of_accounts() -> bool:
    """Check if Chart of Accounts is set up."""
    count: int = await db.chart_of_accounts.count_documents({"is_active": True})
    return count > 0


async def post_finance_journal(
    description: str,
    lines_data: list[dict],
    reference: str = "",
    user_id: str = "",
    user_name: str = "",
) -> Optional[str]:
    """Create a journal entry from Finance operations. Returns entry_id or None."""
    if not await _has_chart_of_accounts():
        return None

    entry_lines: list[dict] = []
    for i, line in enumerate(lines_data):
        acct = await db.chart_of_accounts.find_one(
            {"code": line["account_code"], "is_active": True}, {"_id": 0}
        )
        if not acct:
            return None

        debit: float = round(line.get("debit", 0), 2)
        credit: float = round(line.get("credit", 0), 2)

        entry_lines.append({
            "line_num": i + 1,
            "account_code": acct["code"],
            "account_name": acct["name"],
            "account_type": acct["type"],
            "debit": debit,
            "credit": credit,
            "memo": line.get("memo", ""),
        })

        balance_change: float = debit - credit
        if acct["type"] in ["asset", "expense"]:
            await db.chart_of_accounts.update_one({"code": acct["code"]}, {"$inc": {"balance": balance_change}})
        else:
            await db.chart_of_accounts.update_one({"code": acct["code"]}, {"$inc": {"balance": -balance_change}})

    total_debit: float = sum(ln["debit"] for ln in entry_lines)
    total_credit: float = sum(ln["credit"] for ln in entry_lines)

    if abs(total_debit - total_credit) > 0.01:
        return None

    now: str = datetime.now(timezone.utc).isoformat()
    entry_id: str = gen_id("je_")
    entry: dict = {
        "entry_id": entry_id,
        "entry_date": now[:10],
        "description": description,
        "reference": reference,
        "lines": entry_lines,
        "total_debit": total_debit,
        "total_credit": total_credit,
        "status": "posted",
        "source": "finance_auto",
        "created_by": user_id,
        "created_by_name": user_name,
        "created_at": now,
    }
    await db.journal_entries.insert_one(entry)
    entry.pop("_id", None)
    return entry_id


async def post_invoice_journal(
    student_name: str,
    amount: float,
    description: str,
    invoice_id: str,
    user_id: str,
    user_name: str,
    fee_category: str = "tuition",
) -> Optional[str]:
    """Invoice created -> Debit Accounts Receivable, Credit Revenue."""
    if amount <= 0:
        return None
    revenue_map: dict[str, str] = {
        "boarding": "4010",
        "examination": "4020",
    }
    revenue_code: str = revenue_map.get(fee_category, "4000")
    return await post_finance_journal(
        description=f"Invoice: {description} - {student_name}",
        reference=invoice_id,
        lines_data=[
            {"account_code": "1100", "debit": amount, "credit": 0, "memo": f"Fees receivable - {student_name}"},
            {"account_code": revenue_code, "debit": 0, "credit": amount, "memo": "Fee income"},
        ],
        user_id=user_id, user_name=user_name,
    )


async def post_payment_journal(
    student_name: str,
    amount: float,
    method: str,
    payment_id: str,
    user_id: str,
    user_name: str,
) -> Optional[str]:
    """Payment received -> Debit Cash/Bank, Credit Accounts Receivable."""
    if amount <= 0:
        return None
    cash_code, cash_name = METHOD_TO_ACCOUNT.get(method, ("1000", "Cash"))
    return await post_finance_journal(
        description=f"Payment: {student_name} via {method}",
        reference=payment_id,
        lines_data=[
            {"account_code": cash_code, "debit": amount, "credit": 0, "memo": f"Received via {method}"},
            {"account_code": "1100", "debit": 0, "credit": amount, "memo": f"Applied - {student_name}"},
        ],
        user_id=user_id, user_name=user_name,
    )


async def reverse_finance_journal(reference_id: str, user_id: str, user_name: str) -> None:
    """Reverse all journal entries tied to a finance reference ID."""
    entries: list[dict] = await db.journal_entries.find(
        {"reference": reference_id, "source": "finance_auto"}, {"_id": 0}
    ).to_list(10)
    for entry in entries:
        reverse_lines: list[dict] = []
        for line in entry.get("lines", []):
            reverse_lines.append({
                "account_code": line["account_code"],
                "debit": line["credit"],
                "credit": line["debit"],
                "memo": f"Reversal: {line.get('memo', '')}",
            })
        await post_finance_journal(
            description=f"REVERSAL: {entry['description']}",
            reference=f"REV-{reference_id}",
            lines_data=reverse_lines,
            user_id=user_id, user_name=user_name,
        )


async def clear_all_finance_journals() -> None:
    """Remove all finance-auto journal entries and reset affected account balances."""
    entries: list[dict] = await db.journal_entries.find({"source": "finance_auto"}, {"_id": 0}).to_list(10000)
    for entry in entries:
        for line in entry.get("lines", []):
            debit: float = line.get("debit", 0)
            credit: float = line.get("credit", 0)
            balance_change: float = debit - credit
            acct = await db.chart_of_accounts.find_one({"code": line["account_code"]}, {"_id": 0})
            if acct:
                if acct["type"] in ["asset", "expense"]:
                    await db.chart_of_accounts.update_one({"code": line["account_code"]}, {"$inc": {"balance": -balance_change}})
                else:
                    await db.chart_of_accounts.update_one({"code": line["account_code"]}, {"$inc": {"balance": balance_change}})
    await db.journal_entries.delete_many({"source": "finance_auto"})


async def sync_all_finance_to_accounting() -> dict[str, int]:
    """Retroactively create journal entries for ALL existing invoices and payments not yet synced."""
    existing = await db.journal_entries.find({"source": "finance_auto"}, {"_id": 0, "reference": 1}).to_list(10000)
    synced_refs: set[str] = {e["reference"] for e in existing}

    invoice_count: int = 0
    payment_count: int = 0

    invoices = await db.invoices_v2.find({"status": {"$ne": "cancelled"}}, {"_id": 0}).to_list(10000)
    for inv in invoices:
        inv_id: str = inv.get("invoice_id", "")
        if inv_id in synced_refs or not inv_id:
            continue
        total: float = inv.get("total_due", 0)
        if total <= 0:
            continue
        student = await db.users.find_one({"user_id": inv.get("student_id", "")}, {"_id": 0, "name": 1})
        student_name: str = student.get("name", "") if student else ""
        desc: str = inv.get("notes", "") or inv.get("invoice_number", "")
        result = await post_invoice_journal(
            student_name=student_name, amount=total,
            description=desc, invoice_id=inv_id,
            user_id=inv.get("created_by", "system"), user_name="Finance Sync",
        )
        if result:
            invoice_count += 1

    payments = await db.payments_v2.find({"status": {"$ne": "reversed"}}, {"_id": 0}).to_list(10000)
    for pay in payments:
        pay_id: str = pay.get("payment_id", "")
        if pay_id in synced_refs or not pay_id:
            continue
        amount: float = pay.get("amount", 0)
        if amount <= 0:
            continue
        student = await db.users.find_one({"user_id": pay.get("student_id", "")}, {"_id": 0, "name": 1})
        student_name = student.get("name", pay.get("payer_name", "")) if student else pay.get("payer_name", "")
        method: str = pay.get("method", "cash")
        if method == "momo":
            method = "mobile_money"
        result = await post_payment_journal(
            student_name=student_name, amount=amount,
            method=method, payment_id=pay_id,
            user_id=pay.get("created_by", "system"), user_name="Finance Sync",
        )
        if result:
            payment_count += 1

    return {"invoices_synced": invoice_count, "payments_synced": payment_count}
