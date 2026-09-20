// Where a contact has got to, derived in the browser from the attributes the
// hourly sync writes onto each Listmonk subscriber.
//
// This is a deliberate mirror of api/src/lib/funnel.ts in the CRM repo. It is
// duplicated rather than fetched because the subscribers screen already has
// every row's attribs in hand: deriving the stage here costs nothing, while
// asking the CRM for it would mean a second request per page to compute
// something already sitting in the response.
//
// The cost of a mirror is that it can drift. If you change a rung, change it in
// both places, and keep the order identical: the ranks are compared, not just
// displayed.

export const FUNNEL_STAGES = [
  { id: 'signed_up', rank: 0, i18n: 'funnel.signedUp' },
  { id: 'survey_done', rank: 1, i18n: 'funnel.surveyDone' },
  { id: 'iracing_connected', rank: 2, i18n: 'funnel.iracingConnected' },
  { id: 'agent_installed', rank: 3, i18n: 'funnel.agentInstalled' },
  { id: 'telemetry_uploaded', rank: 4, i18n: 'funnel.telemetryUploaded' },
  { id: 'purchased', rank: 5, i18n: 'funnel.purchased' },
];

const byID = new Map(FUNNEL_STAGES.map((s) => [s.id, s]));

export const stageByID = (id) => byID.get(id) || null;

export const stageRank = (id) => (byID.has(id) ? byID.get(id).rank : -1);

// Truthy in the loose sense the feed uses: real booleans, and the strings
// Supabase sometimes returns in their place.
const isTrue = (v) => v === true || (typeof v === 'string' && v.toLowerCase() === 'true');

const isPositive = (v) => Number.isFinite(Number(v)) && Number(v) > 0;

const isPresent = (v) => v !== null && v !== undefined && v !== '';

// Highest rung reached, not most recent: the attributes are a snapshot and the
// rungs are not exclusive, since someone who bought still has their telemetry.
export function deriveStage(attribs) {
  const a = attribs || {};

  if (isTrue(a.has_active_purchase)) return 'purchased';
  if (isPositive(a.telemetry_sessions) || isPositive(a.telemetry_laps)) return 'telemetry_uploaded';
  if (isPresent(a.agent_last_seen)) return 'agent_installed';
  if (isTrue(a.iracing_connected)) return 'iracing_connected';
  if (isTrue(a.survey_completed)) return 'survey_done';
  return 'signed_up';
}

// Listmonk's advanced search box takes raw SQL against its own subscribers
// table, which is how a stage filter can be applied across the whole result set
// rather than to whichever page happens to be loaded. Each expression matches
// exactly one rung, so it has to exclude the rungs above it: without that,
// filtering to "agent installed" would also return everyone who has since
// bought, and the funnel counts would overlap instead of partitioning.
const PURCHASED = "coalesce((subscribers.attribs->>'has_active_purchase')::boolean, false)";
const TELEMETRY = "(coalesce((subscribers.attribs->>'telemetry_sessions')::numeric, 0) > 0 "
  + "or coalesce((subscribers.attribs->>'telemetry_laps')::numeric, 0) > 0)";
const IRACING = "coalesce((subscribers.attribs->>'iracing_connected')::boolean, false)";
const AGENT = "nullif(subscribers.attribs->>'agent_last_seen', '') is not null";
const SURVEY = "coalesce((subscribers.attribs->>'survey_completed')::boolean, false)";

const QUERIES = {
  purchased: PURCHASED,
  telemetry_uploaded: `not ${PURCHASED} and ${TELEMETRY}`,
  agent_installed: `not ${PURCHASED} and not ${TELEMETRY} and ${AGENT}`,
  iracing_connected: `not ${PURCHASED} and not ${TELEMETRY} and not ${AGENT} and ${IRACING}`,
  survey_done: `not ${PURCHASED} and not ${TELEMETRY} and not ${AGENT} and not ${IRACING} and ${SURVEY}`,
  signed_up: `not ${PURCHASED} and not ${TELEMETRY} and not ${AGENT} and not ${IRACING} and not ${SURVEY}`,
};

export const stageQuery = (id) => QUERIES[id] || null;
