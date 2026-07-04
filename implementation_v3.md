# Medium-Term Roadmap Implementation Plan

This document outlines the technical implementation plan for the **Medium Term** roadmap items:
1. **Support multiple email providers (Outlook, IMAP)**
2. **Add user preferences (default filters, sort order)**
3. **Add custom classification rules (user-defined labels)**

---

## 1. Multiple Email Providers (Outlook, IMAP)

Currently, the app is hardcoded to Google OAuth and Gmail API. We will abstract this into a multi-provider strategy.

### Proposed Changes

#### [NEW] `data/schema.sql` (Migrations)
- Add a new table `connected_accounts`:
  ```sql
  CREATE TABLE connected_accounts (
      id TEXT PRIMARY KEY,
      owner_email TEXT NOT NULL,
      provider TEXT NOT NULL, -- 'gmail', 'outlook', 'imap'
      credentials_json TEXT,  -- Encrypted Fernet string
      created_at TEXT DEFAULT (datetime('now'))
  );
  ```

#### [NEW] `pipeline/providers/` (Directory)
- Create `base.py` defining an abstract `EmailProvider` protocol with methods like `fetch_unread()`, `mark_as_read()`, and `send_reply()`.
- Create `gmail.py`, `outlook.py` (using `msal` and Microsoft Graph API), and `imap.py` (using standard Python `imaplib`).

#### [MODIFY] `data/fetcher.py`
- Modify `fetch_unread_emails()` to query `connected_accounts`, instantiate the correct provider subclass for each account, and aggregate the unread emails from all connected sources.

#### [MODIFY] `react-dashboard/src/Settings.jsx`
- Add an "Accounts" tab to the settings panel allowing users to authorize Microsoft/Outlook via OAuth, or input raw IMAP credentials.

---

## 2. User Preferences

We need a way to persist UI states like dark mode, default dashboards, and default sorting so they survive browser refreshes.

### Proposed Changes

#### [NEW] `data/schema.sql` (Migrations)
- Add a `user_preferences` table:
  ```sql
  CREATE TABLE user_preferences (
      owner_email TEXT PRIMARY KEY,
      default_mode TEXT DEFAULT 'standard',
      default_sort TEXT DEFAULT 'priority',
      dark_mode INTEGER DEFAULT 0
  );
  ```

#### [MODIFY] `api/server.py`
- Add `GET /api/preferences` and `PUT /api/preferences` endpoints to fetch and update these settings.

#### [MODIFY] `react-dashboard/src/App.jsx`
- Fetch `/api/preferences` on initial mount.
- Store preferences in React Context and apply the initial UI state (e.g., forcing the `dark` class on the root HTML element, or defaulting to the HR dashboard).

---

## 3. Custom Classification Rules

Currently, the LLM is restricted to a hardcoded list of categories (e.g., Primary, Promotions, Updates) enforced by a strict Pydantic Enum. We will make this dynamic.

### Proposed Changes

#### [NEW] `data/schema.sql` (Migrations)
- Add a `custom_rules` table:
  ```sql
  CREATE TABLE custom_rules (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      owner_email TEXT,
      label_name TEXT NOT NULL,
      description TEXT NOT NULL,
      is_active INTEGER DEFAULT 1
  );
  ```

#### [MODIFY] `pipeline/prompts.py` & `pipeline/nodes.py`
- Before invoking Ollama, fetch active custom rules from SQLite.
- Dynamically inject the custom rules into the system prompt:
  *"In addition to the standard categories, you may also classify emails into the following custom categories if they match the description: [Label: 'Project X', Description: 'Emails about the Project X launch']."*
- Relax the Pydantic schema in `pipeline/schema.py` from an `Enum` to a standard `str` for the `dept_label`, relying on the prompt instructions to restrict the output to the known list.

#### [NEW] `react-dashboard/src/RulesEngine.jsx`
- Create a new UI panel where users can view, create, edit, and delete their custom labels.
- Provide a form to input the Label Name and the instruction/description given to the LLM.
