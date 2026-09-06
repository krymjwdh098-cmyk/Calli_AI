# Persistent System Guidelines & User Directives

## 1. Database State & Multi-Account Isolation Rule (CRITICAL)
- **Always preserve user-driven modifications, deletions, and additions across all HR accounts (`admin`, `hr`, `hr2`, `hr3`, `hr4`, `hr5`, `hr6`, `hr7`, `cillkareem`).**
- **NEVER overwrite, re-seed, or restore deleted CVs/candidates/jobs** that the user or HR deleted or modified.
- **Before making any architectural or backend change:** Always read the current state of `data/database.json` and ensure that all existing accounts, jobs, and candidates are strictly preserved.
- When server restarts or updates occur, load directly from `data/database.json` without injecting default or mock data into existing accounts.

## 2. Real-Time Sync & Multi-Tenant Persistence
- All HR accounts operate in strict multi-tenant isolation with persistent disk & cloud backup.
- Any deletion (`DELETE /api/v1/candidates/:id`), addition, status change, or pipeline movement is final and must never be undone by automated mock initialization.
