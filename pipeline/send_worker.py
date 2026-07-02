"""
Background delayed-send worker.

Polls the `pending_sends` table every ~1 second for rows where
`status = 'scheduled'` and `scheduled_send_at <= now()`. For each
due row, sends the Gmail draft via `drafts.send` and logs the result
to the `sent_replies` audit table.

This is what makes the frontend's "Undo" button real: if the user
cancels before the worker fires, `gmail_send_draft` is simply never
called. The Gmail draft created at queue time is left in place — it
is never deleted on cancel, so the user can still send it manually.

Started on FastAPI startup:
    @app.on_event("startup")
    async def start_worker():
        asyncio.create_task(pending_send_worker())
"""

import asyncio
from loguru import logger


async def pending_send_worker(poll_interval: float = 1.0) -> None:
    """
    Async loop that processes due pending sends.

    Runs forever; designed to be launched as a background task
    via asyncio.create_task().
    """
    logger.info("Pending send worker started (poll_interval={}s)", poll_interval)

    while True:
        try:
            # Import inside loop to avoid circular imports at module load
            from data.store import (
                get_due_pending_sends,
                mark_pending_send,
                log_sent_reply,
            )
            from auth.gmail_compose import gmail_send_draft

            due = get_due_pending_sends()
            for item in due:
                queue_id = item["id"]
                email_id = item["email_id"]
                gmail_draft_id = item["gmail_draft_id"]
                owner_email = item.get("owner_email")

                try:
                    message_id = gmail_send_draft(
                        gmail_draft_id=gmail_draft_id,
                        owner_email=owner_email,
                    )
                    mark_pending_send(queue_id, status="sent")
                    log_sent_reply(
                        email_id=email_id,
                        draft_text=item["draft_text"],
                        final_text=item["final_text"],
                        message_id=message_id,
                        owner_email=owner_email,
                    )
                    logger.info(
                        "Delayed send {} completed → message {}",
                        queue_id, message_id,
                    )
                except Exception as exc:
                    mark_pending_send(queue_id, status="failed")
                    logger.error(
                        "Delayed send {} failed for email {}: {}",
                        queue_id, email_id, exc,
                    )

        except Exception as exc:
            # Don't let a single poll cycle crash the worker
            logger.error("Pending send worker error: {}", exc)

        await asyncio.sleep(poll_interval)
