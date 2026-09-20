<template>
  <b-modal :active="isOpen" @close="close" scroll="keep" :width="720" trap-focus>
    <div class="modal-card" style="width: auto">
      <header class="modal-card-head">
        <p class="modal-card-title">{{ $t('sequences.approveTitle') }}</p>
      </header>

      <section class="modal-card-body">
        <div v-if="loading" class="has-text-centered p-6">
          <b-loading :is-full-page="false" active />
          <p class="has-text-grey">{{ $t('sequences.resolving') }}</p>
        </div>

        <b-message v-else-if="error" type="is-danger" :closable="false">{{ error }}</b-message>

        <div v-else-if="preview">
          <!-- The headline number. Everything else here exists so you can decide
               whether this one is right. -->
          <!-- A triggered sequence enrols nobody at approval, so the headline
               cannot be "who is about to be mailed" without being a lie. The
               honest figure is how fast people have been reaching the stage,
               which is the rate this will start mailing at. -->
          <div class="box headline has-text-centered">
            <template v-if="preview.triggered">
              <p class="is-size-1 has-text-weight-bold">{{ preview.arrivals_30d }}</p>
              <p class="has-text-grey">
                {{ $t('sequences.triggeredArrivals', { stage: preview.trigger_stage_label }) }}
                <span class="is-block is-size-7">
                  {{ $t('sequences.triggeredArrivals7', { n: preview.arrivals_7d }) }}
                </span>
              </p>
            </template>
            <template v-else>
              <p class="is-size-1 has-text-weight-bold">{{ preview.would_enrol }}</p>
              <p class="has-text-grey">
                {{ preview.would_enrol === 1 ? $t('sequences.personEnrolled') : $t('sequences.peopleEnrolled') }}
                <strong>{{ sequence.name }}</strong>
              </p>
            </template>
          </div>

          <b-message v-if="!preview.triggered" type="is-warning" :closable="false" size="is-small">
            {{ $t('sequences.approveWarning', { day: preview.first_day }) }}
          </b-message>

          <!-- The two things about a trigger that are not true of the other
               modes: it starts empty, and a pause loses the people who arrive
               during it. Both are surprises if the first time you meet them is
               after approving. -->
          <b-message v-if="preview.triggered" type="is-info" :closable="false" size="is-small">
            {{ $t('sequences.triggeredPreviewNote', { stage: preview.trigger_stage_label }) }}
            <span class="is-block">{{ $t('sequences.triggeredPauseNote') }}</span>
            <span v-if="preview.trigger_enrol_limit_per_tick" class="is-block">
              {{ $t('sequences.triggeredCap', { n: preview.trigger_enrol_limit_per_tick }) }}
            </span>
          </b-message>

          <!-- Under continuous enrolment the headline number above is a reading,
               not a total: approve enrols this snapshot and the scheduler keeps
               enrolling whoever matches later. The cap is here because it is the
               bound on how wrong a wrong segment can get before anyone notices. -->
          <b-message v-if="preview.continuous" type="is-info" :closable="false" size="is-small">
            {{ $t('sequences.continuousPreviewNote') }}
            <span v-if="preview.continuous_enrol_limit_per_tick !== null" class="is-block">
              {{ $t('sequences.continuousCap', { n: preview.continuous_enrol_limit_per_tick }) }}
            </span>
          </b-message>

          <b-message v-if="preview.blockers.length" type="is-danger" :closable="false" size="is-small">
            {{ $t('sequences.cannotApprove') }}: {{ preview.blockers.join('; ') }}
          </b-message>
          <!-- An empty segment blocks a one-time approval, because approving one
               would activate a sequence that can never enrol anyone: its only
               chance to do so is the snapshot being taken right now. A
               continuous sequence is the opposite case. Waiting for its first
               match is the normal state of a trigger, so this is a note. -->
          <b-message v-else-if="preview.would_enrol === 0 && !preview.triggered"
            :type="preview.continuous ? 'is-info' : 'is-warning'"
            :closable="false" size="is-small">
            {{ preview.continuous ? $t('sequences.continuousMatchesNobody') : $t('sequences.matchesNobody') }}
          </b-message>

          <h3 class="is-size-7 has-text-grey is-uppercase">
            {{ preview.triggered ? $t('sequences.triggerStage') : $t('sequences.segment') }}
          </h3>
          <pre class="segment">{{ preview.triggered ? preview.trigger_stage_label : preview.segment_query }}</pre>

          <div class="columns is-mobile has-text-centered mt-2">
            <template v-if="!preview.triggered">
              <div class="column"><p class="is-size-5">{{ preview.matched }}</p><p class="is-size-7 has-text-grey">{{ $t('sequences.matched') }}</p></div>
              <div class="column"><p class="is-size-5">{{ preview.blocklisted }}</p><p class="is-size-7 has-text-grey">{{ $t('sequences.blocklisted') }}</p></div>
              <div class="column"><p class="is-size-5">{{ preview.already_enrolled }}</p><p class="is-size-7 has-text-grey">{{ $t('sequences.alreadyEnrolled') }}</p></div>
            </template>
            <div class="column">
              <p class="is-size-5">{{ preview.step_count }}</p>
              <p class="is-size-7 has-text-grey">
                {{ $t('sequences.stepsDays', { from: preview.first_day, to: preview.last_day }) }}
              </p>
            </div>
          </div>

          <div v-if="preview.sample.length">
            <h3 class="is-size-7 has-text-grey is-uppercase">
              {{ $t('sequences.whoThatIs') }}
              <span v-if="preview.would_enrol > preview.sample.length" class="is-lowercase">
                ({{ $t('sequences.firstOf', { n: preview.sample.length, total: preview.would_enrol }) }})
              </span>
            </h3>
            <div class="sample-list">
              <div v-for="s in preview.sample" :key="s.id" class="sample-row">
                <span class="email">{{ s.email }}</span><span class="has-text-grey">{{ s.name }}</span>
              </div>
            </div>
          </div>

          <b-field :label="$t('sequences.approvedBy')" class="mt-4">
            <b-input v-model="approvedBy" :placeholder="$t('sequences.approvedByHelp')" />
          </b-field>
        </div>
      </section>

      <footer class="modal-card-foot has-text-right">
        <b-button @click="close">{{ $t('globals.buttons.close') }}</b-button>
        <b-button type="is-primary" icon-left="check" :disabled="!canApprove" :loading="submitting" @click="confirm">
          {{ $t('sequences.approveAndEnrol') }}
        </b-button>
      </footer>
    </div>
  </b-modal>
</template>

<script>
import Vue from 'vue';
import { getSequencePreview, approveSequence } from '../api';

const APPROVER_KEY = 'sim-sense-crm.approved-by';

// The gate.
//
// Approving is the only action here that causes mail to be scheduled, and it is
// irreversible in the way that matters: pausing afterwards stops future steps
// but cannot unsend day 0. So the segment is resolved against listmonk first
// and the real numbers and real addresses are shown before the button does
// anything.
export default Vue.extend({
  name: 'ApproveDialog',
  props: {
    isOpen: { type: Boolean, default: false },
    sequence: { type: Object, required: true },
  },

  data() {
    let remembered = '';
    try { remembered = localStorage.getItem(APPROVER_KEY) || ''; } catch (e) { remembered = ''; }
    return {
      preview: null, loading: false, submitting: false, error: null, approvedBy: remembered,
    };
  },

  computed: {
    canApprove() {
      return !!this.preview
        && this.preview.blockers.length === 0
        // Zero matches is fatal for a one-time sequence and ordinary for a
        // continuous one, which exists precisely to enrol people who do not
        // match yet. The API's own blockers still apply to both.
        && (this.preview.would_enrol > 0 || this.preview.continuous || this.preview.triggered)
        && this.approvedBy.trim().length > 0
        && !this.submitting;
    },
  },

  watch: {
    // Resolve when the dialog opens, not on every render: this costs a full
    // paged walk of the listmonk segment.
    isOpen(open) { if (open) { this.load(); } },
  },

  methods: {
    async load() {
      this.loading = true;
      this.error = null;
      this.preview = null;
      try {
        const data = await getSequencePreview(this.sequence.id);
        this.preview = data;
      } catch (e) {
        this.error = (e.response && e.response.data && (e.response.data.detail || e.response.data.error))
          || e.message;
      } finally {
        this.loading = false;
      }
    },

    async confirm() {
      if (!this.canApprove) { return; }
      this.submitting = true;
      try {
        const data = await approveSequence(this.sequence.id, { approved_by: this.approvedBy.trim() });
        try { localStorage.setItem(APPROVER_KEY, this.approvedBy.trim()); } catch (e) { /* not worth surfacing */ }
        // Report what approve actually enrolled, not what the preview predicted:
        // a live segment can move between the two calls.
        // A trigger reports zero enrolled, which is correct and reads like a
        // failure unless the toast says what it is waiting for.
        this.$utils.toast(data.triggered
          ? this.$t('sequences.approvedTriggeredToast', {
            name: this.sequence.name,
            stage: (this.preview && this.preview.trigger_stage_label) || data.trigger_stage,
          })
          : this.$t('sequences.approvedToast', { n: data.enrolled, name: this.sequence.name }));
        this.$emit('approved', data);
        this.close();
      } catch (e) {
        this.$utils.toast((e.response && e.response.data && e.response.data.error) || e.message, 'is-danger');
      } finally {
        this.submitting = false;
      }
    },

    close() { this.$emit('update:isOpen', false); },
  },
});
</script>
