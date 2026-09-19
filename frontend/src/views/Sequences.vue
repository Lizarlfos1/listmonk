<template>
  <section class="sequences content relative">
    <h1 class="title is-4">
      {{ $t('sequences.title') }}
      <span v-if="sequences.length">({{ sequences.length }})</span>
    </h1>

    <b-field grouped>
      <b-select v-model="statusFilter" :placeholder="$t('sequences.filterStatus')">
        <option value="">{{ $t('sequences.allStatuses') }}</option>
        <option value="active">active</option>
        <option value="draft">draft</option>
        <option value="paused">paused</option>
      </b-select>
    </b-field>

    <b-table :data="visible" :loading="loading" hoverable default-sort="created_at">
      <b-table-column v-slot="props" field="name" :label="$t('globals.fields.name')">
        <router-link :to="{ name: 'sequence', params: { id: props.row.id } }">
          {{ props.row.name }}
        </router-link>
        <p v-if="props.row.description" class="is-size-7 has-text-grey">
          {{ props.row.description }}
        </p>
      </b-table-column>

      <b-table-column v-slot="props" field="status" :label="$t('globals.fields.status')" width="8%">
        <b-tag :class="props.row.status">{{ props.row.status }}</b-tag>
      </b-table-column>

      <b-table-column v-slot="props" field="step_count" :label="$t('sequences.steps')" numeric width="7%">
        {{ props.row.step_count }}
      </b-table-column>
      <b-table-column v-slot="props" field="active_count" :label="$t('sequences.activeEnrolments')" numeric width="9%">
        {{ props.row.active_count }}
      </b-table-column>
      <b-table-column v-slot="props" field="completed_count" :label="$t('sequences.completed')" numeric width="9%">
        {{ props.row.completed_count }}
      </b-table-column>
      <b-table-column v-slot="props" field="sent_count" :label="$t('sequences.sent')" numeric width="8%">
        {{ props.row.sent_count }}
      </b-table-column>
      <b-table-column v-slot="props" field="created_at" :label="$t('globals.fields.createdAt')" width="14%">
        {{ $utils.niceDate(props.row.created_at) }}
      </b-table-column>

      <template #empty>
        <empty-placeholder :title="$t('sequences.emptyTitle')" :description="$t('sequences.emptyHelp')" />
      </template>
    </b-table>
  </section>
</template>

<script>
import Vue from 'vue';
import EmptyPlaceholder from '../components/EmptyPlaceholder.vue';
import { getSequences } from '../api';

export default Vue.extend({
  name: 'Sequences',
  components: { EmptyPlaceholder },

  data() {
    return { sequences: [], loading: true, statusFilter: '' };
  },

  computed: {
    // The API already orders active first, then draft, then the rest, and by
    // recency within each. Filtering preserves that, so there is no re-sort.
    visible() {
      if (!this.statusFilter) { return this.sequences; }
      return this.sequences.filter((s) => s.status === this.statusFilter);
    },
  },

  methods: {
    async load() {
      this.loading = true;
      try {
        const data = await getSequences();
        this.sequences = data;
      } finally {
        this.loading = false;
      }
    },
  },

  mounted() { this.load(); },
});
</script>
