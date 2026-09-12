#!/usr/bin/env python3
"""
JanDrishti — Standalone Live MoSPI e-SAKSHI Sanction Mapping Verification Utility

Performs read-only live verification against the official MoSPI e-SAKSHI portal:
    POST https://mplads.mospi.gov.in/rest/PreLoginDashboardData/getTilesReportData
and validates exact 1:1 matching across all 591 JanDrishti completed works.

NOTE: This script is for standalone data-source verification and is NOT executed during pytest.
"""

import sys
import os
import json
from datetime import datetime, timezone
import httpx

# Add backend to sys.path for database models
sys.path.insert(0, os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "backend"))

from app.database import SessionLocal
from app.models.work import Work


def parse_date_safely(date_str: str):
    if not date_str:
        return None
    for fmt in ["%d-%b-%Y", "%d-%b-%y", "%Y-%m-%d", "%d/%m/%Y"]:
        try:
            return datetime.strptime(date_str.strip(), fmt)
        except (ValueError, TypeError):
            continue
    return None


def run_live_verification():
    base_url = "https://mplads.mospi.gov.in"
    headers = {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)",
        "Content-Type": "application/json; charset=utf-8",
        "Accept": "application/json"
    }

    state_combos = [
        ("Andhra Pradesh", "2,0,0,2"),
        ("Goa", "12,0,0,2"),
        ("Goa (Rajya Sabha)", "12,0,0,1"),
        ("Telangana", "129,0,0,2"),
        ("Uttar Pradesh", "33,0,0,2"),
        ("Uttar Pradesh (Rajya Sabha)", "33,0,0,1"),
    ]

    retrieval_timestamp = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    print(f"[{retrieval_timestamp}] Starting live MoSPI e-SAKSHI data retrieval...")

    state_counts = {"AP": 0, "Goa": 0, "Telangana": 0, "UP": 0}
    raw_records_total = 0
    unique_official_records = {}
    id_frequency = {}
    with httpx.Client(timeout=60.0, verify=False) as client:
        for label, combo in state_combos:
            try:
                payload = {"combo": combo, "key": "Works Sanctioned"}
                resp = client.post(f"{base_url}/rest/PreLoginDashboardData/getTilesReportData", json=payload, headers=headers)
                resp.raise_for_status()
                data = resp.json()
                raw_str = data.get("Total Sanction Work", "[]")
                recs = json.loads(raw_str) if isinstance(raw_str, str) else raw_str

                count = len(recs)
                raw_records_total += count

                if "Andhra" in label:
                    state_counts["AP"] += count
                elif "Goa" in label:
                    state_counts["Goa"] += count
                elif "Telangana" in label:
                    state_counts["Telangana"] += count
                elif "Uttar Pradesh" in label:
                    state_counts["UP"] += count

                for r in recs:
                    wid = r.get("WORK_RECOMMENDATION_DTL_ID")
                    if wid is not None:
                        wid_int = int(wid) if str(wid).isdigit() else str(wid)
                        id_frequency[wid_int] = id_frequency.get(wid_int, 0) + 1
                        unique_official_records[wid_int] = r

            except Exception as e:
                print(f"Error retrieving combo '{combo}' ({label}): {e}")

    duplicate_id_groups = [k for k, v in id_frequency.items() if v > 1]
    duplicate_occurrences = raw_records_total - len(unique_official_records)

    print("\n==================================================")
    print("LIVE e-SAKSHI RETRIEVAL REPORT")
    print("==================================================")
    print(f"AP records retrieved: {state_counts['AP']:,}")
    print(f"Goa records retrieved: {state_counts['Goa']:,}")
    print(f"Telangana records retrieved: {state_counts['Telangana']:,}")
    print(f"UP records retrieved: {state_counts['UP']:,}")
    print("--------------------------------------------------")
    print(f"Total raw records: {raw_records_total:,}")
    print(f"Unique WORK_RECOMMENDATION_DTL_ID records: {len(unique_official_records):,}")
    print(f"Duplicate record occurrences resolved: {duplicate_occurrences}")
    print(f"Duplicate ID groups: {len(duplicate_id_groups)}")


    # Database matching verification
    db = SessionLocal()
    works = db.query(Work).all()
    total_works = len(works)

    exact_matches = 0
    unmatched_works = []
    ambiguous_matches = 0

    for w in works:
        wid = w.work_id or w.id
        if wid in unique_official_records:
            exact_matches += 1
        else:
            unmatched_works.append(wid)

    match_rate = (exact_matches / total_works * 100.0) if total_works > 0 else 0.0

    print("\n==================================================")
    print("JANDRISHTI RECONCILIATION AUDIT")
    print("==================================================")
    print(f"JanDrishti works evaluated: {total_works}")
    print(f"Exact matches: {exact_matches}")
    print(f"Unmatched: {len(unmatched_works)}")
    print(f"Ambiguous: {ambiguous_matches}")
    print(f"Exact match rate: {match_rate:.2f}%")
    print("--------------------------------------------------")

    # Sample works validation
    sample_ids = [188167, 191563, 222927, 270307, 278726, 214233]
    print("\nSAMPLE VERIFICATION EXPECTATIONS:")
    print("-" * 100)
    print(f"{'Work ID':<10} {'Official Sanction':<20} {'Sanction Date':<15} {'Reported Cost':<20} {'Completion Date':<17} {'Duration':<10}")
    print("-" * 100)

    for wid in sample_ids:
        w = next((w for w in works if w.work_id == wid or w.id == wid), None)
        rec = unique_official_records.get(wid, {})
        s_amt = rec.get("SANCTION_AMOUNT")
        s_date_str = rec.get("SANCTION_DATE")
        j_cost = w.cost if w else None
        c_date = w.completion_date if w else None

        duration_str = "N/A"
        if s_date_str and c_date:
            s_dt = parse_date_safely(s_date_str)
            if s_dt:
                c_dt = datetime(c_date.year, c_date.month, c_date.day) if isinstance(c_date, datetime) or hasattr(c_date, "year") else parse_date_safely(str(c_date))
                if c_dt:
                    duration_str = f"{(c_dt - s_dt).days} days"

        s_amt_fmt = f"₹{s_amt:,.2f}" if s_amt is not None else "N/A"
        j_cost_fmt = f"₹{j_cost:,.2f}" if j_cost is not None else "N/A"
        c_date_fmt = str(c_date)[:10] if c_date else "N/A"

        print(f"#{wid:<9} {s_amt_fmt:<20} {str(s_date_str):<15} {j_cost_fmt:<20} {c_date_fmt:<17} {duration_str:<10}")

    db.close()

    print("-" * 100)
    print(f"Retrieval Timestamp: {retrieval_timestamp}")
    print("Verification Result: " + ("PASS (100% exact match)" if match_rate == 100.0 else "FAIL"))


if __name__ == "__main__":
    run_live_verification()
