<template>
  <section class="crm-campaigns content relative">
    <header class="columns page-header">
      <div class="column is-10">
        <h1 class="title is-4">
          {{ $t('crmCampaigns.title') }}
          <span v-if="campaigns.length">({{ campaigns.length }})</span>
        </h1>
        <p class="has-text-grey">{{ $t('crmCampaigns.description') }}</p>
      </div>
      <div class="column has-text-right">
        <b-button :to="{ name: 'crmCampaign', params: { id: 'new' } }" tag="router-link" class="btn-new"
          type="is-primary" icon-left="plus" data-cy="btn-new">
          {{ $t('crmCampaigns.new') }}
        </b-button>
      </div>
    </header>

    <b-table :data="campaigns" :loading="loading" hoverable default-sort="created_at">
      <b-table-column v-slot="props" field="name" :label="$t('globals.fields.name')">
        <router-link :to="{ name: 'crmCampaign', params: { id: props.row.id } }">
          {{ props.row.name }}
        </router-link>
        <p v-if="props.row.goal" class="is-size-7 has-text-grey">{{ props.row.goal }}</p>
      </b-table-column>

      <b-table-column v-slot="props" field="starts_on" :label="$t('crmCampaigns.startsOn')" width="12%">
        <span v-if="props.row.starts_on">{{ props.row.starts_on }}</span>
        <span v-else class="has-text-grey">{{ $t('globals.terms.none') }}</span>
      </b-table-column>
      <b-table-column v-slot="props" field="ends_on" :label="$t('crmCampaigns.endsOn')" width="12%">
        <span v-if="props.row.ends_on">{{ props.row.ends_on }}</span>
        <span v-else class="has-text-grey">{{ $t('globals.terms.none') }}</span>
      </b-table-column>

      <!-- Two counts, never one total: a broadcast and a sequence are different
           things to have in a campaign, and the split is the useful part. The
           counts come straight from the membership rows, so one may still name
           a broadcast that has since been deleted in listmonk. -->
      <b-table-column v-slot="props" field="sequence_count" :label="$t('crmCampaigns.sequences')" numeric width="10%">
        {{ props.row.sequence_count }}
      </b-table-column>
      <b-table-column v-slot="props" field="broadcast_count" :label="$t('crmCampaigns.broadcasts')" numeric width="10%">
        {{ props.row.broadcast_count }}
      </b-table-column>

      <b-table-column v-slot="props" field="created_at" :label="$t('globals.fields.createdAt')" width="14%">
        {{ $utils.shortDate(props.row.created_at) }}
      </b-table-column>

      <template #empty>
        <empty-placeholder :title="$t('crmCampaigns.emptyTitle')"
          :description="$t('crmCampaigns.emptyHelp')" />
      </template>
    </b-table>
  </section>
</template>

<script>
import Vue from 'vue';
import EmptyPlaceholder from '../components/EmptyPlaceholder.vue';
import { getCrmCampaigns } from '../api';

export default Vue.extend({
  name: 'CrmCampaigns',
  components: { EmptyPlaceholder },

  data() {
    return { campaigns: [], loading: true };
  },

  methods: {
    async load() {
      this.loading = true;
      try {
        this.campaigns = await getCrmCampaigns();
      } finally {
        this.loading = false;
      }
    },
  },

  mounted() { this.load(); },
});
</script>
