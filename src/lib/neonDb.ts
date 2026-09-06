import { neon, neonConfig } from '@neondatabase/serverless';

// Configure Neon to fetch securely
neonConfig.fetchConnectionCache = true;

let tablesInitialized = false;
let initPromise: Promise<boolean> | null = null;

export function getNeonConnection() {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    return null;
  }
  try {
    return neon(dbUrl);
  } catch (err) {
    console.error('[Neon DB] Connection error:', err);
    return null;
  }
}

// Automatically initializes PostgreSQL tables schema in Neon if connected
export async function initNeonTables(): Promise<boolean> {
  if (tablesInitialized) return true;
  if (initPromise) return initPromise;

  const sql = getNeonConnection();
  if (!sql) {
    console.log('[Neon DB] No DATABASE_URL provided yet. Running with fast local persistence.');
    return false;
  }

  initPromise = (async () => {
    try {
      console.log('[Neon DB] Initializing Neon PostgreSQL tables schema...');
      
      // 1. Jobs Table
      await sql`
        CREATE TABLE IF NOT EXISTS jobs (
          id SERIAL PRIMARY KEY,
          public_token TEXT UNIQUE NOT NULL,
          org_id INT DEFAULT 1,
          recruiter_id INT DEFAULT 1,
          title TEXT NOT NULL,
          company TEXT NOT NULL,
          description TEXT,
          required_skills JSONB DEFAULT '[]'::jsonb,
          nice_to_have JSONB DEFAULT '[]'::jsonb,
          min_experience INT DEFAULT 0,
          max_experience INT DEFAULT 0,
          education_req TEXT,
          location_req TEXT,
          is_active BOOLEAN DEFAULT TRUE,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
      `;

      // 2. Candidates Table
      await sql`
        CREATE TABLE IF NOT EXISTS candidates (
          id SERIAL PRIMARY KEY,
          org_id INT DEFAULT 1,
          job_id INT REFERENCES jobs(id) ON DELETE SET NULL,
          full_name TEXT NOT NULL,
          email TEXT NOT NULL,
          phone TEXT,
          location TEXT,
          current_position TEXT,
          years_experience INT DEFAULT 0,
          technical_skills JSONB DEFAULT '[]'::jsonb,
          soft_skills JSONB DEFAULT '[]'::jsonb,
          match_score INT DEFAULT 0,
          ats_score INT DEFAULT 0,
          recommendation TEXT,
          category TEXT,
          status TEXT DEFAULT 'Screening',
          pipeline_stage TEXT DEFAULT 'Screening',
          ai_summary TEXT,
          file_name TEXT,
          file_content TEXT,
          applied_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
      `;

      // 3. Users Table
      await sql`
        CREATE TABLE IF NOT EXISTS users (
          id SERIAL PRIMARY KEY,
          org_id INT DEFAULT 1,
          email TEXT UNIQUE NOT NULL,
          full_name TEXT NOT NULL,
          role TEXT DEFAULT 'RECRUITER',
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
      `;

      // Alter any existing columns to TEXT to avoid "value too long for type character varying"
      try {
        await sql`
          ALTER TABLE jobs 
            ALTER COLUMN public_token TYPE TEXT,
            ALTER COLUMN title TYPE TEXT,
            ALTER COLUMN company TYPE TEXT,
            ALTER COLUMN education_req TYPE TEXT,
            ALTER COLUMN location_req TYPE TEXT;
        `;
        await sql`
          ALTER TABLE candidates 
            ALTER COLUMN full_name TYPE TEXT,
            ALTER COLUMN email TYPE TEXT,
            ALTER COLUMN phone TYPE TEXT,
            ALTER COLUMN location TYPE TEXT,
            ALTER COLUMN current_position TYPE TEXT,
            ALTER COLUMN recommendation TYPE TEXT,
            ALTER COLUMN category TYPE TEXT,
            ALTER COLUMN status TYPE TEXT,
            ALTER COLUMN pipeline_stage TYPE TEXT,
            ALTER COLUMN file_name TYPE TEXT;
        `;
        await sql`
          ALTER TABLE users 
            ALTER COLUMN email TYPE TEXT,
            ALTER COLUMN full_name TYPE TEXT,
            ALTER COLUMN role TYPE TEXT;
        `;
      } catch (alterErr) {
        // Safe to ignore if columns are already TEXT or table was freshly created
      }

      console.log('[Neon DB] ✅ PostgreSQL tables initialized successfully on Neon!');
      tablesInitialized = true;
      return true;
    } catch (err) {
      console.error('[Neon DB] Failed to initialize tables on Neon:', err);
      tablesInitialized = false;
      return false;
    } finally {
      initPromise = null;
    }
  })();

  return initPromise;
}

// Syncs state directly to Neon PostgreSQL whenever data changes
export async function deleteCandidateFromNeon(id: number) {
  const sql = getNeonConnection();
  if (!sql) return;
  try {
    await sql`DELETE FROM candidates WHERE id = ${id}`;
  } catch (err) {
    console.error("[Neon DB] Delete error:", err);
  }
}

export async function fetchDataFromNeon(): Promise<{
  jobs: any[];
  candidates: any[];
  users: any[];
} | null> {
  const sql = getNeonConnection();
  if (!sql) return null;

  const ready = await initNeonTables();
  if (!ready) return null;

  try {
    const jobs = await sql`SELECT * FROM jobs ORDER BY id ASC`;
    const candidates = await sql`SELECT * FROM candidates ORDER BY id ASC`;
    const users = await sql`SELECT * FROM users ORDER BY id ASC`;
    return { jobs, candidates, users };
  } catch (err) {
    console.error('[Neon DB] Fetch error:', err);
    return null;
  }
}

export async function syncDataToNeon(data: {
  jobs: any[];
  candidates: any[];
  users: any[];
}) {
  const sql = getNeonConnection();
  if (!sql) return;

  // Guarantee tables exist before performing upserts
  const ready = await initNeonTables();
  if (!ready) return;

  try {
    // Upsert Jobs
    for (const job of data.jobs) {
      await sql`
        INSERT INTO jobs (id, public_token, org_id, recruiter_id, title, company, description, required_skills, nice_to_have, min_experience, max_experience, education_req, location_req, is_active)
        VALUES (${job.id}, ${String(job.public_token || 'token_' + job.id)}, ${job.org_id || 1}, ${job.recruiter_id || 1}, ${String(job.title || '')}, ${String(job.company || '')}, ${String(job.description || '')}, ${JSON.stringify(job.required_skills || [])}, ${JSON.stringify(job.nice_to_have || [])}, ${job.min_experience || 0}, ${job.max_experience || 0}, ${String(job.education_req || '')}, ${String(job.location_req || '')}, ${job.is_active ?? true})
        ON CONFLICT (id) DO UPDATE SET
          title = EXCLUDED.title,
          company = EXCLUDED.company,
          description = EXCLUDED.description,
          required_skills = EXCLUDED.required_skills,
          nice_to_have = EXCLUDED.nice_to_have,
          is_active = EXCLUDED.is_active;
      `;
    }

    // Upsert Candidates
    for (const cand of data.candidates) {
      await sql`
        INSERT INTO candidates (id, org_id, job_id, full_name, email, phone, location, current_position, years_experience, technical_skills, soft_skills, match_score, ats_score, recommendation, category, status, pipeline_stage, ai_summary, file_name, file_content)
        VALUES (${cand.id}, ${cand.org_id || 1}, ${cand.job_id || null}, ${String(cand.full_name || '')}, ${String(cand.email || '')}, ${String(cand.phone || '')}, ${String(cand.location || '')}, ${String(cand.current_position || '')}, ${cand.years_experience || 0}, ${JSON.stringify(cand.technical_skills || [])}, ${JSON.stringify(cand.soft_skills || [])}, ${cand.match_score || 0}, ${cand.ats_score || 0}, ${String(cand.recommendation || '')}, ${String(cand.category || 'POTENTIAL_MATCH')}, ${String(cand.status || 'Screening')}, ${String(cand.pipeline_stage || 'Screening')}, ${String(cand.ai_summary || '')}, ${String(cand.file_name || '')}, ${String(cand.file_content || '')})
        ON CONFLICT (id) DO UPDATE SET
          full_name = EXCLUDED.full_name,
          status = EXCLUDED.status,
          pipeline_stage = EXCLUDED.pipeline_stage,
          category = EXCLUDED.category,
          match_score = EXCLUDED.match_score;
      `;
    }

    // Upsert Users
    // 1. Delete users from Neon that are no longer in the local JSON, or that have mismatched emails
    // (This prevents unique constraint violations if an email changes ID locally)
    const localUserIds = data.users.map(u => u.id);
    const localUserEmails = data.users.map(u => String(u.email || '').trim().toLowerCase());
    
    // Using simple queries because Neon serverless client template literals don't support arrays easily
    const existingNeonUsers = await sql`SELECT id, email FROM users`;
    for (const nu of existingNeonUsers) {
      const isIdLocal = localUserIds.includes(nu.id);
      const isEmailLocal = localUserEmails.includes(String(nu.email || '').trim().toLowerCase());
      
      const localUserWithSameId = data.users.find(u => u.id === nu.id);
      const localUserWithSameEmail = data.users.find(u => String(u.email || '').trim().toLowerCase() === String(nu.email || '').trim().toLowerCase());
      
      if (!isIdLocal || (localUserWithSameEmail && localUserWithSameEmail.id !== nu.id)) {
        await sql`DELETE FROM users WHERE id = ${nu.id}`;
      }
    }

    for (const u of data.users) {
      await sql`
        INSERT INTO users (id, org_id, email, full_name, role)
        VALUES (${u.id}, ${u.org_id || 1}, ${String(u.email || '')}, ${String(u.name || u.full_name || '')}, ${String(u.role || 'RECRUITER')})
        ON CONFLICT (id) DO UPDATE SET
          email = EXCLUDED.email,
          full_name = EXCLUDED.full_name,
          role = EXCLUDED.role;
      `;
    }

    console.log('[Neon DB] ✅ Data synced to Neon PostgreSQL successfully!');
  } catch (err) {
    console.error('[Neon DB] Sync error:', err);
  }
}

export async function testNeonConnection(): Promise<{
  connected: boolean;
  configured: boolean;
  message: string;
  details?: {
    latency_ms?: number;
    uptime_seconds?: number;
    server_time?: string;
    db_name?: string;
    version?: string;
    db_url_masked?: string;
    rest_api_url?: string;
  };
}> {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    return {
      connected: false,
      configured: false,
      message: 'DATABASE_URL environment variable is missing or empty.',
    };
  }

  let dbUrlMasked = 'Configured';
  let restApiUrl = process.env.NEON_REST_API_URL || '';
  try {
    const urlObj = new URL(dbUrl);
    dbUrlMasked = `${urlObj.protocol}//${urlObj.username ? urlObj.username + ':****@' : ''}${urlObj.host}${urlObj.pathname}`;
    if (!restApiUrl && urlObj.hostname) {
      const baseHost = urlObj.hostname.replace('-pooler', '');
      const parts = baseHost.split('.');
      if (parts.length >= 4) {
        const projId = parts[0];
        const domain = parts.slice(1).join('.');
        const dbName = urlObj.pathname.slice(1) || 'neondb';
        restApiUrl = `https://${projId}.apirest.${domain}/${dbName}/rest/v1`;
      }
    }
  } catch {
    dbUrlMasked = dbUrl.slice(0, 15) + '...';
  }

  const sql = getNeonConnection();
  if (!sql) {
    return {
      connected: false,
      configured: true,
      message: 'Failed to initialize Neon connection client.',
      details: { db_url_masked: dbUrlMasked },
    };
  }

  try {
    const start = Date.now();
    const result = await sql`SELECT NOW() as server_time, current_database() as db_name, version() as pg_version;`;
    const latency = Date.now() - start;

    return {
      connected: true,
      configured: true,
      message: 'Successfully connected to Neon PostgreSQL database.',
      details: {
        latency_ms: latency,
        uptime_seconds: Math.floor(process.uptime()),
        server_time: result[0]?.server_time ? String(result[0].server_time) : new Date().toISOString(),
        db_name: result[0]?.db_name ? String(result[0].db_name) : 'neondb',
        version: result[0]?.pg_version ? String(result[0].pg_version).split(' ')[0] : 'PostgreSQL',
        db_url_masked: dbUrlMasked,
        rest_api_url: restApiUrl,
      },
    };
  } catch (err: any) {
    return {
      connected: false,
      configured: true,
      message: `Failed to reach Neon PostgreSQL: ${err?.message || String(err)}`,
      details: { db_url_masked: dbUrlMasked },
    };
  }
}

