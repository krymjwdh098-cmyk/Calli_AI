# CalliQ ATS — Smart Candidate Ranking & Recruitment System

A modern, streamlined Applicant Tracking System (ATS) that parses candidate resumes, evaluates candidate-job fit using Google Gemini AI, syncs data with Notion databases, and persists records in Neon PostgreSQL.

---

## System Architecture & Flow

```
                     ┌──────────────────────────────┐
                     │     Vercel Unified Host      │
                     │  (Frontend SPA + Express API)│
                     └──────┬───────┬───────┬───────┘
                            │       │       │
       ┌────────────────────┘       │       └───────────────────┐
       ▼                            ▼                           ▼
┌──────────────┐          ┌───────────────────┐       ┌───────────────────┐
│ Google Gemini│          │   Neon PostgreSQL │       │  Notion Database  │
│ Resumes Parsing│        │  Serverless DB    │       │  Auto Sync Engine │
└──────────────┘          └───────────────────┘       └───────────────────┘
```

---

## Core Features

- **CV Parsing & Analysis**: Extract skills, position history, and contact info from PDF and DOCX resumes.
- **AI Match Scoring**: Evaluate candidates against job specifications using Gemini 3.6 Flash.
- **Notion Integration**: Automatically sync shortlisted or hired candidates to your custom Notion workspace database.
- **Neon Database Support**: Serverless PostgreSQL for scalable multi-tenant record persistence.
- **Kanban Recruitment Pipeline**: Track candidates from application to final offer.

---

## Candidate Evaluation Pipeline

```
 [ Candidate CV ] ──► [ Resume Parser (PDF/DOCX) ]
                              │
                              ▼
                     [ Gemini AI Engine ]
                              │
                              ▼
                  [ Candidate Match Score ]
                              │
           ┌──────────────────┴──────────────────┐
           ▼                                     ▼
 [ Pipeline Status Update ]              [ Sync to Notion ]
           │                                     │
           ▼                                     ▼
 [ Neon DB Persistence ]                 [ Workspace Board ]
```

---

## Tech Stack

| Layer | Technology |
| :--- | :--- |
| **Frontend** | React 19, TypeScript, Vite, Tailwind CSS, Lucide Icons, Recharts |
| **Backend** | Express.js, TypeScript, Cors, Multer, Notion HQ SDK |
| **AI / ML** | `@google/genai` (Gemini 3.6 Flash / Flash Lite) |
| **Database** | Neon PostgreSQL (`pg`), In-Memory Store with DB sync |

---

## Environment Configuration

Create a `.env` file in the root directory (refer to `.env.example`):

```env
# Server Configuration
PORT=3000
JWT_SECRET=your_jwt_secret_key

# AI Key
GEMINI_API_KEY=your_google_gemini_api_key

# Notion Integration
NOTION_TOKEN=secret_your_notion_integration_token
NOTION_DATABASE_ID=your_notion_database_id

# Neon Database
DATABASE_URL=postgresql://user:password@ep-xxx.neon.tech/neondb?sslmode=require

# Frontend API Endpoint (for Vercel deployment)
VITE_API_URL=https://your-backend.onrender.com
```

---

## Deployment Guide (Unified Vercel Deployment)

### Vercel (All-in-One Deployment)
1. Import your GitHub repository to **Vercel**.
2. Vercel automatically detects `vercel.json`.
3. Select **Vite** as Framework Preset.
4. Add Environment Variables:
   - `GEMINI_API_KEY`
   - `NOTION_TOKEN`
   - `NOTION_DATABASE_ID`
   - `DATABASE_URL`
   - `JWT_SECRET`
5. Click **Deploy**. Both the frontend SPA and Express API will be live on a single domain!

---

##  License

MIT License — free to modify and deploy for personal or business use.

