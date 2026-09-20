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
          <!-- A triggered sequence has no segment and never will: it enrols on
               a funnel stage being reached, so "no segment" is its normal state
               rather than the thing stopping it being approved. -->
          <h3 class="is-size-7 has-text-grey is-uppercase">
            {{ isTriggered ? $t('sequences.triggerStage') : $t('sequences.segment') }}
          </h3>
          <!-- The whole rule, not just the rung. The condition and its
               narrowing decide who gets this sequence as much as the stage
               does, and this page is where somebody decides whether to approve
               it. Editing them is on the funnel, which is the only place a
               rule is written. -->
          <pre v-if="isTriggered" class="segment">{{ triggerSummary }}</pre>
          <pre v-else-if="seq.segment_query" class="segment">{{ seq.segment_query }}</pre>
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

    <div class="columns" v-if="seq">
      <div class="column is-half">
        <div class="box">
          <h3 class="is-size-7 has-text-grey is-uppercase">{{ $t('sequences.enrollmentMode') }}</h3>
          <!-- The API only accepts this on draft and paused sequences, so an
               enabled control anywhere else would only produce a 400. Changing
               it on a live sequence would also change what approve already
               committed to, which is not something to do from a select. -->
          <b-field :message="$t('sequences.enrollmentModeHelp')">
            <b-select v-model="enrollmentMode" expanded
                      :disabled="!canEditMode || savingMode" :loading="savingMode"
                      @input="saveMode">
              <option value="snapshot">{{ $t('sequences.enrollmentModeSnapshot') }}</option>
              <option value="continuous">{{ $t('sequences.enrollmentModeContinuous') }}</option>
              <option value="triggered">{{ $t('sequences.enrollmentModeTriggered') }}</option>
            </b-select>
          </b-field>

          <!-- Nothing is saved until a stage is chosen. A default here would be
               a default audience, picked by the screen rather than by anyone. -->
          <b-field v-if="enrollmentMode === 'triggered'" :label="$t('sequences.triggerStage')"
                   :message="$t('sequences.triggerStageHelp')">
            <b-select v-model="triggerStage" expanded :disabled="!canEditMode || savingMode"
                      :loading="savingMode" @input="saveStage">
              <option :value="null" disabled>{{ $t('funnel.stage') }}</option>
              <option v-for="st in stages" :key="st.id" :value="st.id">{{ $t(st.i18n) }}</option>
            </b-select>
          </b-field>
        </div>
      </div>
    </div>

    <h2 class="title is-6 steps-head">
      <span>
        {{ $t('sequences.steps') }}
        <span class="has-text-grey has-text-weight-normal is-size-7">{{ $t('sequences.dayOffsetHelp') }}</span>
      </span>
      <!-- Only on a draft or paused sequence. Adding a step to a live one would
           change what people already enrolled are going to receive, which is
           the API's rule and not this screen's to soften. -->
      <b-button v-if="canEditMode" size="is-small" icon-left="plus" @click="addStep">
        {{ $t('sequences.addStep') }}
      </b-button>
      <b-tooltip v-else :label="$t('sequences.pauseToEditSteps')" position="is-left" multilined>
        <b-button size="is-small" icon-left="plus" disabled>{{ $t('sequences.addStep') }}</b-button>
      </b-tooltip>
    </h2>

    <b-table :data="steps" :loading="loading" hoverable>
      <b-table-column v-slot="props" field="day_offset" :label="$t('sequences.day')" width="6%" numeric>
        {{ props.row.day_offset }}
      </b-table-column>
      <b-table-column v-slot="props" field="subject" :label="$t('sequences.subject')">
        <!-- The subject is the handle on the email: clicking it opens the step
             with its rendered body beside the fields. On a live sequence that
             dialog is preview only, because the API will not change a step
             people are already counting down to. -->
        <a class="step-subject" role="button" tabindex="0" @click="openStep(props.row)"
          @keydown.enter="openStep(props.row)" @keydown.space.prevent="openStep(props.row)">
          {{ props.row.subject }}
        </a>
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
        <router-link :to="{ name: 'templates', query: { id: props.row.listmonk_template_id } }">
          #{{ props.row.listmonk_template_id }}
        </router-link>
      </b-table-column>

      <b-table-column v-slot="props" width="6%">
        <b-button v-if="canEditMode" size="is-small" type="is-text" icon-left="trash-can-outline"
          @click="deleteStep(props.row)" />
      </b-table-column>

      <template #empty>
        <empty-placeholder :title="$t('sequences.noStepsTitle')" :description="$t('sequences.noStepsHelp')" />
      </template>
    </b-table>

    <sequence-step-dialog :is-open.sync="stepDialogOpen" :sequence-i-d="$route.params.id"
      :step="editingStep" :readonly="!canEditMode" :taken-days="steps.map((s) => s.day_offset)"
      @saved="onStepSaved" />

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

    <template v-if="seq">
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

      <!-- A failed outcomes read leaves whatever was already fetched on screen.
           Stats and outcomes are separate reads of separate things, and losing
           the delivery figures because a funnel query timed out helps nobody. -->
      <b-notification v-if="outcomesError" type="is-warning" :closable="false">
        {{ outcomesError }}
      </b-notification>

      <template v-if="outcomes">
        <!-- Both sentences sit above every number on this screen rather than in
             a tooltip or an expander. They are the reading instructions for the
             counts below, and a count read without them is read wrongly. The
             start of history belongs here too: measurement began when the sync
             first ran, so anyone who crossed a rung before that is invisible
             and a small number here understates by an unknown amount. -->
        <b-notification type="is-info" :closable="false">
          <p><strong>{{ $t('outcomes.observedNotCaused') }}</strong></p>
          <p>{{ outcomes.measurement.note }}</p>
          <p v-if="outcomes.history_starts_at">
            {{ $t('outcomes.historyStartsAt') }}: {{ $utils.niceDate(outcomes.history_starts_at, true) }}
          </p>
          <p v-else>{{ $t('outcomes.historyEmpty') }}</p>
        </b-notification>

        <div class="box">
          <div class="columns is-mobile">
            <div class="column">
              <p class="is-size-7 has-text-grey is-uppercase">{{ $t('outcomes.enrolled') }}</p>
              <p class="title is-4">{{ outcomes.people.enrolled }}</p>
            </div>
            <div class="column">
              <p class="is-size-7 has-text-grey is-uppercase">{{ $t('outcomes.measurable') }}</p>
              <p class="title is-4">{{ outcomes.people.measurable }}</p>
            </div>
            <div class="column">
              <p class="is-size-7 has-text-grey is-uppercase">{{ $t('outcomes.notYetSentTo') }}</p>
              <p class="title is-4 has-text-grey">{{ outcomes.people.not_yet_sent_to }}</p>
            </div>
          </div>
          <p class="is-size-7 has-text-grey">
            {{ $t('outcomes.denominator') }}: {{ outcomes.people.denominator.value }}.
            {{ outcomes.people.denominator.covers }}.
          </p>
        </div>

        <div class="box">
          <div class="columns is-mobile">
            <div class="column">
              <p class="is-size-7 has-text-grey is-uppercase">{{ $t('outcomes.advanced') }}</p>
              <p class="title is-4">{{ outcomes.totals.advanced_after_send }}</p>
            </div>
            <div class="column">
              <p class="is-size-7 has-text-grey is-uppercase">{{ $t('outcomes.regressed') }}</p>
              <p class="title is-4">{{ outcomes.totals.regressed_after_send }}</p>
            </div>
            <!-- Its own neutral category, never a failure bucket and never
                 subtracted from anything: it includes everyone who had already
                 crossed every rung before measurement began. -->
            <div class="column">
              <p class="is-size-7 has-text-grey is-uppercase">{{ $t('outcomes.noTransition') }}</p>
              <p class="title is-4 has-text-grey">{{ outcomes.totals.no_transition_recorded }}</p>
            </div>
          </div>
          <p class="is-size-7 has-text-grey">
            {{ $t('outcomes.denominator') }}: {{ outcomes.people.denominator.value }}.
            {{ outcomes.people.denominator.covers }}.
          </p>
        </div>

        <h3 class="is-size-7 has-text-grey is-uppercase">{{ $t('outcomes.stagesReached') }}</h3>
        <!-- Every rung, zeros included and in ladder order, because the shape of
             the funnel is the thing being read and a rung nobody reached is part
             of that shape. -->
        <b-table :data="outcomes.stages_reached" hoverable>
          <b-table-column v-slot="props" :label="$t('funnel.stage')" width="30%">
            {{ stageLabel(props.row) }}
          </b-table-column>
          <b-table-column v-slot="props" :label="$t('funnel.title')">
            <!-- Scaled to the tallest rung, not to a denominator: this is the
                 relative shape of the ladder, and no bar here is a share of
                 anyone. The count beside it is the figure to read. -->
            <b-progress :value="props.row.reached_after_send" :max="stageBarMax" size="is-small" type="is-info" />
          </b-table-column>
          <b-table-column v-slot="props" :label="$t('outcomes.reachedAfterSend')" numeric width="16%">
            {{ props.row.reached_after_send }}
          </b-table-column>
        </b-table>

        <h3 class="is-size-7 has-text-grey is-uppercase mt-5">{{ $t('outcomes.byStep') }}</h3>
        <p class="is-size-7 has-text-grey">{{ $t('outcomes.precedesNotCauses') }}</p>
        <b-table :data="outcomes.by_step" hoverable>
          <b-table-column v-slot="props" :label="$t('sequences.day')" numeric width="6%">
            {{ props.row.day_offset }}
          </b-table-column>
          <b-table-column v-slot="props" :label="$t('sequences.subject')">
            {{ props.row.label || props.row.subject }}
          </b-table-column>
          <b-table-column v-slot="props" :label="$t('sequences.sent')" numeric>{{ props.row.sent }}</b-table-column>
          <b-table-column v-slot="props" :label="$t('outcomes.advanced')" numeric>
            {{ props.row.advances_observed_after_this_step }}
          </b-table-column>
          <b-table-column v-slot="props" :label="$t('outcomes.regressed')" numeric>
            {{ props.row.regressions_observed_after_this_step }}
          </b-table-column>
          <template #empty>
            <p class="has-text-grey is-italic">{{ $t('sequences.noStepsHelp') }}</p>
          </template>
        </b-table>
      </template>
    </template>

    <approve-dialog v-if="seq" :is-open.sync="approveOpen" :sequence="seq" @approved="onApproved" />
  </section>
</template>

<script>
import Vue from 'vue';
import EmptyPlaceholder from '../components/EmptyPlaceholder.vue';
import ApproveDialog from '../components/ApproveDialog.vue';
import SequenceStepDialog from '../components/SequenceStepDialog.vue';
import {
  getSequence, getSequenceStats, getSequenceOutcomes, pauseSequence, updateSequence,
  deleteSequenceStep,
} from '../api';
import { FUNNEL_STAGES, stageByID } from '../funnel';
import { conditionByID } from '../triggers';

// Offered windows rather than a free number box: the API clamps anything else
// anyway, and a typed 3000 would come back as 90 with no explanation.
const WINDOW_CHOICES = [7, 14, 30, 60, 90];

export default Vue.extend({
  name: 'Sequence',
  components: { EmptyPlaceholder, ApproveDialog, SequenceStepDialog },

  data() {
    return {
      seq: null,
      steps: [],
      stats: [],
      loading: true,
      pausing: false,
      approveOpen: false,
      enrollmentMode: 'snapshot',
      stepDialogOpen: false,
      editingStep: null,
      triggerStage: null,
      savingMode: false,

      outcomes: null,
      outcomesLoading: false,
      outcomesError: '',
      // Left null until the first response so the API's own default decides it,
      // rather than this screen asserting a window the API might not share.
      windowDays: null,
    };
  },

  computed: {
    isTriggered() {
      return !!this.seq && this.seq.enrollment_mode === 'triggered';
    },

    // The ladder, for the stage select. From the frontend's own mirror of it
    // (src/funnel.js) rather than from the API, which is where every other
    // stage list on this screen comes from too.
    stages() {
      return FUNNEL_STAGES;
    },

    triggerSummary() {
      if (!this.seq) { return ''; }
      const parts = [this.triggerStageLabel(this.seq.trigger_stage)];
      const known = conditionByID(this.seq.trigger_condition);
      if (known) {
        parts.push(known.needsDelay
          ? this.$tc(known.describe, this.seq.trigger_delay_days, { days: this.seq.trigger_delay_days })
          : this.$t(known.describe));
      }
      if (this.seq.trigger_filter) {
        parts.push(this.$t('funnel.narrowedTo', { filter: this.seq.trigger_filter }));
      }
      return parts.join('\n');
    },

    canEditMode() {
      return !!this.seq && (this.seq.status === 'draft' || this.seq.status === 'paused');
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
      return Math.max(1, ...this.outcomes.stages_reached.map((s) => s.reached_after_send));
    },
  },

  methods: {
    // The payload carries an English label; prefer the translated one when the
    // rung is one this build knows, so the ladder reads the same here as it does
    // on the subscribers and contact screens.
    stageLabel(row) {
      const s = stageByID(row.stage);
      return s ? this.$t(s.i18n) : row.label;
    },

    async loadOutcomes() {
      this.outcomesLoading = true;
      try {
        const params = this.windowDays ? { window_days: this.windowDays } : {};
        const data = await getSequenceOutcomes(this.$route.params.id, params);
        this.outcomes = data;
        this.windowDays = data.window_days;
        this.outcomesError = '';
      } catch (e) {
        // Kept local, and the previous payload is left in place: this must not
        // take the delivery stats above it off the screen.
        this.outcomesError = (e.response && e.response.data && e.response.data.error) || e.message;
      } finally {
        this.outcomesLoading = false;
      }
    },

    async load() {
      this.loading = true;
      try {
        const data = await getSequence(this.$route.params.id);
        this.seq = data;
        this.steps = data.steps || [];
        this.enrollmentMode = data.enrollment_mode;
        this.triggerStage = data.trigger_stage;
        const s = await getSequenceStats(this.$route.params.id);
        this.stats = (s || []).filter((r) => r.sent > 0);
      } finally {
        this.loading = false;
      }
      // After the await chain above, so a slow funnel query cannot hold up the
      // header and the steps. It swallows its own errors.
      this.loadOutcomes();
    },

    openApprove() { this.approveOpen = true; },

    addStep() {
      this.editingStep = null;
      this.stepDialogOpen = true;
    },

    openStep(step) {
      this.editingStep = step;
      this.stepDialogOpen = true;
    },

    onStepSaved(wasEdit) {
      this.$utils.toast(this.$t(wasEdit ? 'sequences.stepSaved' : 'sequences.stepAdded'));
      this.load();
    },

    // Delete and re-add is how a step is changed: there is no PATCH for one,
    // and the day is half of the unique key. Confirmed every time, because on
    // a paused sequence this removes something people may already have been
    // sent, and the sends stay in the history while the step does not.
    deleteStep(step) {
      this.$utils.confirm(
        this.$t('sequences.deleteStepConfirm', { day: step.day_offset, subject: step.subject }),
        async () => {
          try {
            await deleteSequenceStep(step.id);
            this.load();
          } catch (e) {
            this.$utils.toast((e.response && e.response.data && e.response.data.error) || e.message, 'is-danger');
          }
        },
      );
    },

    // The rung this sequence fires on, by id. Separate from stageLabel above,
    // which takes an outcomes row and has a label of its own to fall back to.
    triggerStageLabel(id) {
      const stage = stageByID(id);
      return stage ? this.$t(stage.i18n) : id;
    },

    async saveMode(mode) {
      if (!this.seq || mode === this.seq.enrollment_mode) { return; }
      // Switching to triggered is only half a decision: the stage select below
      // appears, and the write happens when that is answered.
      if (mode === 'triggered' && !this.triggerStage) { return; }
      this.savingMode = true;
      try {
        await updateSequence(this.$route.params.id, {
          enrollment_mode: mode,
          // Explicitly null, not absent: absent means "leave it", and leaving a
          // stage behind on a sequence that no longer fires on one is rejected.
          trigger_stage: mode === 'triggered' ? this.triggerStage : null,
        });
        // Re-read rather than trust the select: this is the field that decides
        // whether the scheduler keeps enrolling, so the screen should show what
        // the API stored, not what was clicked.
        await this.load();
      } catch (e) {
        this.$utils.toast((e.response && e.response.data && e.response.data.error) || e.message, 'is-danger');
        this.enrollmentMode = this.seq.enrollment_mode;
      } finally {
        this.savingMode = false;
      }
    },

    async saveStage(stage) {
      if (!this.seq || !stage || stage === this.seq.trigger_stage) { return; }
      this.savingMode = true;
      try {
        await updateSequence(this.$route.params.id, {
          enrollment_mode: 'triggered', trigger_stage: stage,
        });
        await this.load();
      } catch (e) {
        this.$utils.toast((e.response && e.response.data && e.response.data.error) || e.message, 'is-danger');
        this.triggerStage = this.seq.trigger_stage;
      } finally {
        this.savingMode = false;
      }
    },

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
