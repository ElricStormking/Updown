# Supabase to Local PostgreSQL Migration Plan

## Current State Analysis
- **Already using**: NestJS + Prisma ORM (no changes needed to application code)
- **Supabase usage**: Only as a hosted PostgreSQL database - no Supabase SDK/client
- **Impact**: Configuration-only migration - minimal code changes required

---

## Migration Steps

### Phase 1: PostgreSQL Database Setup

1. Create a new database in local PostgreSQL (port 5433)
2. Create a database user with appropriate permissions
3. Test connectivity

```bash
# Using command line tools from D:\Program Files\PostgreSQL\18\bin
createuser -h localhost -p 5433 -U postgres -P hi_lo_user
createdb -h localhost -p 5433 -U postgres -O hi_lo_user hi_lo_game
psql -h localhost -p 5433 -U postgres -d postgres -c "ALTER ROLE hi_lo_user CREATEDB;"
```

### Phase 2: Configuration Updates

#### 2.1 Update `environment.sample` and `.env`
- Point `DATABASE_URL` at local PostgreSQL (`localhost:5433`, database `hi_lo_game`).
- Remove Supabase-specific variables (optional cleanup):
  - `SUPABASE_URL`
  - `SUPABASE_ANON_KEY`
  - `SUPABASE_SERVICE_ROLE_KEY`

#### 2.2 Update `src/config/env.validation.ts`
- Remove Supabase optional schema validators (lines 10-12)

#### 2.3 Update `src/config/configuration.ts`
- Remove `supabase` configuration block (lines 11-15)

### Phase 3: Database Migration

1. Generate Prisma client: `npm run prisma:generate`
2. Run migrations: `npm run prisma:migrate` or `prisma migrate deploy`
3. Seed database: `npm run db:seed`

### Phase 4: Verification

1. Start the server: `npm run start:dev`
2. Verify database connectivity in logs
3. Test user registration/login endpoints
4. Confirm game functionality works

---

## Files to Modify

| File | Change |
|------|--------|
| `hi-lo-server/.env` | Update DATABASE_URL, remove SUPABASE_* vars |
| `hi-lo-server/environment.sample` | Same as above |
| `hi-lo-server/src/config/env.validation.ts` | Remove SUPABASE_* validators |
| `hi-lo-server/src/config/configuration.ts` | Remove `supabase` config block |

---

## No Changes Required

- Prisma schema (`prisma/schema.prisma`) - already PostgreSQL compatible
- Prisma service (`src/prisma/prisma.service.ts`) - generic implementation
- All service/controller files - use Prisma, not Supabase directly

---

## PostgreSQL Connection Details

- **Host**: localhost
- **Port**: 5433
- **Installation Path**: D:\Program Files\PostgreSQL\18

---

## Estimated Effort

- **Setup time**: ~15 minutes
- **Risk level**: Low (no application logic changes)
