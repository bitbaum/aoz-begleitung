# UX Audit Findings & Improvement Plan

## Executive Summary

After systematically testing the application workflows, I identified **critical architectural issues** and **UX improvement opportunities**. The main problem is the **flat housing model** that doesn't match real-world hierarchy (Building → Apartment → Room → Bed).

---

## Critical Issues

### 1. Data Model Doesn't Match Reality

**Current Model:**
```
HousingUnit (flat)
  - totalBeds: 4
  - totalRooms: 2
```

**Real World:**
```
Building
  └── Apartment
        └── Room (12m² = 3 beds)
              └── Bed A, B, C
```

**Impact:**
- Can't place someone in a specific bed
- Can't track room-level compatibility
- Can't support medical eligibility (private room vs bed)
- Compatibility scores are unit-level, not roommate-level

**Solution:** See `HOUSING-HIERARCHY-REDESIGN.md`

---

### 2. No Medical Eligibility System

**Current State:**
- Everyone gets matched to units the same way
- No concept of "needs medical docs for private room"

**Real Requirement:**
- Default: Assigned to BED in shared room
- With medical docs: Can get PRIVATE_ROOM or STUDIO

**Solution:**
- Add `hasMedicalDocumentation` to Resident
- Add `requiresMedicalDocs` to PlacementSpot
- Filter matches based on eligibility

---

### 3. Misleading Compatibility Scores

**Example Found:**
- ZH-004 (empty unit) shows "100% compatibility"
- This is meaningless - there are no roommates to be compatible with

**Better Approach:**
- Show "No roommates" instead of 100%
- Only show roommate compatibility when roommates exist
- Explain what scores mean

---

## UX Issues by Page

### Dashboard ✓ Good
- Clear stats (residents, occupancy, incidents)
- Action-oriented quick links
- System health indicators

**Minor improvements:**
- Make stat cards clickable (link to filtered views)
- Add "critical" indicator for urgent items

---

### Residents List ✓ Good
- Card-based layout works well
- Status badges are clear
- Languages shown helpfully

**Issues:**
- No way to delete resident (need edit page)
- No quick "move" action
- No search/filter

**Improvements needed:**
- Add search box
- Add status filter tabs (Active, Placed, All)
- Add "Actions" dropdown on each card

---

### Resident Detail Page
**Not fully tested due to browser issues**

**Expected improvements:**
- Quick action: "Transfer to different unit"
- Quick action: "End placement"
- Medical documentation status
- Eligibility indicator (bed/room/studio)

---

### Housing List ✓ Decent
- Shows occupancy progress bars
- Status badges work
- Conflict indicators visible

**Issues:**
- No hierarchy visualization (just "2 Zimmer")
- Can't see individual beds
- No filter by availability

**Improvements needed:**
- Show room/bed breakdown
- Add availability filter
- Show medical-only spots differently

---

### Housing Detail Page ✓ Good Features
- Compatibility matrix between roommates
- Incident history with tabs
- "Place new resident" button

**Critical Issues:**
- No room/bed visualization
- Can't see which bed each person is in
- No "move resident" quick action
- No way to mark a bed as unavailable

**Improvements needed:**
```
Room Visualization:
├── Zimmer 1 (12m²)
│   ├── 🛏️ Bett A - RES-001
│   ├── 🛏️ Bett B - RES-002
│   └── 🛏️ Bett C - [Frei]
└── Zimmer 2 (8m²)
    ├── 🛏️ Bett A - [Frei]
    └── 🛏️ Bett B - [Frei]
```

---

### Matching Page ✓ Functional
- Shows unplaced residents
- Shows available units with scores
- Shows current roommates

**Issues:**
- Places into UNIT, not specific bed
- 100% score for empty units is misleading
- No eligibility filtering

**Improvements needed:**
1. After selecting unit, show bed selection step
2. Explain empty unit scores differently
3. Filter by medical eligibility
4. Show why each score is what it is

---

### Placement Flow (Transfer/Move)

**Current Process (Too Complex):**
1. Go to resident detail
2. Find current placement
3. End current placement
4. Go to matching page
5. Find resident
6. Select new unit
7. Create placement

**Desired Process (Simple):**
1. Click "Verlegen" (Transfer) on resident
2. See current location
3. See available spots (filtered by eligibility)
4. Click new spot
5. Confirm → Done

---

## Missing Features

### Must Have
1. **Bed-level placement** - Critical for real operations
2. **Medical eligibility** - Required for compliance
3. **Quick transfer** - Common operation, currently painful
4. **Search** - Can't find residents/units easily
5. **Delete/Archive** - Can't remove test data

### Should Have
1. **Bulk operations** - End multiple placements
2. **Filters** - By status, availability, eligibility
3. **Audit log** - Who changed what when
4. **Print/Export** - For offline use

### Nice to Have
1. **Keyboard shortcuts** - Power user efficiency
2. **Notifications** - Alert when conflicts arise
3. **Calendar view** - Placement timeline
4. **Mobile optimization** - Field worker use

---

## Quick Wins (Low Effort, High Impact)

### 1. Add Search
```tsx
// residents/page.tsx
<input
  type="search"
  placeholder="Suchen..."
  className="input"
/>
```

### 2. Make Stats Clickable
```tsx
// Dashboard stats → link to filtered view
<Link href="/residents?status=ACTIVE">
  <StatCard label="Aktiv" value={stats.active} />
</Link>
```

### 3. Add Transfer Button
```tsx
// resident detail page
<button className="btn-outline">
  Verlegen →
</button>
```

### 4. Explain Empty Unit Scores
```tsx
// matching page
{roommates.length === 0 ? (
  <span className="text-gray-500">Keine Mitbewohner</span>
) : (
  <span>{score}% Kompatibilität</span>
)}
```

---

## Implementation Priority

### Phase 1: Data Model (Foundation)
1. Create PlacementSpot model
2. Add medical eligibility to Resident
3. Migrate existing data
4. Update matching logic

### Phase 2: Core UX
1. Room/bed visualization on housing detail
2. Bed selection in placement flow
3. Quick transfer action
4. Search functionality

### Phase 3: Polish
1. Filter improvements
2. Bulk operations
3. Better score explanations
4. Mobile optimization

---

## Config vs Hardcoded Audit

### Currently Hardcoded (Should Be Config)
| Item | Location | Should Be |
|------|----------|-----------|
| Bed capacity calc | - | `CAPACITY_CONFIG.sqmPerBed` |
| Spot types | - | `SPOT_TYPE_CONFIG` |
| Medical doc types | - | `MEDICAL_DOC_CONFIG` |
| Score thresholds | utils | `SCORE_CONFIG.thresholds` |

### Already Config ✓
- Incident types/categories
- Severity levels
- Status labels
- Navigation items

---

## Files to Create/Modify

### New Files
- `src/lib/config/placement-spots.ts` - Spot type config
- `src/lib/config/medical-eligibility.ts` - Medical doc config
- `src/components/housing/RoomVisualization.tsx` - Room/bed tree
- `src/components/placement/TransferFlow.tsx` - Quick transfer

### Modify
- `prisma/schema.prisma` - Add PlacementSpot model
- `src/app/housing/[id]/page.tsx` - Add room visualization
- `src/app/matching/page.tsx` - Add bed selection step
- `src/app/residents/page.tsx` - Add search
- `src/lib/compatibility/` - Update for room-level matching

---

## Summary

The application has a solid foundation but the **flat housing model** is the critical bottleneck. Fixing the data model to support Building → Apartment → Room → Bed hierarchy will:

1. Enable accurate inventory tracking
2. Support medical eligibility requirements
3. Make placements more precise
4. Improve compatibility calculations
5. Enable easy transfers

**Recommended approach:** Implement the hierarchy model first (Phase 1), then build UX improvements on top of it.
