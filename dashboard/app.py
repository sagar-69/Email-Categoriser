"""
inbox-intel Streamlit Dashboard

Run with:
    streamlit run dashboard/app.py
"""

import sys
sys.path.insert(0, ".")

import streamlit as st
import pandas as pd
from datetime import datetime

from config.settings import (
    ACTION_DISPLAY, DEPT_DISPLAY, PRIORITY_DISPLAY,
    ACTION_COLOURS, DEPT_COLOURS, PRIORITY_COLOURS
)
from data.store import load_all, get_stats, init_db
from dashboard.styles import CUSTOM_CSS
from dashboard.charts import (
    action_bar_chart, dept_bar_chart,
    priority_donut_chart, timeline_bar_chart,
)

# ── Page config ───────────────────────────────────────────────────────────────
st.set_page_config(
    page_title="Inbox Intel",
    page_icon="📬",
    layout="wide",
    initial_sidebar_state="expanded",
)
st.markdown(CUSTOM_CSS, unsafe_allow_html=True)

# ── Initialise DB ─────────────────────────────────────────────────────────────
init_db()

# ── Top bar ───────────────────────────────────────────────────────────────────
col_title, col_btn = st.columns([5, 1])
with col_title:
    st.markdown("## 📬 Inbox Intelligence")
with col_btn:
    if st.button("⟳ Re-classify", use_container_width=True):
        with st.spinner("Running pipeline..."):
            try:
                from data.fetcher import fetch_unread_emails
                from data.store import load_unread_ids
                from pipeline.graph import classify_batch

                emails     = fetch_unread_emails()
                existing   = load_unread_ids()
                new_emails = [e for e in emails if e["id"] not in existing]

                if new_emails:
                    classify_batch(new_emails)
                    st.success(f"Classified {len(new_emails)} new emails.")
                else:
                    st.info("No new unread emails to classify.")
                st.rerun()
            except TimeoutError:
                st.error("⏱️ Gmail API timed out. Check your internet connection and try again.")
            except Exception as exc:
                st.error(f"❌ Re-classification failed: {exc}")

# ── Load data ─────────────────────────────────────────────────────────────────
df = load_all()

if df.empty:
    st.warning("No emails classified yet. Run `python scripts/run.py --fetch-only` first.")
    st.stop()

# ── Sidebar filters ───────────────────────────────────────────────────────────
st.sidebar.markdown("### Filters")

selected_action   = st.sidebar.multiselect(
    "Action intent",
    options=list(ACTION_DISPLAY.keys()),
    format_func=lambda x: ACTION_DISPLAY[x],
    default=list(ACTION_DISPLAY.keys()),
)
selected_dept     = st.sidebar.multiselect(
    "Department",
    options=list(DEPT_DISPLAY.keys()),
    format_func=lambda x: DEPT_DISPLAY[x],
    default=list(DEPT_DISPLAY.keys()),
)
selected_priority = st.sidebar.multiselect(
    "Priority",
    options=list(PRIORITY_DISPLAY.keys()),
    format_func=lambda x: PRIORITY_DISPLAY[x],
    default=list(PRIORITY_DISPLAY.keys()),
)

# Apply filters
filtered_df = df[
    df["action_label"].isin(selected_action) &
    df["dept_label"].isin(selected_dept) &
    df["priority_label"].isin(selected_priority)
]

st.sidebar.markdown("---")
st.sidebar.markdown(f"**Showing:** {len(filtered_df)} of {len(df)} emails")
st.sidebar.markdown(f"**Last sync:** {datetime.now().strftime('%H:%M:%S')}")

# ── Metric row ────────────────────────────────────────────────────────────────
m1, m2, m3, m4, m5 = st.columns(5)
m1.metric("Total emails",     len(filtered_df))
m2.metric("🔴 Urgent",        len(filtered_df[filtered_df["priority_label"] == "URGENT"]))
m3.metric("✅ Action required",len(filtered_df[filtered_df["action_label"]   == "ACTION_REQUIRED"]))
m4.metric("⏳ Awaiting reply", len(filtered_df[filtered_df["action_label"]   == "AWAITING_REPLY"]))
m5.metric("❌ Failed",         len(filtered_df[filtered_df["status"]          == "failed"]))

st.markdown("---")

# ── Charts row ────────────────────────────────────────────────────────────────
ch1, ch2, ch3 = st.columns([1, 1, 1])

with ch1:
    st.plotly_chart(action_bar_chart(filtered_df), use_container_width=True)
with ch2:
    st.plotly_chart(dept_bar_chart(filtered_df), use_container_width=True)
with ch3:
    st.plotly_chart(priority_donut_chart(filtered_df), use_container_width=True)

st.plotly_chart(timeline_bar_chart(filtered_df), use_container_width=True)
st.markdown("---")

# ── Email list ────────────────────────────────────────────────────────────────
st.markdown("### Emails")

sort_col = st.selectbox(
    "Sort by",
    options=["Priority (urgent first)", "Most recent", "Action required first"],
    index=0,
)

PRIORITY_ORDER = {"URGENT": 0, "STANDARD": 1, "LOW_PRIORITY": 2}
ACTION_ORDER   = {"ACTION_REQUIRED": 0, "AWAITING_REPLY": 1, "FYI": 2, "REFERENCE": 3}

if sort_col == "Priority (urgent first)":
    display_df = filtered_df.copy()
    display_df["_sort"] = display_df["priority_label"].map(PRIORITY_ORDER)
    display_df = display_df.sort_values("_sort")
elif sort_col == "Most recent":
    display_df = filtered_df.sort_values("received_at", ascending=False)
else:
    display_df = filtered_df.copy()
    display_df["_sort"] = display_df["action_label"].map(ACTION_ORDER)
    display_df = display_df.sort_values("_sort")


def colour_tag(label: str, colour_map: dict, display_map: dict) -> str:
    colour  = colour_map.get(label, "#888780")
    display = display_map.get(label, label)
    return (
        f'<span class="tag-pill" style="background:{colour}22;color:{colour};'
        f'border:1px solid {colour}44">{display}</span>'
    )


for _, row in display_df.head(100).iterrows():
    action_tag   = colour_tag(row["action_label"],   ACTION_COLOURS,   ACTION_DISPLAY)
    dept_tag     = colour_tag(row["dept_label"],     DEPT_COLOURS,     DEPT_DISPLAY)
    priority_tag = colour_tag(row["priority_label"], PRIORITY_COLOURS, PRIORITY_DISPLAY)

    st.markdown(f"""
    <div class="email-card">
        <div class="email-from">{row['sender']} · {row['sender_email']}</div>
        <div class="email-subject">{row['subject']}</div>
        <div style="margin-top:6px">{action_tag}{dept_tag}{priority_tag}</div>
        <div style="font-size:12px;color:#888;margin-top:6px">{row['reason']}</div>
    </div>
    """, unsafe_allow_html=True)

# ── Raw data expander ─────────────────────────────────────────────────────────
with st.expander("View raw data table"):
    st.dataframe(
        display_df[[
            "subject", "sender", "action_label",
            "dept_label", "priority_label", "reason", "received_at"
        ]].head(200),
        use_container_width=True,
    )

    csv = display_df.to_csv(index=False).encode("utf-8")
    st.download_button(
        label="Download as CSV",
        data=csv,
        file_name="inbox_intel_export.csv",
        mime="text/csv",
    )
