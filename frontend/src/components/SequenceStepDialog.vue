<template>
  <b-modal :active="isOpen" @close="close" scroll="keep" :width="980" trap-focus>
    <div class="modal-card step-dialog" style="width: auto">
      <header class="modal-card-head">
        <p class="modal-card-title">
          {{ step ? $t('sequences.stepOnDay', { day: step.day_offset }) : $t('sequences.addStep') }}
        </p>
        <b-tag v-if="readonly" class="ml-2">{{ $t('sequences.readOnly') }}</b-tag>
      </header>

      <section class="modal-card-body">
        <div class="columns">
          <!-- What the step is. -->
          <div class="column is-5">
            <b-field :label="$t('sequences.day')" :message="$t('sequences.dayOffsetHelp')">
              <b-numberinput v-model="dayOffset" :min="0" :max="365" controls-position="compact"
                :disabled="readonly" />
            </b-field>

            <b-field :label="$t('sequences.subject')">
              <b-input v-model="subject" :disabled="readonly"
                :placeholder="$t('sequences.subjectPlaceholder')" />
            </b-field>

            <b-field :label="$t('sequences.stepLabel')" :message="$t('sequences.stepLabelHelp')">
              <b-input v-model="label" :disabled="readonly" />
            </b-field>

            <!-- Transactional templates only. A sequence step goes out through
                 listmonk's /api/tx, which refuses anything that is not type
                 'tx', so offering a campaign template here would produce a step
                 that fails at send time with nothing on screen to explain it. -->
            <b-field :label="$t('sequences.template')" :message="$t('sequences.templateHelp')">
              <b-select v-model="templateID" expanded :loading="loadingTemplates" :disabled="readonly"
                :placeholder="$t('sequences.chooseTemplate')">
                <option v-for="t in txTemplates" :key="t.id" :value="t.id">{{ t.name }}</option>
              </b-select>
            </b-field>

            <b-message v-if="!loadingTemplates && !txTemplates.length" type="is-warning" :closable="false"
              size="is-small">
              {{ $t('sequences.noTxTemplates') }}
            </b-message>

            <!-- The body is a listmonk template and is edited in listmonk's own
                 editor, which is a page rather than a field. The link is here
                 because "preview it and edit it" ends there, and because a
                 template may be sent by more than one sequence: the editor is
                 the screen that says so. -->
            <p v-if="templateID" class="is-size-7">
              <router-link :to="{ name: 'templates', query: { id: templateID } }">
                {{ $t('sequences.editCopy') }}
              </router-link>
            </p>
          </div>

          <!-- What it looks like. The same source the template gallery uses for
               its thumbnails: listmonk rendering the template now, so the
               preview cannot be stale. Sandboxed with no permissions, because
               it is arbitrary HTML with a viewer's session behind it. -->
          <div class="column is-7">
            <p class="eyebrow">{{ $t('sequences.preview') }}</p>
            <div class="preview-frame">
              <iframe v-if="templateID" :key="templateID" :src="`/api/templates/${templateID}/preview`"
                sandbox="" :title="$t('sequences.preview')" />
              <p v-else class="has-text-grey is-size-7 p-4">{{ $t('sequences.previewEmpty') }}</p>
            </div>
            <p class="is-size-7 has-text-grey mt-1">{{ $t('sequences.previewHelp') }}</p>
          </div>
        </div>
      </section>

      <footer class="modal-card-foot has-text-right">
        <b-button @click="close">{{ $t('globals.buttons.close') }}</b-button>
        <b-button v-if="!readonly" type="is-primary" :disabled="!canSave" :loading="saving" @click="save">
          {{ $t('globals.buttons.save') }}
        </b-button>
      </footer>
    </div>
  </b-modal>
</template>

<script>
import Vue from 'vue';
import { createSequenceStep, getTemplates, updateSequenceStep } from '../api';

// One step: a day, a subject, the template that renders it, and what that
// renders as.
//
// The day is an offset from each person's own enrolment, never a date
// (invariant 2), which is what the help text says and why the control is a
// small number rather than a date picker.
//
// Read-only on a live sequence. Its steps are what existing enrolments are
// counting down to, so the API refuses to change them, but previewing what is
// about to go out is exactly what somebody wants from a running sequence and
// costs nothing.
export default Vue.extend({
  name: 'SequenceStepDialog',

  props: {
    isOpen: { type: Boolean, default: false },
    sequenceID: { type: String, required: true },
    // The step being opened, or null when adding one.
    step: { type: Object, default: null },
    // Draft and paused sequences can be edited; a live one is preview only.
    readonly: { type: Boolean, default: false },
    // Days already taken, so the dialog can refuse before the API does: the
    // unique constraint on (sequence, day) is almost always hit by a
    // duplicated step during authoring rather than by intent.
    takenDays: { type: Array, default: () => [] },
  },

  data() {
    return {
      dayOffset: 0,
      subject: '',
      label: '',
      templateID: null,
      templates: [],
      loadingTemplates: false,
      saving: false,
    };
  },

  computed: {
    txTemplates() {
      return this.templates.filter((t) => t.type === 'tx');
    },

    // The step's own day is not a clash with itself.
    clashingDay() {
      const taken = this.takenDays.filter((d) => !this.step || d !== this.step.day_offset);
      return taken.indexOf(Number(this.dayOffset)) > -1;
    },

    canSave() {
      return !this.saving
        && !this.readonly
        && !!this.templateID
        && this.subject.trim().length > 0
        && this.dayOffset >= 0
        && !this.clashingDay;
    },
  },

  watch: {
    isOpen(open) { if (open) { this.reset(); } },
  },

  methods: {
    reset() {
      if (this.step) {
        this.dayOffset = this.step.day_offset;
        this.subject = this.step.subject;
        this.label = this.step.label || '';
        this.templateID = this.step.listmonk_template_id;
      } else {
        // The next free day, so adding three steps in a row does not mean
        // three collisions with the unique constraint.
        let next = 0;
        while (this.takenDays.indexOf(next) > -1) { next += 1; }
        this.dayOffset = next;
        this.subject = '';
        this.label = '';
        this.templateID = null;
      }
      this.saving = false;
      this.loadTemplates();
    },

    async loadTemplates() {
      this.loadingTemplates = true;
      try {
        const data = await getTemplates();
        this.templates = data || [];
      } catch (e) {
        this.$utils.toast((e.response && e.response.data && e.response.data.message) || e.message, 'is-danger');
      } finally {
        this.loadingTemplates = false;
      }
    },

    async save() {
      const body = {
        day_offset: Number(this.dayOffset),
        subject: this.subject.trim(),
        label: this.label.trim() || null,
        listmonk_template_id: Number(this.templateID),
      };

      this.saving = true;
      try {
        if (this.step) {
          await updateSequenceStep(this.step.id, body);
        } else {
          await createSequenceStep(this.sequenceID, body);
        }
        this.$emit('saved', !!this.step);
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
