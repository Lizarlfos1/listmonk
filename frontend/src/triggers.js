// The conditions a funnel rule can fire on, for the browser.
//
// A deliberate mirror of api/src/lib/triggers.ts in the CRM repo, exactly as
// funnel.js mirrors its ladder. What lives here is only what the screen needs:
// the id, how to word it, and whether it has a clock. What the condition
// actually selects is the API's business and is never duplicated.
//
// The API serves its own list on GET /funnel (`conditions`), and that list, not
// this one, decides what can be offered: a condition this build has no wording
// for still appears, labelled with the API's own English. The reverse, offering
// a condition the scheduler cannot run, would be a rule that silently never
// fires.
//
// To add one: add its entry here and its wording to i18n/en.json, after adding
// it to the registry in the CRM repo.

export const TRIGGER_CONDITIONS = [
  {
    id: 'entered',
    i18n: 'triggers.entered',
    describe: 'triggers.enteredDescribe',
    needsDelay: false,
  },
  {
    id: 'stalled',
    i18n: 'triggers.stalled',
    describe: 'triggers.stalledDescribe',
    needsDelay: true,
  },
];

const byID = new Map(TRIGGER_CONDITIONS.map((c) => [c.id, c]));

export const conditionByID = (id) => byID.get(id) || null;
