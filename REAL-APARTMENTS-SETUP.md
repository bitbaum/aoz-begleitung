# Real apartment setup

created_date: 2026-01-24
last_modified_date: 2026-10-19
last_modified_summary: Renamed from a file named after a street. The apartment data moved out of git into a local config file; this page says where it goes and how to seed from it.

The repo is public, so it must not name a real flat or the people in it. The
apartment data (address, unit code, rooms, who sleeps where) lives in a local
file that git ignores. Login codes are generated at seed time and printed once;
they are never stored in that file or anywhere else.

## 1. Put the config where the scripts look

```bash
cp scripts/db/real/apartments.example.json scripts/db/real/apartments.local.json
# replace the invented values with the real ones
```

Or keep the file anywhere else and point at it:

```bash
export REAL_APARTMENTS_FILE=~/private/aoz-apartments.json
```

`scripts/db/real/types.ts` documents the shape, and `scripts/db/real/load.ts`
validates it: every resident must name a room that exists, and no room may hold
more people than beds. Two lists:

- `real`: flats with real people in them, seeded by `scripts/db/seed-real.ts`.
- `placeholders`: real AOZ flats seeded with claimable placeholder profiles by
  `scripts/db/seed-placeholders.ts`. Leave a bed free in at least one of them.

## 2. Seed

Point `DATABASE_URL` at the database you mean (see
[docs/INFRASTRUCTURE.md](docs/INFRASTRUCTURE.md)), then:

```bash
npx ts-node -r tsconfig-paths/register --compiler-options '{"module":"CommonJS"}' scripts/db/seed-real.ts
npx ts-node -r tsconfig-paths/register --compiler-options '{"module":"CommonJS"}' scripts/db/seed-placeholders.ts --dry-run
```

Both scripts skip a flat that already has active placements, so a re-run never
duplicates anybody. Without a config file they stop and say where to put it.
Hand out the printed codes; they are shown once.
