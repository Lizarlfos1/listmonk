<template>
  <section class="dashboard-performance">
    <header class="columns is-vcentered">
      <div class="column">
        <h2 class="title is-5">{{ $t('dashboardTop.title') }}</h2>
        <p class="is-size-7 has-text-grey">{{ $t('dashboardTop.subtitle') }}</p>
      </div>
      <div class="column is-narrow">
        <b-field>
          <b-radio-button v-for="d in periods" :key="d" v-model="days" :native-value="d" size="is-small"
            @input="onPeriod">
            {{ $t('dashboardTop.lastDays', { n: d }) }}
          </b-radio-button>
        </b-field>
      </div>
    </header>

    <!-- The coverage line, and the reason the panels can be trusted.
         Five rows per panel cannot add up to the period's money: there is
         revenue nobody clicked for, revenue credited to a broadcast older than
         the scan window, and rows below the cut. Saying so here is what stops
         the panels reading as the whole picture. -->
    <div v-if="data" class="coverage is-size-7 has-text-grey">
      <span>{{ $t('dashboardTop.periodRevenue', { amount: money(data.period_revenue) }) }}</span>
      <span v-if="data.unattributed.purchases">
        {{ $t('dashboardTop.unattributed', {
          amount: money(data.unattributed), n: data.unattributed.purchases,
        }) }}
      </span>
      <span v-if="data.clicks_recorded_since">
        {{ $t('dashboardTop.clicksSince', { date: $utils.niceDate(data.clicks_recorded_since) }) }}
      </span>
      <span v-else>{{ $t('dashboardTop.noClicks') }}</span>
    </div>

    <!-- A plain stack, not a columns grid: every panel is full width, so the
         grid was only contributing its gutters, and those are what pushed the
         three tables a screen apart. -->
    <div class="panels">
      <!-- Sequences -->
      <article class="perf-panel">
        <header class="panel-head">
          <h3 class="title is-size-6">{{ $t('dashboardTop.sequences') }}</h3>
          <router-link :to="{ name: 'sequences' }">{{ $t('dashboardTop.viewAll') }}</router-link>
        </header>
        <b-table :data="data ? data.sequences : []" :loading="loading" hoverable narrowed>
          <b-table-column v-slot="props" field="name" :label="$t('globals.fields.name')">
            <router-link :to="{ name: 'sequence', params: { id: props.row.sequence_id } }">
              {{ props.row.name }}
            </router-link>
          </b-table-column>
          <b-table-column v-slot="props" field="enrollment_mode" :label="$t('sequences.enrollmentMode')"
            width="16%">
            <span class="has-text-grey is-size-7">{{ modeLabel(props.row) }}</span>
          </b-table-column>
          <b-table-column v-slot="props" field="enrolled" :label="$t('dashboardTop.enrolled')" numeric width="10%">
            {{ $utils.niceNumber(props.row.enrolled) }}
          </b-table-column>
          <b-table-column v-slot="props" field="sent" :label="$t('sequences.sent')" numeric width="10%">
            {{ $utils.niceNumber(props.row.sent) }}
          </b-table-column>
          <b-table-column v-slot="props" field="opens" :label="$t('dashboardTop.opens')" numeric width="10%">
            {{ $utils.niceNumber(props.row.opens) }}
          </b-table-column>
          <b-table-column v-slot="props" field="clicks" :label="$t('dashboardTop.clicks')" numeric width="10%">
            {{ $utils.niceNumber(props.row.clicks) }}
          </b-table-column>
          <b-table-column v-slot="props" field="revenue" :label="$t('dashboardTop.revenue')" numeric width="14%">
            <span class="revenue">{{ money(props.row.revenue_last_touch) }}</span>
            <span v-if="props.row.revenue_last_touch.unpriced" class="is-size-7 has-text-grey">
              {{ $t('dashboardTop.unpriced', { n: props.row.revenue_last_touch.unpriced }) }}
            </span>
          </b-table-column>
          <template #empty>
            <p class="has-text-grey is-size-7">{{ $t('dashboardTop.emptySequences') }}</p>
          </template>
        </b-table>
      </article>

      <!-- Broadcasts. Listmonk's own numbers, which is why this panel says so
           and why nothing here is compared with the panel above it. -->
      <article class="perf-panel">
        <header class="panel-head">
          <h3 class="title is-size-6">{{ $t('dashboardTop.broadcasts') }}</h3>
          <router-link :to="{ name: 'campaigns' }">{{ $t('dashboardTop.viewAll') }}</router-link>
        </header>
        <b-notification v-if="data && data.broadcasts_unavailable" type="is-warning" :closable="false" size="is-small">
          {{ $t('dashboardTop.broadcastsUnavailable') }}
        </b-notification>
        <b-table :data="data ? data.broadcasts : []" :loading="loading" hoverable narrowed>
          <b-table-column v-slot="props" field="name" :label="$t('globals.fields.name')">
            <router-link :to="{ name: 'campaign', params: { id: props.row.listmonk_campaign_id } }">
              {{ props.row.name }}
            </router-link>
            <p class="is-size-7 has-text-grey">{{ props.row.subject }}</p>
          </b-table-column>
          <b-table-column v-slot="props" field="sent" :label="$t('sequences.sent')" numeric width="10%">
            {{ $utils.niceNumber(props.row.sent) }}
          </b-table-column>
          <b-table-column v-slot="props" field="views" :label="$t('dashboardTop.views')" numeric width="10%">
            {{ $utils.niceNumber(props.row.views) }}
          </b-table-column>
          <b-table-column v-slot="props" field="clicks" :label="$t('dashboardTop.clicks')" numeric width="10%">
            {{ $utils.niceNumber(props.row.clicks) }}
          </b-table-column>
          <b-table-column v-slot="props" field="revenue" :label="$t('dashboardTop.revenue')" numeric width="18%">
            <!-- Untagged is not zero. A broadcast whose links carry no ss_b
                 tag cannot be measured at all, and showing it as $0 beside a
                 broadcast that genuinely earned nothing would be a lie the
                 page tells silently. -->
            <span v-if="props.row.revenue_measurable" class="revenue">
              {{ money(props.row.revenue_last_touch) }}
            </span>
            <b-tooltip v-else :label="$t('dashboardTop.untaggedHelp')" position="is-left" multilined>
              <span class="has-text-grey is-size-7">{{ $t('dashboardTop.untagged') }}</span>
            </b-tooltip>
          </b-table-column>
          <template #empty>
            <p class="has-text-grey is-size-7">{{ $t('dashboardTop.emptyBroadcasts') }}</p>
          </template>
        </b-table>
      </article>

      <!-- Campaigns: the grouping. Revenue is complete here because it is
           credited through whichever member was clicked last, but the send
           counts cover the sequence side only, which the column label says. -->
      <article class="perf-panel">
        <header class="panel-head">
          <h3 class="title is-size-6">{{ $t('dashboardTop.campaigns') }}</h3>
          <router-link :to="{ name: 'crmCampaigns' }">{{ $t('dashboardTop.viewAll') }}</router-link>
        </header>
        <b-table :data="data ? data.campaigns : []" :loading="loading" hoverable narrowed>
          <b-table-column v-slot="props" field="name" :label="$t('globals.fields.name')">
            <router-link :to="{ name: 'crmCampaign', params: { id: props.row.campaign_id } }">
              {{ props.row.name }}
            </router-link>
            <p v-if="props.row.goal" class="is-size-7 has-text-grey">{{ props.row.goal }}</p>
          </b-table-column>
          <b-table-column v-slot="props" field="members" :label="$t('dashboardTop.members')" width="18%">
            <span class="has-text-grey is-size-7">
              {{ $t('dashboardTop.memberCounts', {
                sequences: props.row.sequence_count, broadcasts: props.row.broadcast_count,
              }) }}
            </span>
          </b-table-column>
          <b-table-column v-slot="props" field="sent" :label="$t('dashboardTop.sentFromSequences')" numeric
            width="16%">
            {{ $utils.niceNumber(props.row.sent_from_sequences) }}
          </b-table-column>
          <b-table-column v-slot="props" field="clicks" :label="$t('dashboardTop.clicks')" numeric width="10%">
            {{ $utils.niceNumber(props.row.clicks_from_sequences) }}
          </b-table-column>
          <b-table-column v-slot="props" field="revenue" :label="$t('dashboardTop.revenue')" numeric width="14%">
            <span class="revenue">{{ money(props.row.revenue_last_touch) }}</span>
          </b-table-column>
          <template #empty>
            <p class="has-text-grey is-size-7">{{ $t('dashboardTop.emptyCampaigns') }}</p>
          </template>
        </b-table>
      </article>
    </div>

    <!-- The basis, in the page and not only in the payload. Every figure in
         the revenue column is last-touch: the last email link a person clicked
         before buying takes the whole amount. Anyone reading a dollar figure
         off a dashboard should be able to see what it claims without asking. -->
    <p class="is-size-7 has-text-grey basis">{{ $t('dashboardTop.basis', { n: windowDays }) }}</p>
  </section>
</template>

<script>
import Vue from 'vue';
import { getCrmDashboardTop } from '../api';
import { stageByID } from '../funnel';

const PREF_KEY = 'dashboard.period';

export default Vue.extend({
  name: 'DashboardPerformance',

  data() {
    return {
      data: null,
      loading: true,
      periods: [7, 30, 90],
      days: this.$utils.getPref(PREF_KEY) || 30,
    };
  },

  computed: {
    windowDays() {
      return this.data ? this.data.measurement.attribution_window_days : 30;
    },
  },

  methods: {
    // Short enough for a column, unlike the sentences on the sequence list
    // itself. A triggered sequence names its rung, because "triggered" on its
    // own does not say what fires it and the rung is the interesting half.
    modeLabel(row) {
      if (row.enrollment_mode === 'triggered') {
        const stage = stageByID(row.trigger_stage);
        return stage ? stage.label : this.$t('dashboardTop.modeTriggered');
      }
      if (row.enrollment_mode === 'continuous') {
        return this.$t('dashboardTop.modeContinuous');
      }
      return this.$t('dashboardTop.modeSnapshot');
    },

    /**
     * Cents to something a human reads, one line per currency.
     *
     * Formatted from the currency the charge was actually made in rather than
     * a fixed symbol: the amounts come from Stripe, and a euro charge rendered
     * with a dollar sign is worse than no figure at all. Multiple currencies
     * are listed rather than converted, because converting needs a rate and a
     * date and this page has neither.
     */
    money(revenue) {
      if (!revenue || revenue.amounts.length === 0) {
        return revenue && revenue.unpriced
          ? this.$t('dashboardTop.pending')
          : this.$t('globals.terms.none');
      }
      return revenue.amounts
        .map((a) => new Intl.NumberFormat(undefined, {
          style: 'currency', currency: a.currency.toUpperCase(),
        }).format(a.net_cents / 100))
        .join(' + ');
    },

    onPeriod(days) {
      this.$utils.setPref(PREF_KEY, days);
      this.load(days);
    },

    async load(days) {
      this.loading = true;
      try {
        this.data = await getCrmDashboardTop({ days });
      } finally {
        this.loading = false;
      }
    },
  },

  mounted() {
    this.load(this.days);
  },
});
</script>
