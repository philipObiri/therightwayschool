"""
Advanced Accounting Module - Professional Edition
Double-entry bookkeeping, Chart of Accounts, Journal Entries, General Ledger,
Trial Balance, Income Statement, Balance Sheet, Bank Reconciliation.
"""
from fastapi import APIRouter, Depends, HTTPException, Body, Query
from database import db
from models import gen_id
from auth import get_current_user
from datetime import datetime, timezone
from typing import Optional
from routes.finance.accounting_bridge import sync_all_finance_to_accounting

router = APIRouter(prefix="/api/accounting", tags=["accounting"])

DEFAULT_COA = [
    {"code": "1000", "name": "Cash", "type": "asset", "category": "Current Assets"},
    {"code": "1010", "name": "Bank - Main Account", "type": "asset", "category": "Current Assets"},
    {"code": "1020", "name": "Mobile Money", "type": "asset", "category": "Current Assets"},
    {"code": "1100", "name": "Accounts Receivable (Student Fees)", "type": "asset", "category": "Current Assets"},
    {"code": "1200", "name": "Prepaid Expenses", "type": "asset", "category": "Current Assets"},
    {"code": "1500", "name": "Fixed Assets - Equipment", "type": "asset", "category": "Fixed Assets"},
    {"code": "1510", "name": "Fixed Assets - Furniture", "type": "asset", "category": "Fixed Assets"},
    {"code": "1520", "name": "Fixed Assets - Vehicles", "type": "asset", "category": "Fixed Assets"},
    {"code": "2000", "name": "Accounts Payable", "type": "liability", "category": "Current Liabilities"},
    {"code": "2100", "name": "Salaries Payable", "type": "liability", "category": "Current Liabilities"},
    {"code": "2200", "name": "Tax Payable", "type": "liability", "category": "Current Liabilities"},
    {"code": "2300", "name": "Deferred Revenue (Advance Fees)", "type": "liability", "category": "Current Liabilities"},
    {"code": "2500", "name": "Long-term Loans", "type": "liability", "category": "Long-term Liabilities"},
    {"code": "3000", "name": "Owner's Equity", "type": "equity", "category": "Equity"},
    {"code": "3100", "name": "Retained Earnings", "type": "equity", "category": "Equity"},
    {"code": "4000", "name": "Tuition Fee Income", "type": "revenue", "category": "Revenue"},
    {"code": "4010", "name": "Boarding Fee Income", "type": "revenue", "category": "Revenue"},
    {"code": "4020", "name": "Examination Fee Income", "type": "revenue", "category": "Revenue"},
    {"code": "4030", "name": "Other Income", "type": "revenue", "category": "Revenue"},
    {"code": "4040", "name": "Interest Income", "type": "revenue", "category": "Revenue"},
    {"code": "5000", "name": "Salaries & Wages", "type": "expense", "category": "Operating Expenses"},
    {"code": "5010", "name": "Teaching Materials", "type": "expense", "category": "Operating Expenses"},
    {"code": "5020", "name": "Utilities (Electricity, Water)", "type": "expense", "category": "Operating Expenses"},
    {"code": "5030", "name": "Building Maintenance", "type": "expense", "category": "Operating Expenses"},
    {"code": "5040", "name": "Transport", "type": "expense", "category": "Operating Expenses"},
    {"code": "5050", "name": "Food & Catering (Boarding)", "type": "expense", "category": "Operating Expenses"},
    {"code": "5060", "name": "Insurance", "type": "expense", "category": "Operating Expenses"},
    {"code": "5070", "name": "Marketing & Advertising", "type": "expense", "category": "Operating Expenses"},
    {"code": "5080", "name": "Office Supplies", "type": "expense", "category": "Operating Expenses"},
    {"code": "5090", "name": "Depreciation", "type": "expense", "category": "Operating Expenses"},
    {"code": "5100", "name": "Miscellaneous Expenses", "type": "expense", "category": "Operating Expenses"},
]


async def compute_period_balances(start_date: str = None, end_date: str = None):
    """Compute account balances from journal entries within a date range."""
    query = {"status": "posted"}
    if start_date or end_date:
        date_filter = {}
        if start_date:
            date_filter["$gte"] = start_date
        if end_date:
            date_filter["$lte"] = end_date
        if date_filter:
            query["entry_date"] = date_filter

    entries = await db.journal_entries.find(query, {"_id": 0}).to_list(10000)
    balances = {}
    for entry in entries:
        for line in entry.get("lines", []):
            code = line["account_code"]
            if code not in balances:
                balances[code] = {"debit": 0, "credit": 0}
            balances[code]["debit"] += line.get("debit", 0)
            balances[code]["credit"] += line.get("credit", 0)
    return balances


@router.get("/dashboard")
async def get_dashboard(user=Depends(get_current_user)):
    """Financial dashboard summary."""
    accounts = await db.chart_of_accounts.find({"is_active": True}, {"_id": 0}).to_list(500)
    total_assets = sum(a.get("balance", 0) for a in accounts if a["type"] == "asset")
    total_liabilities = sum(a.get("balance", 0) for a in accounts if a["type"] == "liability")
    total_equity = sum(a.get("balance", 0) for a in accounts if a["type"] == "equity")
    total_revenue = sum(a.get("balance", 0) for a in accounts if a["type"] == "revenue")
    total_expenses = sum(a.get("balance", 0) for a in accounts if a["type"] == "expense")
    journal_count = await db.journal_entries.count_documents({})
    bank_count = await db.bank_transactions.count_documents({"matched": False})
    return {
        "total_assets": total_assets,
        "total_liabilities": total_liabilities,
        "total_equity": total_equity,
        "total_revenue": total_revenue,
        "total_expenses": total_expenses,
        "net_income": total_revenue - total_expenses,
        "journal_count": journal_count,
        "account_count": len(accounts),
        "unmatched_bank": bank_count,
    }


@router.post("/sync-finance")
async def sync_finance_data(user=Depends(get_current_user)):
    """Sync all existing Finance invoices & payments into Accounting journal entries."""
    result = await sync_all_finance_to_accounting()
    return {"message": f"Synced {result['invoices_synced']} invoices and {result['payments_synced']} payments to Accounting", **result}



@router.post("/seed-coa")
async def seed_chart_of_accounts(user=Depends(get_current_user)):
    existing = await db.chart_of_accounts.count_documents({})
    if existing > 0:
        return {"message": f"Chart of Accounts already has {existing} entries"}
    now = datetime.now(timezone.utc).isoformat()
    for acct in DEFAULT_COA:
        await db.chart_of_accounts.insert_one({
            "account_id": gen_id("acct_"),
            "code": acct["code"],
            "name": acct["name"],
            "type": acct["type"],
            "category": acct["category"],
            "balance": 0.0,
            "is_active": True,
            "created_at": now,
        })
    return {"message": f"Seeded {len(DEFAULT_COA)} accounts"}


@router.get("/chart-of-accounts")
async def get_chart_of_accounts(user=Depends(get_current_user)):
    accounts = await db.chart_of_accounts.find({"is_active": True}, {"_id": 0}).sort("code", 1).to_list(500)
    totals = {}
    for a in accounts:
        t = a["type"]
        totals[t] = totals.get(t, 0) + a.get("balance", 0)
    return {"accounts": accounts, "totals": totals}


@router.post("/chart-of-accounts")
async def create_account(data: dict = Body(...), user=Depends(get_current_user)):
    required = ["code", "name", "type"]
    for f in required:
        if not data.get(f):
            raise HTTPException(400, f"{f} is required")
    existing = await db.chart_of_accounts.find_one({"code": data["code"]}, {"_id": 0})
    if existing:
        raise HTTPException(400, f"Account code {data['code']} already exists")
    now = datetime.now(timezone.utc).isoformat()
    account = {
        "account_id": gen_id("acct_"),
        "code": data["code"],
        "name": data["name"],
        "type": data["type"],
        "category": data.get("category", ""),
        "balance": 0.0,
        "is_active": True,
        "created_by": user["user_id"],
        "created_at": now,
    }
    await db.chart_of_accounts.insert_one(account)
    account.pop("_id", None)
    return account


@router.delete("/chart-of-accounts/{account_id}")
async def deactivate_account(account_id: str, user=Depends(get_current_user)):
    result = await db.chart_of_accounts.update_one(
        {"account_id": account_id}, {"$set": {"is_active": False}}
    )
    if result.modified_count == 0:
        raise HTTPException(404, "Account not found")
    return {"message": "Account deactivated"}


@router.post("/journal-entries")
async def create_journal_entry(data: dict = Body(...), user=Depends(get_current_user)):
    description = data.get("description", "")
    lines = data.get("lines", [])
    reference = data.get("reference", "")
    entry_date = data.get("entry_date", datetime.now(timezone.utc).strftime("%Y-%m-%d"))
    if not description:
        raise HTTPException(400, "Description required")
    if len(lines) < 2:
        raise HTTPException(400, "At least 2 lines (debit and credit) required")
    total_debit = sum(float(ln.get("debit", 0)) for ln in lines)
    total_credit = sum(float(ln.get("credit", 0)) for ln in lines)
    if abs(total_debit - total_credit) > 0.01:
        raise HTTPException(400, f"Debits ({total_debit:.2f}) must equal Credits ({total_credit:.2f})")
    now = datetime.now(timezone.utc).isoformat()
    entry_id = gen_id("je_")
    entry_lines = []
    for i, line in enumerate(lines):
        account_code = line.get("account_code", "")
        account = await db.chart_of_accounts.find_one({"code": account_code}, {"_id": 0})
        if not account:
            raise HTTPException(400, f"Account code '{account_code}' not found")
        debit = float(line.get("debit", 0))
        credit = float(line.get("credit", 0))
        entry_lines.append({
            "line_num": i + 1,
            "account_code": account_code,
            "account_name": account["name"],
            "account_type": account["type"],
            "debit": debit,
            "credit": credit,
            "memo": line.get("memo", ""),
        })
        balance_change = debit - credit
        if account["type"] in ["asset", "expense"]:
            await db.chart_of_accounts.update_one({"code": account_code}, {"$inc": {"balance": balance_change}})
        else:
            await db.chart_of_accounts.update_one({"code": account_code}, {"$inc": {"balance": -balance_change}})
    entry = {
        "entry_id": entry_id,
        "entry_date": entry_date,
        "description": description,
        "reference": reference,
        "lines": entry_lines,
        "total_debit": total_debit,
        "total_credit": total_credit,
        "status": "posted",
        "created_by": user["user_id"],
        "created_by_name": user.get("name", ""),
        "created_at": now,
    }
    await db.journal_entries.insert_one(entry)
    entry.pop("_id", None)
    return entry


@router.get("/journal-entries")
async def get_journal_entries(user=Depends(get_current_user), limit: int = 100):
    entries = await db.journal_entries.find({}, {"_id": 0}).sort("created_at", -1).limit(limit).to_list(limit)
    return entries


@router.get("/general-ledger")
async def get_general_ledger(
    user=Depends(get_current_user),
    account_code: Optional[str] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
):
    query = {}
    if account_code:
        query["lines.account_code"] = account_code
    if start_date or end_date:
        date_filter = {}
        if start_date:
            date_filter["$gte"] = start_date
        if end_date:
            date_filter["$lte"] = end_date
        if date_filter:
            query["entry_date"] = date_filter

    entries = await db.journal_entries.find(query, {"_id": 0}).sort("entry_date", 1).limit(500).to_list(500)

    account_type = None
    if account_code:
        acct = await db.chart_of_accounts.find_one({"code": account_code}, {"_id": 0})
        if acct:
            account_type = acct["type"]

    ledger_lines = []
    running_balance = 0.0
    for entry in entries:
        for line in entry.get("lines", []):
            if account_code and line["account_code"] != account_code:
                continue
            debit = line["debit"]
            credit = line["credit"]
            if account_code:
                if account_type in ["asset", "expense"]:
                    running_balance += debit - credit
                else:
                    running_balance += credit - debit
            ledger_lines.append({
                "entry_id": entry["entry_id"],
                "entry_date": entry["entry_date"],
                "description": entry["description"],
                "reference": entry.get("reference", ""),
                "account_code": line["account_code"],
                "account_name": line["account_name"],
                "account_type": line.get("account_type", ""),
                "debit": debit,
                "credit": credit,
                "memo": line.get("memo", ""),
                "running_balance": round(running_balance, 2) if account_code else None,
            })
    total_debit = sum(row["debit"] for row in ledger_lines)
    total_credit = sum(row["credit"] for row in ledger_lines)
    return {"lines": ledger_lines, "total": len(ledger_lines), "total_debit": total_debit, "total_credit": total_credit}


@router.get("/trial-balance")
async def get_trial_balance(
    user=Depends(get_current_user),
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
):
    accounts = await db.chart_of_accounts.find({"is_active": True}, {"_id": 0}).sort("code", 1).to_list(500)

    if start_date or end_date:
        period_balances = await compute_period_balances(start_date, end_date)
        trial_balance = []
        total_debit = 0
        total_credit = 0
        for acct in accounts:
            pb = period_balances.get(acct["code"], {"debit": 0, "credit": 0})
            if acct["type"] in ["asset", "expense"]:
                net = pb["debit"] - pb["credit"]
                debit_bal = net if net >= 0 else 0
                credit_bal = abs(net) if net < 0 else 0
            else:
                net = pb["credit"] - pb["debit"]
                credit_bal = net if net >= 0 else 0
                debit_bal = abs(net) if net < 0 else 0
            total_debit += debit_bal
            total_credit += credit_bal
            trial_balance.append({
                "code": acct["code"], "name": acct["name"], "type": acct["type"],
                "category": acct.get("category", ""), "debit": debit_bal, "credit": credit_bal,
            })
    else:
        trial_balance = []
        total_debit = 0
        total_credit = 0
        for acct in accounts:
            balance = acct.get("balance", 0)
            if acct["type"] in ["asset", "expense"]:
                debit_bal = balance if balance >= 0 else 0
                credit_bal = abs(balance) if balance < 0 else 0
            else:
                credit_bal = balance if balance >= 0 else 0
                debit_bal = abs(balance) if balance < 0 else 0
            total_debit += debit_bal
            total_credit += credit_bal
            trial_balance.append({
                "code": acct["code"], "name": acct["name"], "type": acct["type"],
                "category": acct.get("category", ""), "debit": debit_bal, "credit": credit_bal,
            })
    return {
        "trial_balance": trial_balance, "total_debit": total_debit, "total_credit": total_credit,
        "balanced": abs(total_debit - total_credit) < 0.01,
        "period": {"start": start_date, "end": end_date} if (start_date or end_date) else None,
    }


@router.get("/income-statement")
async def get_income_statement(
    user=Depends(get_current_user),
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
):
    accounts = await db.chart_of_accounts.find({"is_active": True}, {"_id": 0}).to_list(500)
    if start_date or end_date:
        period_balances = await compute_period_balances(start_date, end_date)
        for a in accounts:
            pb = period_balances.get(a["code"], {"debit": 0, "credit": 0})
            if a["type"] == "revenue":
                a["period_amount"] = pb["credit"] - pb["debit"]
            elif a["type"] == "expense":
                a["period_amount"] = pb["debit"] - pb["credit"]
    else:
        for a in accounts:
            a["period_amount"] = a.get("balance", 0)

    revenue_accounts = [a for a in accounts if a["type"] == "revenue"]
    expense_accounts = [a for a in accounts if a["type"] == "expense"]
    total_revenue = sum(a["period_amount"] for a in revenue_accounts)
    total_expenses = sum(a["period_amount"] for a in expense_accounts)
    return {
        "revenue": [{"code": a["code"], "name": a["name"], "category": a.get("category", "Revenue"), "amount": a["period_amount"]} for a in revenue_accounts],
        "expenses": [{"code": a["code"], "name": a["name"], "category": a.get("category", "Operating Expenses"), "amount": a["period_amount"]} for a in expense_accounts],
        "total_revenue": total_revenue,
        "total_expenses": total_expenses,
        "net_income": total_revenue - total_expenses,
        "period": {"start": start_date, "end": end_date} if (start_date or end_date) else None,
    }


@router.get("/balance-sheet")
async def get_balance_sheet(
    user=Depends(get_current_user),
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
):
    accounts = await db.chart_of_accounts.find({"is_active": True}, {"_id": 0}).to_list(500)
    if end_date:
        period_balances = await compute_period_balances(None, end_date)
        for a in accounts:
            pb = period_balances.get(a["code"], {"debit": 0, "credit": 0})
            if a["type"] in ["asset", "expense"]:
                a["calc_balance"] = pb["debit"] - pb["credit"]
            else:
                a["calc_balance"] = pb["credit"] - pb["debit"]
    else:
        for a in accounts:
            a["calc_balance"] = a.get("balance", 0)

    assets = [a for a in accounts if a["type"] == "asset"]
    liabilities = [a for a in accounts if a["type"] == "liability"]
    equity = [a for a in accounts if a["type"] == "equity"]

    total_assets = sum(a["calc_balance"] for a in assets)
    total_liabilities = sum(a["calc_balance"] for a in liabilities)
    total_equity = sum(a["calc_balance"] for a in equity)

    revenue_total = sum(a["calc_balance"] for a in accounts if a["type"] == "revenue")
    expense_total = sum(a["calc_balance"] for a in accounts if a["type"] == "expense")
    net_income = revenue_total - expense_total

    return {
        "assets": [{"code": a["code"], "name": a["name"], "category": a.get("category", ""), "balance": a["calc_balance"]} for a in assets],
        "liabilities": [{"code": a["code"], "name": a["name"], "category": a.get("category", ""), "balance": a["calc_balance"]} for a in liabilities],
        "equity": [{"code": a["code"], "name": a["name"], "category": a.get("category", ""), "balance": a["calc_balance"]} for a in equity],
        "total_assets": total_assets,
        "total_liabilities": total_liabilities,
        "total_equity": total_equity,
        "net_income": net_income,
        "total_liabilities_equity": total_liabilities + total_equity + net_income,
        "balanced": abs(total_assets - (total_liabilities + total_equity + net_income)) < 0.01,
        "period": {"end": end_date} if end_date else None,
    }


@router.post("/bank-transactions")
async def add_bank_transaction(data: dict = Body(...), user=Depends(get_current_user)):
    now = datetime.now(timezone.utc).isoformat()
    txn = {
        "txn_id": gen_id("btxn_"),
        "date": data.get("date", now[:10]),
        "description": data.get("description", ""),
        "amount": float(data.get("amount", 0)),
        "type": data.get("type", "credit"),
        "reference": data.get("reference", ""),
        "matched": False,
        "matched_entry_id": None,
        "created_by": user["user_id"],
        "created_at": now,
    }
    await db.bank_transactions.insert_one(txn)
    txn.pop("_id", None)
    return txn


@router.get("/bank-transactions")
async def get_bank_transactions(user=Depends(get_current_user), unmatched_only: bool = False):
    query = {"matched": False} if unmatched_only else {}
    txns = await db.bank_transactions.find(query, {"_id": 0}).sort("date", -1).limit(500).to_list(500)
    return txns


@router.post("/bank-reconcile/{txn_id}")
async def reconcile_bank_transaction(txn_id: str, data: dict = Body(...), user=Depends(get_current_user)):
    entry_id = data.get("entry_id", "")
    if not entry_id:
        raise HTTPException(400, "entry_id required")
    txn = await db.bank_transactions.find_one({"txn_id": txn_id}, {"_id": 0})
    if not txn:
        raise HTTPException(404, "Bank transaction not found")
    entry = await db.journal_entries.find_one({"entry_id": entry_id}, {"_id": 0})
    if not entry:
        raise HTTPException(404, "Journal entry not found")
    now = datetime.now(timezone.utc).isoformat()
    await db.bank_transactions.update_one(
        {"txn_id": txn_id},
        {"$set": {"matched": True, "matched_entry_id": entry_id, "reconciled_at": now, "reconciled_by": user["user_id"]}}
    )
    return {"message": "Transaction reconciled"}


@router.get("/reconciliation-summary")
async def get_reconciliation_summary(user=Depends(get_current_user)):
    all_txns = await db.bank_transactions.find({}, {"_id": 0}).to_list(1000)
    matched = [t for t in all_txns if t.get("matched")]
    unmatched = [t for t in all_txns if not t.get("matched")]
    bank_balance = sum(t["amount"] if t["type"] == "credit" else -t["amount"] for t in all_txns)
    unmatched_total = sum(t["amount"] if t["type"] == "credit" else -t["amount"] for t in unmatched)
    bank_acct = await db.chart_of_accounts.find_one({"code": "1010"}, {"_id": 0})
    book_balance = bank_acct.get("balance", 0) if bank_acct else 0
    return {
        "bank_balance": bank_balance,
        "book_balance": book_balance,
        "difference": bank_balance - book_balance,
        "total_transactions": len(all_txns),
        "matched_count": len(matched),
        "unmatched_count": len(unmatched),
        "unmatched_total": unmatched_total,
    }

