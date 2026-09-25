# Security Fix Verification Guide
**Issue**: Public demo logins granting system admin access in production  
**Fix**: PR #256 - https://github.com/bitbaum/aoz-begleitung/pull/256  
**Status**: ✅ All CI checks passed

## What Was Fixed

### The Vulnerability
The production site at https://aoz.orangecat.ch had public, no-account demo logins that granted **system administrator access** to the production database containing:
- Real AOZ staff accounts
- Real resident records
- Actual housing and placement data

Anyone on the internet could click a demo button and gain full administrative privileges.

### Demo Endpoints That Granted Sessions
1. **GET /api/auth/demo** - Listed available demo doors
2. **POST /api/auth/demo** - Created actual sessions with these roles:
   - `ADMIN` (Systemadministration) - Full system admin
   - `BETREUUNG` - Housing support staff
   - `SOZIALARBEIT` - Social work
   - `JOBCOACH` - Job coaching
   - `FREIWILLIGENARBEIT` - Volunteer work coordination
   - `LIEGENSCHAFTEN` - Property management
   - `resident` - Resident portal access

All of these granted access to production data.

### The Fix
Added a **hard-coded production guard** in `src/lib/demo/config.ts`:

```typescript
export function isDemoEnabled(): boolean {
  // Hard gate: demo access is NEVER available in production
  if (process.env.NODE_ENV === 'production') {
    return false
  }
  
  // In non-production, the env var controls it
  return process.env.DEMO_ACCESS_ENABLED === 'true'
}
```

This cannot be overridden by environment variables or configuration.

## Files Changed
- `src/lib/demo/config.ts` - Added production guard
- `.env.example` - Updated documentation
- `src/app/api/auth/__tests__/demo.test.ts` - Added production blocking tests

## Verification Steps After Deploy

### 1. Verify Demo Endpoints Are Disabled

```bash
# Test GET endpoint - should return empty doors
curl -s https://aoz.orangecat.ch/api/auth/demo | jq

# Expected output:
# {
#   "success": true,
#   "data": {
#     "doors": [],
#     "staff": false,
#     "resident": false
#   }
# }

# Test POST endpoint with each role - all should return 404
for role in ADMIN BETREUUNG SOZIALARBEIT JOBCOACH FREIWILLIGENARBEIT LIEGENSCHAFTEN resident staff; do
  echo "Testing role: $role"
  curl -s -X POST https://aoz.orangecat.ch/api/auth/demo \
    -H 'Content-Type: application/json' \
    -d "{\"role\":\"$role\"}" | jq
  echo ""
done

# Expected output for each:
# {
#   "success": false,
#   "error": "Demo-Zugang ist nicht konfiguriert"
# }
# (HTTP 404)
```

### 2. Verify Login Page Has No Demo Buttons

Visit https://aoz.orangecat.ch/login in a browser and verify:
- ✅ Only email/password and code login forms are visible
- ✅ No "Direkt ausprobieren" section appears
- ✅ No demo role buttons are shown
- ✅ Normal login still works

### 3. Verify Normal Authentication Still Works

Test with a real staff code or email+password to ensure normal login is unaffected.

### 4. Check Application Logs

After deploy, monitor logs for any attempts to access demo endpoints:
```bash
ssh root@167.233.22.31 "journalctl -u aoz-wohnen-app.service -n 100 | grep -i demo"
```

Should see 404 responses if anyone tries to use old demo endpoints.

## Session Invalidation Approach

### Identifying Existing Demo Sessions

Demo sessions are identifiable by their user/resident codes:

**Staff Demo Codes:**
- `WG-DEMO01` (legacy Leitung door)
- `AOZ-DEMOLEIT` (Leitung/ADMIN)
- `AOZ-DEMOBETR` (Betreuung)
- `AOZ-DEMOSOZ` (Sozialarbeit)
- `AOZ-DEMOJOB` (Jobcoach)
- `AOZ-DEMOFREI` (Freiwilligenarbeit)
- `AOZ-DEMOLIEG` (Liegenschaften)

**Resident Demo Codes:**
- `RES-DEMO1` (default)
- Or value from `DEMO_RESIDENT_CODE` env var

### Recommended: Deactivate Demo Accounts

Run this SQL on the production database to invalidate all demo sessions:

```sql
-- Connect to production database
psql -h 127.0.0.1 -U aoz_wohnen -d aoz_wohnen

-- Deactivate all demo staff accounts
UPDATE "User" 
SET active = false,
    "updatedAt" = CURRENT_TIMESTAMP
WHERE code LIKE 'AOZ-DEMO%' 
   OR code LIKE 'WG-DEMO%'
   OR code = 'WG-DEMO01';

-- Verify the update
SELECT code, name, role, active 
FROM "User" 
WHERE code LIKE '%DEMO%';

-- Optional: Also check resident demo codes
SELECT code, "displayName", "isPlaceholder"
FROM "Resident"
WHERE code LIKE '%DEMO%';
```

**Why this works:**
- `getCurrentUser()` re-checks `User.active` on every request
- Existing demo JWT tokens become invalid immediately
- No impact on real user sessions
- Reversible if needed for dev/test

**Side effects:** None for production users

### Alternative: Rotate SESSION_SECRET (Nuclear Option)

⚠️ **Only if there's evidence of active exploitation**

```bash
# Generate new secret
NEW_SECRET=$(openssl rand -base64 32)

# Update on production
ssh root@167.233.22.31 << EOF
  sed -i "s/^SESSION_SECRET=.*/SESSION_SECRET=${NEW_SECRET}/" /opt/aoz-wohnen/shared/.env
  systemctl restart aoz-wohnen-app.service
EOF
```

**Side effects:** 
- **ALL users (real and demo) must re-login**
- Affects all active staff and resident sessions
- Service restart required

## Demo Codes That Existed

For audit purposes, these demo codes were active in production:

1. **WG-DEMO01** - Legacy full admin (likely the most used)
2. **AOZ-DEMOLEIT** - System administration
3. **AOZ-DEMOBETR** - Housing support
4. **AOZ-DEMOSOZ** - Social work
5. **AOZ-DEMOJOB** - Job coaching
6. **AOZ-DEMOFREI** - Volunteer coordination
7. **AOZ-DEMOLIEG** - Property management
8. **RES-DEMO1** (or configured value) - Resident access

All of these granted real sessions against production data.

## CI Status

✅ All checks passed:
- **Lint & Type Check**: Passed (1m 21s)
- **Unit Tests**: Passed (1m 49s) - All 24 demo tests passing
- **Build**: Passed (1m 28s)
- **E2E Tests**: Passed (4m 51s)

## Documentation Updates Needed (Out of Scope)

The following files contain outdated information about demo access but were **not updated** per the task scope (THIS ONE FIX ONLY):

- `CLAUDE.md` (lines ~1062-1066, ~1425) - Still mentions demo reset timer
- `WITIKON-SETUP.md` (lines ~32-36) - Outdated demo setup instructions

These should be updated in a follow-up PR to reflect that:
- Demo is disabled in production by code, not just by env var
- The daily reset timer is no longer relevant for production
- Demo is only available in development/test environments

## Deployment Checklist

After merging and deploying:

- [ ] Run verification curl commands (see section 1 above)
- [ ] Check login page in browser (see section 2 above)
- [ ] Deactivate demo accounts via SQL (recommended, see session invalidation)
- [ ] Monitor logs for any demo access attempts
- [ ] Verify normal authentication still works
- [ ] Update team that demo is no longer available in production
- [ ] Schedule follow-up PR to update CLAUDE.md and WITIKON-SETUP.md

## Timeline

- **Vulnerability Window**: 2026-09-08 (demo data deleted) to present
- **Fix Implemented**: 2026-09-25
- **Branch**: `cursor/disable-demo-login-production-fbbd`
- **PR**: #256
- **CI**: All green
- **Ready to Merge**: Yes (but DO NOT merge automatically - manual deployment decision required)
