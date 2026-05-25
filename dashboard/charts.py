"""
Plotly chart builders for the Streamlit dashboard.
All functions return a plotly Figure object.
"""

import plotly.express as px
import plotly.graph_objects as go
import pandas as pd

from config.settings import (
    ACTION_DISPLAY, DEPT_DISPLAY, PRIORITY_DISPLAY,
    ACTION_COLOURS, DEPT_COLOURS, PRIORITY_COLOURS
)


def action_bar_chart(df: pd.DataFrame) -> go.Figure:
    counts = df["action_label"].value_counts().reset_index()
    counts.columns = ["label", "count"]
    counts["display"] = counts["label"].map(ACTION_DISPLAY)
    counts["colour"]  = counts["label"].map(ACTION_COLOURS)
    counts = counts.sort_values("count", ascending=True)

    fig = go.Figure(go.Bar(
        x=counts["count"],
        y=counts["display"],
        orientation="h",
        marker_color=counts["colour"],
        text=counts["count"],
        textposition="outside",
    ))
    fig.update_layout(
        title="Action intent",
        xaxis_title="",
        yaxis_title="",
        margin=dict(l=10, r=40, t=40, b=10),
        height=240,
        paper_bgcolor="rgba(0,0,0,0)",
        plot_bgcolor="rgba(0,0,0,0)",
        font=dict(size=12),
        showlegend=False,
    )
    fig.update_xaxes(showgrid=False, zeroline=False)
    fig.update_yaxes(showgrid=False)
    return fig


def dept_bar_chart(df: pd.DataFrame) -> go.Figure:
    counts = df["dept_label"].value_counts().reset_index()
    counts.columns = ["label", "count"]
    counts["display"] = counts["label"].map(DEPT_DISPLAY)
    counts["colour"]  = counts["label"].map(DEPT_COLOURS)
    counts = counts.sort_values("count", ascending=True)

    fig = go.Figure(go.Bar(
        x=counts["count"],
        y=counts["display"],
        orientation="h",
        marker_color=counts["colour"],
        text=counts["count"],
        textposition="outside",
    ))
    fig.update_layout(
        title="Department breakdown",
        xaxis_title="",
        yaxis_title="",
        margin=dict(l=10, r=40, t=40, b=10),
        height=280,
        paper_bgcolor="rgba(0,0,0,0)",
        plot_bgcolor="rgba(0,0,0,0)",
        font=dict(size=12),
        showlegend=False,
    )
    fig.update_xaxes(showgrid=False, zeroline=False)
    fig.update_yaxes(showgrid=False)
    return fig


def priority_donut_chart(df: pd.DataFrame) -> go.Figure:
    counts  = df["priority_label"].value_counts().reset_index()
    counts.columns = ["label", "count"]
    counts["display"] = counts["label"].map(PRIORITY_DISPLAY)
    colours = [PRIORITY_COLOURS.get(l, "#888780") for l in counts["label"]]

    fig = go.Figure(go.Pie(
        labels=counts["display"],
        values=counts["count"],
        hole=0.60,
        marker_colors=colours,
        textinfo="label+value",
        hoverinfo="label+value+percent",
    ))
    fig.update_layout(
        title="Priority split",
        margin=dict(l=10, r=10, t=40, b=10),
        height=280,
        paper_bgcolor="rgba(0,0,0,0)",
        showlegend=False,
        annotations=[dict(text=str(len(df)), font_size=22, showarrow=False)],
    )
    return fig


def timeline_bar_chart(df: pd.DataFrame) -> go.Figure:
    """Emails received per day, stacked by priority."""
    df = df.copy()
    df["date"] = pd.to_datetime(df["received_at"], errors="coerce", utc=True).dt.date
    daily = df.groupby(["date", "priority_label"]).size().reset_index(name="count")
    daily["display"] = daily["priority_label"].map(PRIORITY_DISPLAY)

    fig = px.bar(
        daily, x="date", y="count", color="priority_label",
        color_discrete_map=PRIORITY_COLOURS,
        labels={"count": "Emails", "date": "", "priority_label": "Priority"},
        title="Emails by day",
    )
    fig.update_layout(
        height=220,
        margin=dict(l=10, r=10, t=40, b=10),
        paper_bgcolor="rgba(0,0,0,0)",
        plot_bgcolor="rgba(0,0,0,0)",
        legend=dict(orientation="h", y=-0.2),
        barmode="stack",
    )
    fig.update_xaxes(showgrid=False)
    fig.update_yaxes(showgrid=False)
    return fig
