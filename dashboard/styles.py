"""Custom CSS injected into Streamlit."""

CUSTOM_CSS = """
<style>
    /* Remove default top padding */
    .block-container { padding-top: 1rem !important; }

    /* Metric card overrides */
    [data-testid="stMetric"] {
        background: #f8f7f4;
        border-radius: 10px;
        padding: 14px 16px;
        border: 1px solid #e5e3dc;
    }
    [data-testid="stMetricLabel"] { font-size: 12px !important; color: #6b6b6b; }
    [data-testid="stMetricValue"] { font-size: 26px !important; font-weight: 500; }

    /* Tag pill styles */
    .tag-pill {
        display: inline-block;
        font-size: 11px;
        font-weight: 500;
        padding: 2px 9px;
        border-radius: 20px;
        margin-right: 4px;
    }

    /* Email row card */
    .email-card {
        border: 1px solid #e5e3dc;
        border-radius: 10px;
        padding: 12px 16px;
        margin-bottom: 8px;
        background: #ffffff;
    }
    .email-subject { font-weight: 500; font-size: 14px; }
    .email-from    { font-size: 12px; color: #6b6b6b; margin-bottom: 6px; }
</style>
"""
