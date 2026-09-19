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
          <div class="box headline has-text-centered">
            <p class="is-size-1 has-text-weight-bold">{{ preview.would_enrol }}</p>
            <p class="has-text-grey">
              {{ preview.would_enrol === 1 ? $t('sequences.personEnrolled') : $t('sequences.peopleEnrolled') }}
              <strong>{{ sequence.name }}</strong>
            </p>
          </div>

          <b-message type="is-warning" :closable="false" size="is-small">
            {{ $t('sequences.approveWarning', { day: preview.first_day }) }}
          </b-message>

          <b-message v-if="preview.blockers.length" type="is-danger" :closable="false" size="is-small">
            {{ $t('sequences.cannotApprove') }}: {{ preview.blockers.join('; ') }}
          </b-message>
          <b-message v-else-if="preview.would_enrol === 0" type="is-warning" :closable="false" size="is-small">
            {{ $t('sequences.matchesNobody') }}
          </b-message>

          <h3 class="is-size-7 has-text-grey is-uppercase">{{ $t('sequences.segment') }}</h3>
          <pre class="segment">{{ preview.segment_query }}</pre>

          <div class="columns is-mobile has-text-centered mt-2">
            <div class="column"><p class="is-size-5">{{ preview.matched }}</p><p class="is-size-7 has-text-grey">{{ $t('sequences.matched') }}</p></div>
            <div class="column"><p class="is-size-5">{{ preview.blocklisted }}</p><p class="is-size-7 has-text-grey">{{ $t('sequences.blocklisted') }}</p></div>
            <div class="column"><p class="is-size-5">{{ preview.already_enrolled }}</p><p class="is-size-7 has-text-grey">{{ $t('sequences.alreadyEnrolled') }}</p></div>
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
        && this.preview.would_enrol > 0
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
        this.$utils.toast(this.$t('sequences.approvedToast', { n: data.enrolled, name: this.sequence.name }));
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
