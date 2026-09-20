<template>
  <section class="crm-campaign content relative">
    <router-link :to="{ name: 'crmCampaigns' }" class="is-size-7">
      <b-icon icon="arrow-left" size="is-small" /> {{ $t('crmCampaigns.title') }}
    </router-link>

    <header class="columns is-vcentered">
      <div class="column">
        <h1 class="title is-4">
          {{ isNew ? $t('crmCampaigns.new') : form.name }}
        </h1>
        <p v-if="!isNew && form.goal" class="has-text-grey">{{ form.goal }}</p>
      </div>
      <div class="column has-text-right" v-if="!isNew">
        <b-button type="is-light" icon-left="trash-can-outline" @click="confirmDelete" data-cy="btn-delete">
          {{ $t('globals.buttons.delete') }}
        </b-button>
      </div>
    </header>

    <form @submit.prevent="save">
      <div class="box">
        <b-field :label="$t('globals.fields.name')" label-position="on-border">
          <b-input v-model="form.name" name="name" required maxlength="200" data-cy="name" />
        </b-field>
        <b-field :label="$t('crmCampaigns.goal')" label-position="on-border">
          <b-input v-model="form.goal" name="goal" type="textarea" rows="2" data-cy="goal" />
        </b-field>
        <b-field grouped>
          <!-- Native date inputs, because the API speaks YYYY-MM-DD strings in
               both directions and a picker that hands back a Date object would
               have to be converted back on every save. -->
          <b-field :label="$t('crmCampaigns.startsOn')" label-position="on-border" expanded>
            <b-input v-model="form.starts_on" type="date" name="starts_on" data-cy="starts-on" />
          </b-field>
          <b-field :label="$t('crmCampaigns.endsOn')" label-position="on-border" expanded>
            <b-input v-model="form.ends_on" type="date" name="ends_on" data-cy="ends-on" />
          </b-field>
        </b-field>
        <b-button native-type="submit" type="is-primary" :loading="saving" data-cy="btn-save">
          {{ isNew ? $t('globals.buttons.new') : $t('globals.buttons.saveChanges') }}
        </b-button>
      </div>
    </form>

    <template v-if="!isNew">
      <h2 class="title is-6">{{ $t('crmCampaigns.members') }}</h2>

      <div class="columns">
        <div class="column is-half">
          <div class="box">
            <div class="columns is-vcentered is-mobile">
              <div class="column">
                <h3 class="is-size-7 has-text-grey is-uppercase">{{ $t('crmCampaigns.sequences') }}</h3>
              </div>
              <div class="column has-text-right">
                <b-button size="is-small" icon-left="plus" @click="openAdd('sequence')" data-cy="btn-add-sequence">
                  {{ $t('crmCampaigns.addSequence') }}
                </b-button>
              </div>
            </div>

            <b-table :data="sequences" :loading="loading" hoverable>
              <b-table-column v-slot="props" :label="$t('globals.fields.name')">
                <router-link :to="{ name: 'sequence', params: { id: props.row.sequence_id } }">
                  {{ props.row.name }}
                </router-link>
              </b-table-column>
              <b-table-column v-slot="props" :label="$t('globals.fields.status')" width="30%">
                <b-tag :class="props.row.status">{{ props.row.status }}</b-tag>
                <!-- Continuous enrolment is not visible in the status word, and
                     a campaign is exactly where someone asks whether a member is
                     still acquiring people. -->
                <b-tooltip v-if="props.row.enrollment_mode" :label="modeLabel(props.row)" multilined position="is-left">
                  <b-tag class="ml-1" :type="props.row.enrollment_mode === 'continuous' ? 'is-info' : 'is-light'">
                    <b-icon :icon="props.row.enrollment_mode === 'continuous' ? 'refresh' : 'clock-start'"
                      size="is-small" />
                  </b-tag>
                </b-tooltip>
              </b-table-column>
              <b-table-column v-slot="props" :label="$t('crmCampaigns.addedAt')" width="22%">
                {{ $utils.shortDate(props.row.added_at) }}
              </b-table-column>
              <b-table-column v-slot="props" width="8%">
                <a href="#" @click.prevent="removeMember(props.row.member_id, props.row.name)"
                  :aria-label="$t('globals.buttons.remove')">
                  <b-icon icon="close" size="is-small" />
                </a>
              </b-table-column>
              <template #empty>
                <p class="has-text-grey is-italic">{{ $t('crmCampaigns.noMembers') }}</p>
              </template>
            </b-table>
          </div>
        </div>

        <div class="column is-half">
          <div class="box">
            <div class="columns is-vcentered is-mobile">
              <div class="column">
                <h3 class="is-size-7 has-text-grey is-uppercase">{{ $t('crmCampaigns.broadcasts') }}</h3>
              </div>
              <div class="column has-text-right">
                <b-button v-if="$can('campaigns:get')" size="is-small" icon-left="plus" @click="openAdd('broadcast')"
                  data-cy="btn-add-broadcast">
                  {{ $t('crmCampaigns.addBroadcast') }}
                </b-button>
              </div>
            </div>

            <b-table :data="broadcasts" :loading="loading" hoverable>
              <b-table-column v-slot="props" :label="$t('globals.fields.name')">
                <router-link :to="{ name: 'campaign', params: { id: props.row.listmonk_campaign_id } }">
                  {{ props.row.name || `#${props.row.listmonk_campaign_id}` }}
                </router-link>
                <!-- A broadcast listmonk could not be read stays in place with
                     its reason. Dropping the row would make a campaign look
                     smaller than it is because of an outage somewhere else. -->
                <p v-if="props.row.stats_unavailable" class="is-size-7 has-text-warning-dark">
                  {{ $t('crmCampaigns.statsUnavailable') }}
                  <span v-if="props.row.reason">{{ props.row.reason }}</span>
                </p>
                <p v-else-if="props.row.subject" class="is-size-7 has-text-grey">{{ props.row.subject }}</p>
              </b-table-column>
              <b-table-column v-slot="props" :label="$t('globals.fields.status')" width="26%">
                <b-tag v-if="!props.row.stats_unavailable" :class="props.row.status">
                  {{ $t(`campaigns.status.${props.row.status}`) }}
                </b-tag>
              </b-table-column>
              <b-table-column v-slot="props" :label="$t('crmCampaigns.addedAt')" width="22%">
                {{ $utils.shortDate(props.row.added_at) }}
              </b-table-column>
              <b-table-column v-slot="props" width="8%">
                <a href="#"
                  @click.prevent="removeMember(props.row.member_id, props.row.name || `#${props.row.listmonk_campaign_id}`)"
                  :aria-label="$t('globals.buttons.remove')">
                  <b-icon icon="close" size="is-small" />
                </a>
              </b-table-column>
              <template #empty>
                <p class="has-text-grey is-italic">{{ $t('crmCampaigns.noMembers') }}</p>
              </template>
            </b-table>
          </div>
        </div>
      </div>

      <template v-if="stats">
        <h2 class="title is-6">{{ $t('crmCampaigns.stats') }}</h2>

        <!-- The one figure that spans both systems, and the only one that may.
             It is a count of messages sent, which both systems record the same
             way; nothing below it is combined. -->
        <div class="box">
          <p class="is-size-7 has-text-grey is-uppercase">{{ $t('crmCampaigns.totalSent') }}</p>
          <p class="title is-3">{{ stats.totals.sent.value }}</p>
          <p class="is-size-7 has-text-grey">
            {{ $t('crmCampaigns.sourceSes') }}: {{ stats.totals.sent.from_sequences }}
            &middot;
            {{ $t('crmCampaigns.sourceListmonk') }}: {{ stats.totals.sent.from_broadcasts }}
          </p>
          <!-- Shown wherever the total is shown, because the total is short by
               exactly these broadcasts and a reader has no other way to tell. -->
          <b-notification v-if="stats.totals.broadcasts_unavailable" type="is-warning" :closable="false" class="mt-2">
            {{ $t('crmCampaigns.broadcastsUnavailable', { n: stats.totals.broadcasts_unavailable }) }}
          </b-notification>
        </div>

        <b-notification type="is-info" :closable="false">{{ $t('crmCampaigns.noBlendedRates') }}</b-notification>

        <!-- Side by side and separately headed, so there is no row, column or
             subtotal in which a listmonk figure and an SES figure could be read
             as parts of one number. -->
        <div class="columns">
          <div class="column is-half">
            <h3 class="is-size-7 has-text-grey is-uppercase">
              {{ $t('crmCampaigns.sequences') }} &middot; {{ $t('crmCampaigns.sourceSes') }}
            </h3>
            <b-table :data="stats.sequences" hoverable>
              <b-table-column v-slot="props" :label="$t('globals.fields.name')">
                <router-link :to="{ name: 'sequence', params: { id: props.row.sequence_id } }">
                  {{ props.row.name }}
                </router-link>
              </b-table-column>
              <b-table-column v-slot="props" :label="$t('sequences.sent')" numeric>{{ props.row.sent }}</b-table-column>
              <b-table-column v-slot="props" :label="$t('sequences.failed')" numeric>
                <span :class="{ 'has-text-danger': props.row.failed > 0 }">{{ props.row.failed }}</span>
              </b-table-column>
              <b-table-column v-slot="props" :label="$t('sequences.delivered')" numeric>
                {{ props.row.delivered }}
              </b-table-column>
              <b-table-column v-slot="props" :label="$t('sequences.opens')" numeric>{{ props.row.opens }}</b-table-column>
              <b-table-column v-slot="props" :label="$t('sequences.clicks')" numeric>
                {{ props.row.clicks }}
              </b-table-column>
              <b-table-column v-slot="props" :label="$t('globals.terms.bounces')" numeric>
                <span :class="{ 'has-text-warning-dark': props.row.bounces > 0 }">{{ props.row.bounces }}</span>
              </b-table-column>
              <b-table-column v-slot="props" :label="$t('sequences.complaints')" numeric>
                <span :class="{ 'has-text-danger': props.row.complaints > 0 }">{{ props.row.complaints }}</span>
              </b-table-column>
              <template #empty>
                <p class="has-text-grey is-italic">{{ $t('crmCampaigns.noMembers') }}</p>
              </template>
            </b-table>
          </div>

          <div class="column is-half">
            <h3 class="is-size-7 has-text-grey is-uppercase">
              {{ $t('crmCampaigns.broadcasts') }} &middot; {{ $t('crmCampaigns.sourceListmonk') }}
            </h3>
            <b-table :data="stats.broadcasts" hoverable>
              <b-table-column v-slot="props" :label="$t('globals.fields.name')">
                <router-link :to="{ name: 'campaign', params: { id: props.row.listmonk_campaign_id } }">
                  {{ props.row.name || `#${props.row.listmonk_campaign_id}` }}
                </router-link>
                <p v-if="props.row.stats_unavailable" class="is-size-7 has-text-warning-dark">
                  {{ $t('crmCampaigns.statsUnavailable') }}
                  <span v-if="props.row.reason">{{ props.row.reason }}</span>
                </p>
              </b-table-column>
              <b-table-column v-slot="props" :label="$t('campaigns.progress')" numeric>
                <span v-if="!props.row.stats_unavailable">{{ props.row.sent }} / {{ props.row.to_send }}</span>
              </b-table-column>
              <b-table-column v-slot="props" :label="$t('campaigns.views')" numeric>
                <span v-if="!props.row.stats_unavailable">{{ props.row.views }}</span>
              </b-table-column>
              <b-table-column v-slot="props" :label="$t('campaigns.clicks')" numeric>
                <span v-if="!props.row.stats_unavailable">{{ props.row.clicks }}</span>
              </b-table-column>
              <b-table-column v-slot="props" :label="$t('globals.terms.bounces')" numeric>
                <span v-if="!props.row.stats_unavailable" :class="{ 'has-text-warning-dark': props.row.bounces > 0 }">
                  {{ props.row.bounces }}
                </span>
              </b-table-column>
              <template #empty>
                <p class="has-text-grey is-italic">{{ $t('crmCampaigns.noMembers') }}</p>
              </template>
            </b-table>
          </div>
        </div>
      </template>

      <div class="columns is-vcentered">
        <div class="column">
          <h2 class="title is-6 mb-0">{{ $t('outcomes.title') }}</h2>
        </div>
        <div class="column is-narrow">
          <b-field :label="$t('outcomes.windowDays')" label-position="on-border" class="mb-0">
            <b-select v-model="windowDays" :loading="outcomesLoading" :disabled="outcomesLoading"
              @input="loadOutcomes" data-cy="outcomes-window">
              <option v-for="d in windowOptions" :key="d" :value="d">{{ d }}</option>
            </b-select>
          </b-field>
        </div>
      </div>

      <!-- Outcomes are a separate read from the stats above and fail separately.
           A funnel query that times out must not take the delivery figures with
           it. -->
      <b-notification v-if="outcomesError" type="is-warning" :closable="false">
        {{ outcomesError }}
      </b-notification>

      <template v-if="outcomes">
        <!-- Above every number on this screen, not behind a tooltip: these are
             the reading instructions for the counts, including the date before
             which nothing was being watched at all. -->
        <b-notification type="is-info" :closable="false">
          <p><strong>{{ $t('outcomes.observedNotCaused') }}</strong></p>
          <p>{{ outcomes.measurement.note }}</p>
          <p v-if="outcomes.history_starts_at">
            {{ $t('outcomes.historyStartsAt') }}: {{ $utils.niceDate(outcomes.history_starts_at, true) }}
          </p>
          <p v-else>{{ $t('outcomes.historyEmpty') }}</p>
        </b-notification>

        <!-- Where a campaign-wide total would sit if there could be one. The
             stats section above refuses to blend two rates; this refuses to
             blend a known population with an inferred one, which is the wider
             gap of the two. -->
        <div class="box">
          <p class="is-size-7 has-text-grey is-uppercase">{{ $t('outcomes.noCombinedTotals') }}</p>
          <p>{{ outcomes.combined_totals_reason }}</p>
        </div>

        <div class="columns">
          <div class="column is-half">
            <h3 class="is-size-7 has-text-grey is-uppercase">
              {{ $t('crmCampaigns.sequences') }} &middot; {{ $t('crmCampaigns.sourceSes') }}
            </h3>

            <div class="box">
              <div class="columns is-mobile">
                <div class="column">
                  <p class="is-size-7 has-text-grey is-uppercase">{{ $t('outcomes.enrolled') }}</p>
                  <p class="title is-5">{{ outcomes.sequence_side.people.enrolled }}</p>
                </div>
                <div class="column">
                  <p class="is-size-7 has-text-grey is-uppercase">{{ $t('outcomes.measurable') }}</p>
                  <p class="title is-5">{{ outcomes.sequence_side.people.measurable }}</p>
                </div>
                <div class="column">
                  <p class="is-size-7 has-text-grey is-uppercase">{{ $t('outcomes.notYetSentTo') }}</p>
                  <p class="title is-5 has-text-grey">{{ outcomes.sequence_side.people.not_yet_sent_to }}</p>
                </div>
              </div>

              <div class="columns is-mobile">
                <div class="column">
                  <p class="is-size-7 has-text-grey is-uppercase">{{ $t('outcomes.advanced') }}</p>
                  <p class="title is-5">{{ outcomes.sequence_side.totals.advanced_after_send }}</p>
                </div>
                <div class="column">
                  <p class="is-size-7 has-text-grey is-uppercase">{{ $t('outcomes.regressed') }}</p>
                  <p class="title is-5">{{ outcomes.sequence_side.totals.regressed_after_send }}</p>
                </div>
                <!-- Neutral, and never subtracted from anything: it counts
                     people nothing was observed about, which includes everyone
                     already past every rung before measurement began. -->
                <div class="column">
                  <p class="is-size-7 has-text-grey is-uppercase">{{ $t('outcomes.noTransition') }}</p>
                  <p class="title is-5 has-text-grey">{{ outcomes.sequence_side.totals.no_transition_recorded }}</p>
                </div>
              </div>

              <p class="is-size-7 has-text-grey">
                {{ $t('outcomes.denominator') }}: {{ outcomes.sequence_side.people.denominator.value }}.
                {{ outcomes.sequence_side.people.denominator.covers }}.
              </p>
            </div>

            <h4 class="is-size-7 has-text-grey is-uppercase">{{ $t('outcomes.stagesReached') }}</h4>
            <b-table :data="outcomes.sequence_side.stages_reached" hoverable>
              <b-table-column v-slot="props" :label="$t('funnel.stage')" width="34%">
                {{ stageLabel(props.row) }}
              </b-table-column>
              <b-table-column v-slot="props" :label="$t('funnel.title')">
                <!-- Scaled to the tallest rung so the ladder has a shape. It is
                     not a share of anyone: the rungs are not exclusive. -->
                <b-progress :value="props.row.reached_after_send" :max="stageBarMax" size="is-small" type="is-info" />
              </b-table-column>
              <b-table-column v-slot="props" :label="$t('outcomes.reachedAfterSend')" numeric width="18%">
                {{ props.row.reached_after_send }}
              </b-table-column>
            </b-table>

            <!-- Per sequence, and deliberately with no total row: someone in two
                 of the campaign's sequences is one person above and a row here
                 in each, so these do not sum to the figures above. -->
            <b-table :data="outcomes.sequence_side.sequences" hoverable class="mt-4">
              <b-table-column v-slot="props" :label="$t('globals.fields.name')">
                <router-link :to="{ name: 'sequence', params: { id: props.row.sequence_id } }">
                  {{ props.row.name }}
                </router-link>
              </b-table-column>
              <b-table-column v-slot="props" :label="$t('outcomes.measurable')" numeric>
                {{ props.row.measurable }}
              </b-table-column>
              <b-table-column v-slot="props" :label="$t('outcomes.advanced')" numeric>
                {{ props.row.advanced_after_send }}
              </b-table-column>
              <b-table-column v-slot="props" :label="$t('outcomes.regressed')" numeric>
                {{ props.row.regressed_after_send }}
              </b-table-column>
              <template #empty>
                <p class="has-text-grey is-italic">{{ $t('crmCampaigns.noMembers') }}</p>
              </template>
            </b-table>
          </div>

          <!-- The other half of the campaign, in its own column with its own
               heading. Nothing on this side shares a row, a bar or a subtotal
               with anything on the sequence side, because the two describe
               populations that are known in completely different ways. -->
          <div class="column is-half">
            <h3 class="is-size-7 has-text-grey is-uppercase">
              {{ $t('crmCampaigns.broadcasts') }} &middot; {{ $t('crmCampaigns.sourceListmonk') }}
            </h3>

            <p v-if="!outcomes.broadcast_side.broadcasts.length" class="has-text-grey is-italic">
              {{ $t('crmCampaigns.noMembers') }}
            </p>

            <div v-for="b in outcomes.broadcast_side.broadcasts" :key="b.member_id" class="box">
              <h4 class="is-size-6 mb-1">
                <router-link :to="{ name: 'campaign', params: { id: b.listmonk_campaign_id } }">
                  {{ b.name || `#${b.listmonk_campaign_id}` }}
                </router-link>
              </h4>

              <!-- An unmeasured broadcast keeps its place and says why. Dropping
                   it would make the campaign look smaller than it is. -->
              <template v-if="!b.measured">
                <p class="is-size-7 has-text-warning-dark">{{ $t('outcomes.broadcastUnmeasured') }}</p>
                <p class="is-size-7 has-text-grey">{{ b.reason }}</p>
              </template>

              <template v-else>
                <p class="is-size-7 has-text-grey">
                  {{ $t('campaigns.startedAt') }}: {{ $utils.niceDate(b.started_at, true) }}
                </p>

                <div class="columns is-mobile mt-1">
                  <div class="column">
                    <p class="is-size-7 has-text-grey is-uppercase">{{ $t('outcomes.advanced') }}</p>
                    <p class="title is-5">{{ b.totals.advanced_after_send }}</p>
                  </div>
                  <div class="column">
                    <p class="is-size-7 has-text-grey is-uppercase">{{ $t('outcomes.regressed') }}</p>
                    <p class="title is-5">{{ b.totals.regressed_after_send }}</p>
                  </div>
                  <div class="column">
                    <p class="is-size-7 has-text-grey is-uppercase">{{ $t('outcomes.noTransition') }}</p>
                    <p class="title is-5 has-text-grey">{{ b.totals.no_transition_recorded }}</p>
                  </div>
                </div>

                <p class="is-size-7 has-text-grey">
                  {{ $t('outcomes.denominator') }}: {{ b.people.denominator.value }}.
                  {{ b.people.denominator.covers }}.
                </p>
                <p class="is-size-7 has-text-grey">
                  {{ $t('crmCampaigns.sourceListmonk') }} &middot;
                  {{ $t('sequences.sent') }}: {{ b.people.listmonk_sent }}
                </p>

                <!-- Listed, not summarised. Each one is a reason this population
                     is not the broadcast's recipient list, and a reader who
                     skips them will read the counts above as something exact. -->
                <ul class="is-size-7 has-text-grey">
                  <li>{{ b.scope.covers }}.</li>
                  <li v-for="(c, i) in b.scope.caveats" :key="i">{{ c }}</li>
                </ul>

                <h5 class="is-size-7 has-text-grey is-uppercase">{{ $t('outcomes.stagesReached') }}</h5>
                <b-table :data="b.stages_reached" hoverable>
                  <b-table-column v-slot="props" :label="$t('funnel.stage')">
                    {{ stageLabel(props.row) }}
                  </b-table-column>
                  <b-table-column v-slot="props" :label="$t('outcomes.reachedAfterSend')" numeric width="24%">
                    {{ props.row.reached_after_send }}
                  </b-table-column>
                </b-table>
              </template>
            </div>
          </div>
        </div>
      </template>
    </template>

    <b-modal :active.sync="addOpen" scroll="keep" :width="520">
      <div class="box">
        <h4 class="title is-6">
          {{ addMode === 'sequence' ? $t('crmCampaigns.addSequence') : $t('crmCampaigns.addBroadcast') }}
        </h4>

        <b-field v-if="addMode === 'sequence'" :label="$t('crmCampaigns.sequences')" label-position="on-border">
          <b-select v-model="addSequenceID" expanded :loading="addLoading" data-cy="pick-sequence">
            <option v-for="s in pickableSequences" :key="s.id" :value="s.id">
              {{ s.name }} ({{ s.status }})
            </option>
          </b-select>
        </b-field>

        <b-field v-else :label="$t('crmCampaigns.broadcasts')" label-position="on-border">
          <b-autocomplete v-model="broadcastQuery" :data="broadcastResults" field="name" :loading="addLoading"
            :placeholder="$t('campaigns.queryPlaceholder')" clear-on-select
            @typing="searchBroadcasts" @select="(o) => { addBroadcastID = o ? o.id : null; }"
            data-cy="pick-broadcast">
            <template #default="props">
              <strong>{{ props.option.name }}</strong>
              <p class="is-size-7 has-text-grey">#{{ props.option.id }} {{ props.option.subject }}</p>
            </template>
          </b-autocomplete>
        </b-field>

        <p v-if="addError" class="has-text-danger is-size-7">{{ addError }}</p>

        <div class="buttons mt-4">
          <b-button type="is-primary" :loading="adding" :disabled="!canAdd" @click="addMember" data-cy="btn-add-member">
            {{ $t('globals.buttons.add') }}
          </b-button>
          <b-button @click="addOpen = false">{{ $t('globals.buttons.cancel') }}</b-button>
        </div>
      </div>
    </b-modal>
  </section>
</template>

<script>
import Vue from 'vue';
import {
  getCrmCampaign, getCrmCampaignStats, createCrmCampaign, updateCrmCampaign, deleteCrmCampaign,
  addCrmCampaignMember, deleteCrmCampaignMember, getSequences, getCampaigns,
  getCrmCampaignOutcomes,
} from '../api';
import { stageByID } from '../funnel';

// Offered windows rather than a free number box: the API clamps anything else
// anyway, and a typed 3000 would come back as 90 with no explanation.
const WINDOW_CHOICES = [7, 14, 30, 60, 90];

export default Vue.extend({
  name: 'CrmCampaign',

  data() {
    return {
      isNew: false,
      loading: true,
      saving: false,

      form: {
        name: '', goal: '', starts_on: '', ends_on: '',
      },

      sequences: [],
      broadcasts: [],
      stats: null,

      outcomes: null,
      outcomesLoading: false,
      outcomesError: '',
      // Left null until the first response so the API's own default decides it,
      // rather than this screen asserting a window the API might not share.
      windowDays: null,

      addOpen: false,
      addMode: 'sequence',
      addLoading: false,
      adding: false,
      addError: '',
      allSequences: [],
      addSequenceID: null,
      broadcastQuery: '',
      broadcastResults: [],
      addBroadcastID: null,
    };
  },

  computed: {
    // A sequence can belong to only one campaign, so offering one that is
    // already in this campaign only produces a 409. The API still checks, and
    // still catches membership of a campaign this screen cannot see.
    pickableSequences() {
      const taken = this.sequences.map((s) => s.sequence_id);
      return this.allSequences.filter((s) => taken.indexOf(s.id) === -1);
    },

    canAdd() {
      return this.addMode === 'sequence' ? !!this.addSequenceID : !!this.addBroadcastID;
    },

    windowOptions() {
      const max = (this.outcomes && this.outcomes.window_days_max) || 90;
      const opts = WINDOW_CHOICES.filter((d) => d <= max);
      // The window actually in force is always selectable, even when the API
      // defaults to a value that is not one of the offered ones.
      if (this.windowDays && opts.indexOf(this.windowDays) === -1) { opts.push(this.windowDays); }
      return opts.sort((a, b) => a - b);
    },

    // Relative shape only. A denominator would be the wrong scale here: the
    // rungs are not exclusive and someone can be counted on more than one.
    stageBarMax() {
      if (!this.outcomes) { return 1; }
      return Math.max(1, ...this.outcomes.sequence_side.stages_reached.map((s) => s.reached_after_send));
    },
  },

  methods: {
    // The payload carries an English label; prefer the translated one when the
    // rung is one this build knows, so the ladder reads the same here as it does
    // on the sequence and contact screens.
    stageLabel(row) {
      const s = stageByID(row.stage);
      return s ? this.$t(s.i18n) : row.label;
    },

    async loadOutcomes() {
      this.outcomesLoading = true;
      try {
        const params = this.windowDays ? { window_days: this.windowDays } : {};
        const data = await getCrmCampaignOutcomes(this.$route.params.id, params);
        this.outcomes = data;
        this.windowDays = data.window_days;
        this.outcomesError = '';
      } catch (e) {
        // Kept local, and the previous payload is left in place: this must not
        // take the stats section above it off the screen.
        this.outcomesError = this.apiError(e);
      } finally {
        this.outcomesLoading = false;
      }
    },

    modeLabel(row) {
      return row.enrollment_mode === 'continuous'
        ? this.$t('sequences.enrollmentModeContinuous')
        : this.$t('sequences.enrollmentModeSnapshot');
    },

    // The CRM puts its sentence in .error, where listmonk's interceptor looks
    // for .message, so unwrapping it is on the caller.
    apiError(e) {
      return (e.response && e.response.data && e.response.data.error) || e.message;
    },

    async load() {
      this.loading = true;
      try {
        const data = await getCrmCampaign(this.$route.params.id);
        this.form = {
          name: data.name,
          goal: data.goal || '',
          starts_on: data.starts_on || '',
          ends_on: data.ends_on || '',
        };
        this.sequences = data.sequences || [];
        this.broadcasts = data.broadcasts || [];
        this.stats = await getCrmCampaignStats(this.$route.params.id);
      } finally {
        this.loading = false;
      }
      // After the await chain above, so a slow funnel query cannot hold up the
      // members and the stats. It swallows its own errors.
      this.loadOutcomes();
    },

    // An empty field means "clear it", which the API spells as an explicit null.
    // Sending '' would store an empty string instead of unsetting the date.
    formPayload() {
      return {
        name: this.form.name.trim(),
        goal: this.form.goal.trim() || null,
        starts_on: this.form.starts_on || null,
        ends_on: this.form.ends_on || null,
      };
    },

    async save() {
      this.saving = true;
      try {
        if (this.isNew) {
          const data = await createCrmCampaign(this.formPayload());
          this.$utils.toast(this.$t('globals.messages.created', { name: data.name }));
          this.$router.push({ name: 'crmCampaign', params: { id: data.id } });
          return;
        }
        await updateCrmCampaign(this.$route.params.id, this.formPayload());
        this.$utils.toast(this.$t('globals.messages.updated', { name: this.form.name }));
        await this.load();
      } finally {
        this.saving = false;
      }
    },

    confirmDelete() {
      // The help text is part of the question, not a footnote: deleting a
      // campaign is safe in a way that deleting a broadcast or a sequence is
      // not, and nobody should have to guess which of the two this is.
      this.$utils.confirm(
        `${this.$t('crmCampaigns.confirmDelete', { name: this.form.name })}. ${this.$t('crmCampaigns.deleteHelp')}`,
        async () => {
          await deleteCrmCampaign(this.$route.params.id);
          this.$utils.toast(this.$t('globals.messages.deleted', { name: this.form.name }));
          this.$router.push({ name: 'crmCampaigns' });
        },
      );
    },

    async openAdd(mode) {
      this.addMode = mode;
      this.addError = '';
      this.addSequenceID = null;
      this.addBroadcastID = null;
      this.broadcastQuery = '';
      this.broadcastResults = [];
      this.addOpen = true;

      if (mode === 'sequence') {
        this.addLoading = true;
        try {
          this.allSequences = await getSequences();
        } finally {
          this.addLoading = false;
        }
      }
    },

    async searchBroadcasts(query) {
      this.addBroadcastID = null;
      if (!query) {
        this.broadcastResults = [];
        return;
      }

      this.addLoading = true;
      try {
        // listmonk's own broadcast list, which is where the id being stored
        // comes from. Nothing about it is copied into the CRM beyond the id.
        const data = await getCampaigns({ query, page: 1, per_page: 20 });
        this.broadcastResults = data.results || [];
      } finally {
        this.addLoading = false;
      }
    },

    async addMember() {
      this.adding = true;
      this.addError = '';
      try {
        const payload = this.addMode === 'sequence'
          ? { sequence_id: this.addSequenceID }
          : { listmonk_campaign_id: this.addBroadcastID };
        await addCrmCampaignMember(this.$route.params.id, payload);
        this.addOpen = false;
        await this.load();
      } catch (e) {
        // Shown in the dialog rather than as a toast: 409 and 404 are both
        // answers about the thing just picked, and the picker is still open.
        this.addError = this.apiError(e);
      } finally {
        this.adding = false;
      }
    },

    removeMember(memberID, name) {
      this.$utils.confirm(this.$t('crmCampaigns.removeMember', { name }), async () => {
        try {
          await deleteCrmCampaignMember(this.$route.params.id, memberID);
          this.$utils.toast(this.$t('globals.messages.deleted', { name }));
          await this.load();
        } catch (e) {
          this.$utils.toast(this.apiError(e), 'is-danger');
        }
      });
    },
  },

  mounted() {
    if (this.$route.params.id === 'new') {
      this.isNew = true;
      this.loading = false;
      return;
    }
    this.load();
  },
});
</script>
