# Organizer Hub Phase 2-4 Specs

## Phase 2: Admissions and Capacity

### Applications Workflow
- Add an applications board with columns: `Pending`, `Accepted`, `Rejected`, `Waitlisted`, `Invited`.
- Add applicant deep profile drawer with:
  - submitted form answers
  - committee preferences
  - participation history/profile link
  - assignment and payment timeline
- Bulk actions:
  - accept/reject/waitlist
  - assign committee and portfolio
  - send invite reminder

### Country/Seat Matrix
- Provide committee x portfolio matrix with live seat status:
  - available = green
  - occupied = red
  - reserved = amber
- Include matrix in organizer dashboard and public conference page.
- Allow quick filters by committee type and seat availability.

### Application Settings
- Per application type toggles:
  - delegate, chair, delegation, organizer
- Form editor for each type:
  - add/edit/remove questions
  - required flags and option sets
- Deadline and pricing controls:
  - early/regular/late phases
  - inline edits with overlap checks

## Phase 3: Operations and Governance

### Delegation Registration
- Delegation owner creates invite link.
- Invitees join delegation but submit and pay individually.
- Organizer sees grouped delegation card with member states:
  - pending members
  - paid members
  - assigned members

### Transactions
- Financial dashboard cards:
  - gross revenue
  - successful payments
  - pending payments
  - refunds
  - net after platform fee
- Transaction list:
  - participant
  - amount
  - status
  - payment time
  - refund actions

### Conference Settings
- Full editable event metadata:
  - title, dates, venue, terms, links, branding
- Partner conference linking:
  - map two conference pages into one grouped event family
- Previous editions:
  - attach 2024/2025 editions with highlights and stats

### Organizer Team
- Invite existing platform users into conference team roles.
- Role templates:
  - Lead Organizer
  - USG
  - Logistics Head
  - Committee Head
- Permission matrix:
  - view-only, applications, finance, settings, publishing

## Phase 4: Reputation and Post-Conference

### Awards Module
- Configure award categories:
  - Best Delegate, High Commendation, Special Mention, custom awards
- Optional prize metadata:
  - prize money
  - sponsor logo
  - award description
- Public conference page shows award structure pre-event.

### Reviews Module
- Post-conference delegate feedback form:
  - star rating
  - written comments
  - category ratings (organization, committees, hospitality)
- Organizer moderation:
  - approve/feature/hide reviews
- Public rendering:
  - selected testimonials at conference page bottom

## Cross-Cutting Technical Requirements
- Role-based authorization for all organizer APIs.
- Auditable activity logs for critical actions (assignments, refunds, settings changes).
- Pagination and server-side filtering for large conferences.
- Analytics consistency rules across local UI summaries and persisted backend data.
