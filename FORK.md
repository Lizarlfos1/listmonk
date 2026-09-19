# Sim Sense CRM

A fork of [listmonk](https://github.com/knadh/listmonk) v6.2.0, rebranded and
extended with a native Sequences section for the Sim Sense drip layer.

Upstream remains AGPL-3.0 and so does this. The licence is unchanged and the
`upstream` remote is kept so releases can be merged.

## What differs from upstream

- Branding: wordmark, favicon, browser title, public-page footer.
- A **Sequences** section in the admin, backed by the drip API in
  `../sim-sense-crm/api`.

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
