# Deploying to Vercel

## Prerequisites

1. **Vercel Account**: Sign up at [vercel.com](https://vercel.com)
2. **Git Repository**: Push your project to GitHub, GitLab, or Bitbucket
3. **Database**: Set up a PostgreSQL database (recommended for production)
   - Options: Vercel PostgreSQL, AWS RDS, Railway, or Supabase

## Step-by-Step Deployment

### 1. Prepare Your Project

Ensure your project structure is ready:
- `vercel.json` ✓ (already created)
- `.vercelignore` ✓ (already created)
- `requirements.txt` ✓ (should include all dependencies)
- Environment variables configured in `.env.example`

### 2. Set Up Database

Before deploying, provision a PostgreSQL database:

**Option A: Use Vercel PostgreSQL** (Recommended)
- Go to your Vercel dashboard
- Create a new PostgreSQL database
- Copy the `POSTGRES_URL_NON_POOLING` connection string

**Option B: Use an external database**
- Create a PostgreSQL instance on Railway, Supabase, or AWS RDS
- Get the connection string

### 3. Push to Git Repository

```bash
git add .
git commit -m "Add Vercel configuration"
git push origin main
```

### 4. Deploy on Vercel

**Method 1: Using Vercel CLI** (Quickest)

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel

# For production
vercel --prod
```

**Method 2: Using Vercel Dashboard**

1. Go to [vercel.com/dashboard](https://vercel.com/dashboard)
2. Click "Add New..." → "Project"
3. Import your Git repository
4. Configure project settings (keep defaults)
5. Add Environment Variables:
   - `DATABASE_URL`: Your PostgreSQL connection string
   - `SECRET_KEY`: A strong random key (generate: `python -c "import secrets; print(secrets.token_hex(32))"`)
   - `FLASK_ENV`: `production`
6. Click "Deploy"

### 5. Configure Environment Variables

After deployment, set environment variables in Vercel Dashboard:

**Settings** → **Environment Variables**

| Variable | Value |
|----------|-------|
| `DATABASE_URL` | Your PostgreSQL connection string |
| `SECRET_KEY` | Random string (e.g., `openssl rand -hex 32`) |
| `FLASK_ENV` | `production` |

Example DATABASE_URL format:
```
postgresql://user:password@host:5432/dbname
```

### 6. Run Database Migrations (if needed)

After first deployment, you may need to run migrations. You can do this by:

1. **Using a one-time build** (temporary workaround):
   - SSH into Vercel instance (if available) or
   - Run locally: `flask db upgrade` and commit the changes

2. **Better approach**: Create a migration script that runs on app startup (already done in `app.py` with `ensure_schema_updates()`)

## Troubleshooting

### 1. **502 Bad Gateway Error**
- Check database connection string in environment variables
- Verify `SQLALCHEMY_DATABASE_URI` is correctly set
- Check Vercel logs: Dashboard → Project → Deployments → Logs

### 2. **500 Internal Server Error**
- View detailed logs in Vercel dashboard
- Check if SECRET_KEY is set
- Verify database is accessible from Vercel servers

### 3. **Static Files Not Loading**
- Ensure `static/` and `templates/` folders exist
- Check file paths in Flask templates

### 4. **Database Connection Issues**
- Verify DATABASE_URL format
- Check database firewall allows Vercel IPs (if using external DB)
- For Vercel PostgreSQL, use `POSTGRES_URL_NON_POOLING` for long-running connections

## Updating Your App

To deploy new changes:

```bash
git add .
git commit -m "Your message"
git push origin main
```

Vercel automatically redeploys on push to your main branch.

## Additional Resources

- [Vercel Python Support](https://vercel.com/docs/concepts/functions/serverless-functions/runtimes/python)
- [Flask on Vercel](https://vercel.com/templates/python/flask)
- [Environment Variables in Vercel](https://vercel.com/docs/concepts/projects/environment-variables)

## Notes

- Your Flask app will run as serverless functions on Vercel
- Cold starts may take 1-2 seconds (first request after inactivity)
- For production database, PostgreSQL is strongly recommended over SQLite
- The `instance/` directory is not persisted; use external database instead
