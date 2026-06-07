"""
CLI entry point.

Usage:
    python scripts/run.py               # classify + launch dashboard
    python scripts/run.py --fetch-only  # classify, no dashboard
    python scripts/run.py --dash-only   # skip classify, open dashboard
    python scripts/run.py --mode hr     # classify in HR mode
"""

import sys
import argparse
from loguru import logger
from rich.console import Console
from rich.table import Table
from rich.progress import track

sys.path.insert(0, ".")

from data.fetcher import fetch_unread_emails
from data.store import init_db, load_unread_ids, get_stats, load_hr_unclassified_ids, get_hr_stats, load_standard_classified_ids
from pipeline.graph import classify_batch

console = Console()


def run_classification(mode: str = "standard", reclassify_all: bool = False):
    mode_label = "HR" if mode == "hr" else "Standard"
    console.rule(f"[bold]Step 1: Fetching unread emails from Gmail ({mode_label} mode)")
    emails = fetch_unread_emails()

    if not emails:
        console.print("[yellow]No unread emails found. Exiting.[/yellow]")
        return

    if reclassify_all:
        new_emails = emails
        console.print(f"  Total unread: {len(emails)}  |  Re-classifying ALL in {mode_label} mode")
    else:
        # Skip emails already classified in the requested mode
        if mode == "hr":
            existing_ids = load_hr_unclassified_ids()
            # For HR mode, we want to classify emails NOT yet HR-classified
            # load_hr_unclassified_ids returns IDs that still need HR classification
            new_emails = [e for e in emails if e["id"] in existing_ids or e["id"] not in load_unread_ids()]
        else:
            # Only skip emails already classified in standard mode
            # Emails that exist only with HR classification should still be standard-classified
            existing_ids = load_standard_classified_ids()
            new_emails = [e for e in emails if e["id"] not in existing_ids]
        console.print(f"  Total unread: {len(emails)}  |  New (not yet classified in {mode_label} mode): {len(new_emails)}")

    if not new_emails:
        console.print("[green]All emails already classified.[/green]")
        return

    console.rule(f"[bold]Step 2: Classifying via LangGraph + Ollama ({mode_label})")
    results = classify_batch(new_emails, mode=mode)

    # Summary table
    classified = sum(1 for r in results if r.get("status") == "classified")
    failed     = sum(1 for r in results if r.get("status") == "failed")

    table = Table(title=f"Classification Summary ({mode_label})")
    table.add_column("Metric", style="cyan")
    table.add_column("Count",  style="magenta")
    table.add_row("Classified",  str(classified))
    table.add_row("Failed",      str(failed))
    table.add_row("Total run",   str(len(results)))
    console.print(table)

    if mode == "hr":
        stats = get_hr_stats()
        console.print(f"\n[bold]HR Database totals:[/bold] {stats['total_hr']} HR emails classified")
    else:
        stats = get_stats()
        console.print(f"\n[bold]Database totals:[/bold] {stats['total']} emails classified")


def launch_dashboard():
    console.rule("[bold]Step 3: Launching React Dashboard")
    console.print("\n[green]Classification complete![/green]")
    console.print("Make sure your [bold cyan]FastAPI server (port 8000)[/bold cyan] and [bold cyan]React dev server (port 5173)[/bold cyan] are running.")
    console.print("👉 Open your browser to: [bold blue]http://localhost:5173[/bold blue]\n")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="inbox-intel runner")
    parser.add_argument("--fetch-only", action="store_true")
    parser.add_argument("--dash-only",  action="store_true")
    parser.add_argument("--mode", choices=["standard", "hr"], default="standard",
                        help="Classification mode: standard (4-dim) or hr (5 HR categories)")
    parser.add_argument("--reclassify-all", action="store_true",
                        help="Re-classify all emails, not just new ones")
    args = parser.parse_args()

    init_db()

    if not args.dash_only:
        run_classification(mode=args.mode, reclassify_all=args.reclassify_all)
    if not args.fetch_only:
        launch_dashboard()

