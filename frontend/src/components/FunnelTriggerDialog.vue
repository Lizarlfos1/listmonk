<template>
  <b-modal :active="isOpen" @close="close" scroll="keep" :width="620" trap-focus>
    <div class="modal-card" style="width: auto">
      <header class="modal-card-head">
        <p class="modal-card-title">
          {{ rule ? $t('funnel.editTrigger') : $t('funnel.addTriggerOn', { stage: stageLabel }) }}
        </p>
      </header>

      <section class="modal-card-body funnel-trigger-dialog">
        <!-- Adding picks a sequence, either an existing draft or a brand new
             one; editing does not offer to swap it, because moving a rule
             between sequences is two decisions wearing one control and the
             second of them silently orphans the first sequence's enrolments.
             The new-sequence option is not a convenience: Without the second
             without it this dialog is unreachable on a stack where every sequence
             is already live, which is the ordinary state once a few are
             running. A new one is created as a draft with no steps, and the
             note below says what has to happen before it can send. -->
        <template v-if="!rule">
          <b-field :label="$t('funnel.startsSequence')">
            <b-radio v-model="source" native-value="existing" :disabled="!attachable.length">
              {{ $t('funnel.anExistingDraft') }}
            </b-radio>
            <b-radio v-model="source" native-value="new">{{ $t('funnel.aNewSequence') }}</b-radio>
          </b-field>

          <b-field v-if="source === 'existing'" :message="$t('funnel.startsSequenceHelp')">
            <b-select v-model="sequenceID" expanded :placeholder="$t('funnel.chooseSequence')">
              <option v-for="s in attachable" :key="s.id" :value="s.id">
                {{ s.name }} ({{ s.status }}, {{ $tc('funnel.stepCount', s.step_count, { n: s.step_count }) }})
              </option>
            </b-select>
          </b-field>

          <b-field v-else :message="$t('funnel.newSequenceHelp')">
            <b-input v-model="newName" :placeholder="$t('funnel.newSequencePlaceholder')" />
          </b-field>
        </template>
        <b-field v-else :label="$t('funnel.startsSequence')">
          <p class="fixed-sequence">{{ rule.name }}</p>
        </b-field>

        <b-field :label="$t('funnel.triggerWhen')">
          <b-select v-model="condition" expanded>
            <option v-for="c in conditions" :key="c.id" :value="c.id">{{ conditionLabel(c) }}</option>
          </b-select>
        </b-field>

        <b-field v-if="needsDelay" :label="$t('funnel.afterDays')" :message="$t('funnel.afterDaysHelp')">
          <b-numberinput v-model="delayDays" :min="1" :max="365" controls-position="compact" />
        </b-field>

        <!-- Narrowing only. There is no widening control here and there must
             not be: enrolment refuses anyone Listmonk does not hold as
             enabled, so "everybody who reaches this stage" already means
             "everybody we may mail". -->
        <b-field :label="$t('funnel.narrowTo')" :message="$t('funnel.narrowToHelp')">
          <b-input v-model="filter" type="textarea" rows="2" class="segment-input"
            :placeholder="$t('funnel.narrowToPlaceholder')" />
        </b-field>

        <b-message type="is-info" :closable="false" size="is-small">
          {{ $t('funnel.dialogNote') }}
        </b-message>
      </section>

      <footer class="modal-card-foot has-text-right">
        <b-button @click="close">{{ $t('globals.buttons.close') }}</b-button>
        <b-button type="is-primary" :disabled="!canSave" :loading="saving" @click="save">
          {{ $t('globals.buttons.save') }}
        </b-button>
      </footer>
    </div>
  </b-modal>
</template>

<script>
import Vue from 'vue';
import { createSequence, updateSequence } from '../api';
import { conditionByID } from '../triggers';

// One rule: what makes it fire, and which sequence it starts.
//
// Saving is a PATCH on the sequence, which is the only place a sequence's
// audience can be changed and carries the draft-or-paused guard with it. So an
// active rule cannot be edited here at all, and the page does not offer to: the
// API would refuse, and changing what a running trigger does to people already
// arriving is a decision that belongs at the approve gate.
export default Vue.extend({
  name: 'FunnelTriggerDialog',

  props: {
    isOpen: { type: Boolean, default: false },
    // The rung being edited, as the funnel payload describes it.
    stage: { type: Object, default: null },
    stageLabel: { type: String, default: '' },
    // Conditions the API says this build can actually run, not the ones this
    // frontend happens to have wording for.
    conditions: { type: Array, default: () => [] },
    attachable: { type: Array, default: () => [] },
    // Set when editing an existing rule, null when adding one.
    rule: { type: Object, default: null },
  },

  data() {
    return {
      source: 'existing',
      sequenceID: null,
      newName: '',
      condition: 'entered',
      delayDays: 7,
      filter: '',
      saving: false,
    };
  },

  computed: {
    needsDelay() {
      const known = this.conditions.find((c) => c.id === this.condition);
      return !!known && known.needs_delay;
    },

    canSave() {
      if (this.saving || !this.condition) { return false; }
      if (!this.rule) {
        if (this.source === 'new' && !this.newName.trim()) { return false; }
        if (this.source === 'existing' && !this.sequenceID) { return false; }
      }
      return !this.needsDelay || this.delayDays >= 1;
    },
  },

  watch: {
    isOpen(open) { if (open) { this.reset(); } },
  },

  methods: {
    // The translated wording where this build knows the condition, the API's
    // own English where it does not. A condition the scheduler can run must be
    // offerable even if this frontend has not caught up with it.
    conditionLabel(c) {
      const known = conditionByID(c.id);
      return known ? this.$t(known.i18n) : c.label;
    },

    reset() {
      const r = this.rule;
      // Straight to naming a new one when there is nothing to attach, rather
      // than opening on an empty select.
      this.source = this.attachable.length ? 'existing' : 'new';
      this.sequenceID = null;
      this.newName = '';
      this.condition = r ? r.trigger_condition : 'entered';
      this.delayDays = r && r.trigger_delay_days ? r.trigger_delay_days : 7;
      this.filter = r && r.trigger_filter ? r.trigger_filter : '';
      this.saving = false;
    },

    async save() {
      // The rule, whichever sequence it ends up on. Written once so the create
      // and the attach paths cannot describe the trigger differently.
      const trigger = {
        enrollment_mode: 'triggered',
        trigger_stage: this.stage.id,
        trigger_condition: this.condition,
        // Explicitly null rather than absent on both of these: absent means
        // "leave it", and a rule losing its clock or its narrowing has to be
        // able to say so.
        trigger_delay_days: this.needsDelay ? Number(this.delayDays) : null,
        trigger_filter: this.filter.trim() ? this.filter.trim() : null,
      };

      this.saving = true;
      try {
        if (!this.rule && this.source === 'new') {
          // Created as a draft, with the rule already on it. A draft sends
          // nothing and cannot be approved until it has steps, so this is a
          // long way from anything reaching a person.
          const created = await createSequence({ name: this.newName.trim(), ...trigger });
          this.$emit('created', created);
        } else {
          await updateSequence(this.rule ? this.rule.id : this.sequenceID, trigger);
        }
        this.$emit('saved');
        this.close();
      } catch (e) {
        this.$utils.toast((e.response && e.response.data && e.response.data.error) || e.message, 'is-danger');
      } finally {
        this.saving = false;
      }
    },

    close() { this.$emit('update:isOpen', false); },
  },
});
</script>
