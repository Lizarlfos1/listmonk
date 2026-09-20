<template>
  <section class="sequences content relative">
    <header class="columns page-header">
      <div class="column is-9">
        <h1 class="title is-4">
          {{ $t('sequences.title') }}
          <span v-if="sequences.length">({{ sequences.length }})</span>
        </h1>
      </div>
      <div class="column has-text-right">
        <b-button type="is-primary" icon-left="plus" class="btn-new" data-cy="btn-new" @click="newSequence">
          {{ $t('sequences.new') }}
        </b-button>
      </div>
    </header>

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

      <b-table-column v-slot="props" field="status" :label="$t('globals.fields.status')" width="10%">
        <b-tag :class="props.row.status">{{ props.row.status }}</b-tag>
        <!-- A continuous sequence is still acquiring people, which the status
             tag alone does not say: active means the same word for both. The
             marker is an icon so the row keeps its shape, and the tooltip
             carries the sentence that explains it. -->
        <b-tooltip :label="modeLabel(props.row)" multilined position="is-right">
          <b-tag class="ml-1"
                 :type="props.row.enrollment_mode === 'continuous' ? 'is-info' : 'is-light'">
            <b-icon :icon="props.row.enrollment_mode === 'continuous' ? 'refresh' : 'clock-start'"
                    size="is-small" />
          </b-tag>
        </b-tooltip>
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
        {{ $utils.shortDate(props.row.created_at) }}
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
import { createSequence, getSequences } from '../api';

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
    // Name it here, decide everything else on its own page. A sequence is
    // created as a draft that sends nothing, so the only thing that has to be
    // true at this point is that it has a name to find it by.
    newSequence() {
      const onName = async (name) => {
        if (!name || !name.trim()) { return; }
        try {
          const created = await createSequence({ name: name.trim() });
          this.$router.push({ name: 'sequence', params: { id: created.id } });
        } catch (e) {
          this.$utils.toast((e.response && e.response.data && e.response.data.error) || e.message, 'is-danger');
        }
      };

      this.$utils.prompt(
        this.$t('sequences.newPrompt'),
        { placeholder: this.$t('sequences.newPlaceholder') },
        onName,
      );
    },

    modeLabel(row) {
      return row.enrollment_mode === 'continuous'
        ? this.$t('sequences.enrollmentModeContinuous')
        : this.$t('sequences.enrollmentModeSnapshot');
    },

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
