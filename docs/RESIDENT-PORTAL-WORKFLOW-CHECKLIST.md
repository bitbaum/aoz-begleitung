# AOZ Begleitung — Resident Portal Workflow Checklist

Purpose: practical QA/UX checklist for resident-facing workflows.  
Use this as a runbook during testing and sign-off.

created_date: 2026-02-18
last_modified_date: 2026-08-19
last_modified_summary: Clarified portal learning as integration evidence, including self-logged vs staff-recorded entries and richer evidence capture.

Legend:
- [ ] not checked
- [x] checked/passed
- [~] checked with minor issues / code-verified but needs live runtime confirmation
- [!] blocking issue

Pass type below: **Pass 1 = code review + automated checks (lint/tests), no full authenticated browser run**.

---

## 0) Access & Session

- [x] Resident can open `/portal` and sees login/register landing when not authenticated
- [x] Login with valid resident code works
- [x] Invalid code shows clear error message
- [x] Rate-limit message appears correctly on repeated invalid attempts
- [x] Logout works and returns to portal landing
- [x] Session-protected pages redirect correctly when unauthenticated (`/portal/preferences`, `/portal/learning`, `/portal/report`, `/portal/chores`)

---

## 1) Onboarding / First Use (no active placement)

- [~] Resident without active placement sees onboarding/no-placement state (not broken page)
- [~] Onboarding CTA to preferences is visible and usable on mobile
- [~] No-placement support contact message is understandable
- [~] Back navigation from onboarding-related pages works

---

## 2) Dashboard Overview (`/portal`)

- [x] Header and welcome text render correctly
- [x] Language switcher and account dropdown sit in the header
- [x] Prioritization section (`Jetzt / Als Nächstes / Info`) appears and is readable
- [x] Quick actions are visible and tappable (mobile)
- [~] Satisfaction check-in loads and submit triggers, but request remained in loading in this pass and needs re-check
- [x] Current housing card shows core data (address, move-in date, roommates, compatibility)
- [x] House rules chips (quiet hours/smoking/pets) display correctly and link to Regeln
- [x] Care team card renders (empty or with Wohnen / Sozialarbeit / Jobcoach)
- [x] Upcoming appointments render on overview and profile
- [x] Learning is reachable from quick actions
- [x] Roommate names stay on the overview (no separate Mitbewohner page)
- [x] Pending chores preview links to correct task detail
- [x] "Meine Meldungen" shows open/resolved states with clear wording
- [x] Open maintenance preview in building renders if data exists

---

## 3) Report Problem Workflow (`/portal/report`)

### Entry + Guidance
- [x] Emergency notice is visible and understandable
- [x] Transparency helper text (open -> in Bearbeitung -> gelöst) is visible
- [x] Schnellvorlagen are available and clearly labeled

### Fast Templates
- [x] "Dringende Reparatur" prefill works
- [x] "Lärmkonflikt" prefill works
- [x] "Sicherheit" prefill works
- [x] "Vorlage zurücksetzen" resets prefilled values

### Submission Paths
- [x] Maintenance report can be submitted successfully
- [x] Interpersonal report can be submitted successfully
- [x] Validation prevents empty required fields
- [x] Success state includes "Was passiert als Nächstes?"
- [x] Dashboard reflects new report with expected status language

---

## 4) Preferences Workflow (`/portal/preferences`)

- [x] Existing resident values are prefilled correctly
- [x] Lifestyle fields can be changed and saved (API-confirmed)
- [x] Social fields can be changed and saved (API-confirmed)
- [x] Practical fields can be changed and saved (API-confirmed)
- [x] Roommate preference notes can be changed and saved (API-confirmed)
- [x] Sticky mobile save/cancel bar remains visible while scrolling
- [x] Dirty-state hint appears after changes
- [x] Cancel warns on unsaved changes
- [~] Save success feedback is clear

---

## 5) Learning (`/portal/learning`)

- [x] Achievements list completed tests, courses, qualifications and service
- [x] In-progress records show separately
- [x] Resident sees which evidence was logged by them vs by the staff team
- [x] Published language activities appear as offers
- [x] Resident can add their own record (including hours for courses/service)
- [x] Evidence form supports common integration steps (course, language test, volunteering, qualification)
- [x] Evidence form captures optional start and completion dates

## 5b) Care team (overview + profile)

- [x] Resident sees Wohnen / Sozialarbeit / Jobcoach seats
- [x] Empty state tells them staff will assign the team
- [x] Staff can assign seats on the resident file (`/residents/[id]`)

## 5c) Removed destinations

- [x] `/portal/roommates` and `/portal/apartment` redirect to `/portal` (old bookmarks)
- [x] Neither appears in sidebar, tabs, or account menu

---

## 6) Chores Workflow (`/portal/chores`)

### List/Triage
- [~] Category filters work
- [x] Tasks are grouped into "Jetzt wichtig" and "Danach"
- [~] Completed tasks section appears correctly
- [x] Quick-complete works for routine tasks
- [x] Needs-decision tasks show "Details" instead of misleading quick-complete

### Detail + Actions (`/portal/chores/[id]`)
- [x] Mark complete flow works (completion API/data confirmed)
- [x] Request handover flow works
- [x] Attention flag flow works
- [x] Complaint flow works
- [x] Modal UX is usable on mobile (open/close/submit)

### Create
- [x] Create chore (`/portal/chores/new`) works and appears in list (API/list confirmed)

---

## 7) Help & Safety (`/portal/help`)

- [x] Help page content loads and is understandable
- [x] Contact/support actions are visible and usable
- [x] Links to report/preferences work

---

## 8) Cross-Device UX (mobile/tablet/desktop)

- [x] Desktop left nav groups collapse/expand (`<details>`)
- [x] Mobile "Mehr" sheet uses the same groups, without language dump or account/logout
- [~] Tap targets are >=44px on primary actions
- [~] No horizontal overflow observed in tested pages; full device sweep still pending
- [~] Sticky action bars do not hide fields/buttons
- [~] Text contrast and readability are acceptable in all major cards

---

## 9) Reliability & Regression

- [x] `pnpm run lint` passes
- [x] `pnpm test` passes
- [~] No critical console/runtime errors; one expected 400 surfaced during negative validation test
- [~] No regression on admin-facing incident/maintenance data creation from portal submissions

---

## Sign-off

Date: 2026-02-18 (Pass 1 + Pass 2 extended live)
Tester: Anthropig
Environment: local code review + lint/tests + authenticated live browser pass (Chrome relay)

Summary:
- Passed: 54
- Minor/needs live confirmation: 17
- Not checked yet: 0 workflow items (only legend placeholder remains)
- Blockers: 0
- Notes:
  - "Vorlage zurücksetzen" clears prefill but keeps currently selected category form open (likely acceptable, slightly confusing).
  - Some UI submits intermittently showed loading states in relay sessions, but backend/API confirmations succeeded for core flows.
  - One console 400 was observed during intentional negative validation testing (expected behavior, not a product regression).
  - Browser relay intermittency remains an environment risk during long interactive runs.
- Go/No-Go: **Go** for resident portal v1.1 (no critical blocker found).
