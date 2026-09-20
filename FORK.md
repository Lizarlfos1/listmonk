# Sim Sense CRM

A fork of [listmonk](https://github.com/knadh/listmonk) v6.2.0, rebranded and
extended with a native Sequences section for the Sim Sense drip layer.

Upstream remains AGPL-3.0 and so does this. The licence is unchanged and the
`upstream` remote is kept so releases can be merged.

## What differs from upstream

- Branding: wordmark, favicon, browser title, public-page footer.
- A **Sequences** section in the admin, backed by the drip API in
  `../sim-sense-crm/api`.
- A **gallery view on the existing Templates screen**: thumbnails, tags, and
  which sequences send each template. No new section, because templates already
  have one and a second place for them would be worse than the problem.
- A **Campaigns section**: `views/CrmCampaigns.vue` and `views/CrmCampaign.vue`,
  the CRM level that groups broadcasts and sequences. Prefixed `Crm` because
  `Campaigns.vue` is upstream's broadcast screen.
- **Relabelling**: upstream's campaigns are called broadcasts throughout the UI.
  Values in `i18n/en.json` only. No key, route name, API path or column was
  renamed, so the merge surface is one file and the diff is readable.
- **A Funnel page**: `views/Funnel.vue` at `/sequences/funnel`, the second page
  in the Sequences section, with `components/FunnelTriggerDialog.vue`. Master
  and detail: the six rungs of the customer journey on the left, and for the
  selected rung every rule that fires on it, each reading condition → sequence →
  counts → status. Writing a rule is a PATCH on the sequence
  (`enrollment_mode: 'triggered'` plus the stage, condition, optional delay and
  optional narrowing segment), so nothing new can change a sequence's audience
  and an active rule cannot be edited at all. Two mirrors of the CRM's own
  definitions: `src/funnel.js` for the rungs, `src/triggers.js` for the
  conditions. Selecting a rung writes the URL with `history.replaceState`, not
  `$router.replace`, because `App.vue` keys the router-view on `$route.fullPath`
  and a query change would otherwise remount and refetch the page. The conditions actually offered come from `GET /funnel`, so the
  dialog can never offer one the scheduler cannot run.
- **Sequence authoring**: a New sequence button on `views/Sequences.vue`, the
  same from inside the funnel's trigger dialog, and a step editor on
  `views/Sequence.vue` backed by `components/SequenceStepDialog.vue`. The
  template picker offers transactional templates only, because a sequence step
  goes out through `/api/tx` and listmonk refuses anything else there. Clicking a step's
  subject opens it with its rendered body beside the fields
  (`/api/templates/:id/preview` in a sandboxed iframe, the same source the
  gallery thumbnails use), editable on a draft or paused sequence and preview
  only on a live one.
- **Dashboard leaderboards**: `components/DashboardPerformance.vue`, plus one
  line and one import in upstream's `Dashboard.vue`. Three panels, top
  sequences, top broadcasts and top campaigns over 7, 30 or 90 days, served by
  `GET /dashboard/top` in the CRM. They are three panels rather than one table
  because sequence numbers are SES events and broadcast numbers are listmonk's
  own analytics, which are never added or compared; the revenue column is the
  only one that spans them, because it comes from Stripe rather than from
  either sender. The coverage line above the panels is load-bearing, not
  decoration: five rows cannot add up to a period's money, and without it they
  read as though they do.
- **A tracking-tag warning on the broadcast editor**:
  `components/BroadcastTagNotice.vue`, one line in `views/Campaign.vue`. A
  broadcast whose product links carry no `ss_b={{ .Campaign.ID }}` tag cannot
  have revenue credited to it, because listmonk's per-subscriber click log
  lives in its own database and the CRM does not read it. Nothing else in the
  screen would ever say so, and the dashboard shows such a broadcast as not
  measurable rather than as having earned nothing.
- **A new navigation**: `components/NavRail.vue` (new) plus a rewritten
  `components/Navigation.vue` for mobile. Sections are Dashboard, Campaigns,
  Broadcasts, Sequences, Content, Contacts, Settings. Sequences holds two
  pages, the list and the funnel.

`Templates.vue` gained one deep link: `?id=N` opens that template's editor on
mount. There is no route for a single template upstream (the editor is a modal
on the list), and a sequence step's "edit this email" has to land on the email
rather than on a list to hunt through.

Icons come from Listmonk's fontello subset, which is 47 glyphs and not all of
MDI. A name that is not in `frontend/src/assets/icons/fontello.css` renders
blank with no error, so check before choosing.

### The template gallery

`Templates.vue` gains a grid/list switch (grid by default, remembered through
`$utils.setPref`), a type filter and a tag filter. Everything else is in new
files, so the merge surface on that view stays small:

- `components/TemplateGallery.vue`, the cards.
- `components/TemplateUsedBy.vue`, the sequence chips, used by both views.
- `components/TemplateTagsDialog.vue`, the tag editor.

Three things worth knowing before changing them:

- **Thumbnails are `/api/templates/:id/preview` in a scaled iframe**, the same
  source `CampaignPreview.vue` uses full size. There is no screenshot pipeline
  on purpose: nothing extra to run on the mini, and a thumbnail that is the
  template rendered now can never go stale. The iframe is laid out at three
  times the card and scaled back down so the email renders at a desktop-ish
  width rather than triggering its own mobile media queries, and it is
  `sandbox`ed with no permissions and `pointer-events: none`.
- **They load on an IntersectionObserver.** Eight templates would be fine loaded
  at once; eighty would be eighty simultaneous renders of HTML email.
- **Tags and usage come from the CRM**, through `/api/crm/templates/usage` and
  `/api/crm/templates/:id/tags`. The payload deliberately contains no template
  fields: listmonk's own store already holds those, and a second copy is a
  second thing that can disagree with the first.

Nothing here touches listmonk's database. Tags live in the `crm` database in
`template_tags`, keyed on the listmonk template id and joined in the API.

## Keeping up with upstream

```bash
git fetch upstream --tags
git merge v6.3.0          # or whichever release
make dist
```

Conflicts should be confined to the files listed above. Anything else
conflicting is worth a look: it means a change strayed outside the fork's
intended surface, which is the thing that makes a fork expensive.

## Building

Needs Go and yarn.

```bash
make dist     # -> ./listmonk, with the frontend stuffed into the binary
```
