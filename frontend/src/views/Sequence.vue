<template>
  <section class="sequence content relative">
    <router-link :to="{ name: 'sequences' }" class="is-size-7">
      <b-icon icon="arrow-left" size="is-small" /> {{ $t('sequences.title') }}
    </router-link>

    <header class="columns is-vcentered" v-if="seq">
      <div class="column">
        <h1 class="title is-4">
          {{ seq.name }} <b-tag :class="seq.status">{{ seq.status }}</b-tag>
        </h1>
        <p v-if="seq.description" class="has-text-grey">{{ seq.description }}</p>
      </div>
      <div class="column has-text-right">
        <b-button v-if="seq.status === 'draft' || seq.status === 'paused'"
                  type="is-primary" icon-left="check" @click="openApprove">
          {{ seq.status === 'paused' ? $t('sequences.resume') : $t('sequences.approve') }}
        </b-button>
        <b-button v-else-if="seq.status === 'active'" type="is-light" icon-left="pause"
                  :loading="pausing" @click="pause">
          {{ $t('sequences.pause') }}
        </b-button>
      </div>
    </header>

    <div class="columns" v-if="seq">
      <div class="column is-half">
        <div class="box">
          <h3 class="is-size-7 has-text-grey is-uppercase">{{ $t('sequences.segment') }}</h3>
          <pre v-if="seq.segment_query" class="segment">{{ seq.segment_query }}</pre>
          <p v-else class="has-text-grey is-italic">{{ $t('sequences.noSegment') }}</p>
        </div>
      </div>
      <div class="column is-half">
        <div class="box">
          <h3 class="is-size-7 has-text-grey is-uppercase">{{ $t('sequences.provenance') }}</h3>
          <p v-if="seq.activated_at">{{ $t('sequences.activated') }}: {{ $utils.niceDate(seq.activated_at, true) }}</p>
          <p v-if="seq.approved_by">{{ $t('sequences.approvedBy') }}: {{ seq.approved_by }}</p>
          <p v-if="!seq.activated_at && !seq.approved_by" class="has-text-grey is-italic">
            {{ $t('sequences.neverApproved') }}
          </p>
        </div>
      </div>
    </div>

    <h2 class="title is-6">
      {{ $t('sequences.steps') }}
      <span class="has-text-grey has-text-weight-normal is-size-7">{{ $t('sequences.dayOffsetHelp') }}</span>
    </h2>

    <b-table :data="steps" :loading="loading" hoverable>
      <b-table-column v-slot="props" field="day_offset" :label="$t('sequences.day')" width="6%" numeric>
        {{ props.row.day_offset }}
      </b-table-column>
      <b-table-column v-slot="props" field="subject" :label="$t('sequences.subject')">
        <strong>{{ props.row.subject }}</strong>
        <p v-if="props.row.label" class="is-size-7 has-text-grey">{{ props.row.label }}</p>
      </b-table-column>
      <b-table-column v-slot="props" field="sent_count" :label="$t('sequences.sent')" numeric width="9%">
        {{ props.row.sent_count }}
      </b-table-column>
      <b-table-column v-slot="props" field="failed_count" :label="$t('sequences.failed')" numeric width="9%">
        <span :class="{ 'has-text-danger': props.row.failed_count > 0 }">{{ props.row.failed_count }}</span>
      </b-table-column>
      <b-table-column v-slot="props" :label="$t('sequences.copy')" width="12%">
        <!-- The copy lives in listmonk as a template and is edited there, which
             is now a normal in-app link rather than a jump to another tool. -->
        <router-link :to="{ name: 'template', params: { id: props.row.listmonk_template_id } }">
          #{{ props.row.listmonk_template_id }}
        </router-link>
      </b-table-column>

      <template #empty>
        <empty-placeholder :title="$t('sequences.noStepsTitle')" :description="$t('sequences.noStepsHelp')" />
      </template>
    </b-table>

    <h2 class="title is-6" v-if="stats.length">{{ $t('sequences.stats') }}</h2>
    <b-table v-if="stats.length" :data="stats" hoverable>
      <b-table-column v-slot="props" :label="$t('sequences.day')" numeric width="6%">{{ props.row.day_offset }}</b-table-column>
      <b-table-column v-slot="props" :label="$t('sequences.subject')">{{ props.row.label || props.row.subject }}</b-table-column>
      <b-table-column v-slot="props" :label="$t('sequences.sent')" numeric>{{ props.row.sent }}</b-table-column>
      <b-table-column v-slot="props" :label="$t('sequences.delivered')" numeric>{{ props.row.delivered }}</b-table-column>
      <b-table-column v-slot="props" :label="$t('sequences.opens')" numeric>{{ props.row.opens }}</b-table-column>
      <b-table-column v-slot="props" :label="$t('sequences.clicks')" numeric>{{ props.row.clicks }}</b-table-column>
      <b-table-column v-slot="props" :label="$t('globals.terms.bounces')" numeric>
        <span :class="{ 'has-text-warning-dark': props.row.bounces > 0 }">{{ props.row.bounces }}</span>
      </b-table-column>
      <b-table-column v-slot="props" :label="$t('sequences.complaints')" numeric>
        <span :class="{ 'has-text-danger': props.row.complaints > 0 }">{{ props.row.complaints }}</span>
      </b-table-column>
    </b-table>

    <approve-dialog v-if="seq" :is-open.sync="approveOpen" :sequence="seq" @approved="onApproved" />
  </section>
</template>

<script>
import Vue from 'vue';
import EmptyPlaceholder from '../components/EmptyPlaceholder.vue';
import ApproveDialog from '../components/ApproveDialog.vue';
import { getSequence, getSequenceStats, pauseSequence } from '../api';

export default Vue.extend({
  name: 'Sequence',
  components: { EmptyPlaceholder, ApproveDialog },

  data() {
    return {
      seq: null, steps: [], stats: [], loading: true, pausing: false, approveOpen: false,
    };
  },

  methods: {
    async load() {
      this.loading = true;
      try {
        const data = await getSequence(this.$route.params.id);
        this.seq = data;
        this.steps = data.steps || [];
        const s = await getSequenceStats(this.$route.params.id);
        this.stats = (s || []).filter((r) => r.sent > 0);
      } finally {
        this.loading = false;
      }
    },

    openApprove() { this.approveOpen = true; },

    async pause() {
      this.pausing = true;
      try {
        await pauseSequence(this.$route.params.id);
        // Worth saying out loud: pausing is not cancelling, and the difference
        // only shows up when it is resumed.
        this.$utils.toast(this.$t('sequences.pausedToast'));
        this.load();
      } finally {
        this.pausing = false;
      }
    },

    onApproved() { this.load(); },
  },

  mounted() { this.load(); },
});
</script>
