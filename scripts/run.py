"""
CLI entry point.

Usage:
    python scripts/run.py               # classify + launch dashboard
    python scripts/run.py --fetch-only  # classify, no dashboard
    python scripts/run.py --dash-only   # skip classify, open dashboard
"""

import sys
import argparse
from loguru import logger
from rich.console import Console
from rich.table import Table
from rich.progress import track

sys.path.insert(0, ".")

from data.fetcher import fetch_unread_emails
from data.store import init_db, load_unread_ids, get_stats
from pipeline.graph import classify_batch

console = Console()


def run_classification():
    console.rule("[bold]Step 1: Fetching unread emails from Gmail")
    emails = fetch_unread_emails()

    if not emails:
        console.print("[yellow]No unread emails found. Exiting.[/yellow]")
        return

    # Skip emails already in the database
    existing_ids = load_unread_ids()
    new_emails = [e for e in emails if e["id"] not in existing_ids]
    console.print(f"  Total unread: {len(emails)}  |  New (not yet classified): {len(new_emails)}")

    if not new_emails:
        console.print("[green]All emails already classified.[/green]")
        return

    console.rule("[bold]Step 2: Classifying via LangGraph + Ollama")
    results = classify_batch(new_emails)

    # Summary table
    classified = sum(1 for r in results if r.get("status") == "classified")
    failed     = sum(1 for r in results if r.get("status") == "failed")

    table = Table(title="Classification Summary")
    table.add_column("Metric", style="cyan")
    table.add_column("Count",  style="magenta")
    table.add_row("Classified",  str(classified))
    table.add_row("Failed",      str(failed))
    table.add_row("Total run",   str(len(results)))
    console.print(table)

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
    args = parser.parse_args()

    init_db()

    if not args.dash_only:
        run_classification()
    if not args.fetch_only:
        launch_dashboard()
