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

        <!-- A/B split.
             Hidden entirely on a step that is not split and cannot be, which
             is every step of a live sequence: offering a control that the API
             will refuse is worse than not offering it. -->
        <div class="variants" v-if="step && (variants.length || !readonly)">
          <h3 class="title is-6 mb-1">{{ $t('sequences.splitTitle') }}</h3>

          <p v-if="!variants.length" class="is-size-7 has-text-grey mb-3">
            {{ $t('sequences.splitEmpty') }}
            <b-button v-if="!readonly && templateID" size="is-small" type="is-text"
              @click="startSplit">
{{ $t('sequences.splitStart') }}
</b-button>
          </p>

          <b-table v-if="variants.length" :data="variants" :loading="loadingVariants" narrowed>
            <b-table-column v-slot="p" field="label" :label="$t('sequences.splitArm')" width="80">
              <strong>{{ p.row.label }}</strong>
            </b-table-column>

            <b-table-column v-slot="p" field="template" :label="$t('sequences.template')">
              <b-select v-model="p.row.listmonk_template_id" size="is-small" expanded
                :disabled="readonly" @input="saveVariant(p.row)">
                <option v-for="t in txTemplates" :key="t.id" :value="t.id">{{ t.name }}</option>
              </b-select>
            </b-table-column>

            <b-table-column v-slot="p" field="subject" :label="$t('sequences.subject')">
              <b-input v-model="p.row.subject" size="is-small" :disabled="readonly"
                @blur="saveVariant(p.row)" />
            </b-table-column>

            <!-- Relative, not percentages: 1 and 1 is even, 3 and 1 is 75/25.
                 0 retires an arm without deleting what it already sent. -->
            <b-table-column v-slot="p" field="weight" :label="$t('sequences.splitWeight')" width="110">
              <b-numberinput v-model="p.row.weight" :min="0" :max="99" size="is-small"
                controls-position="compact" :disabled="readonly" @input="saveVariant(p.row)" />
            </b-table-column>

            <b-table-column v-slot="p" :label="$t('sequences.splitShare')" width="90">
              <span class="has-text-grey">{{ share(p.row) }}</span>
            </b-table-column>

            <b-table-column v-slot="p" :label="$t('sequences.splitSent')" width="80">
              {{ p.row.sent_count }}
            </b-table-column>

            <b-table-column v-slot="p" width="40">
              <b-button v-if="!readonly" size="is-small" type="is-text"
                icon-left="trash-can-outline" :title="$t('globals.buttons.delete')"
                @click="removeVariant(p.row)" />
            </b-table-column>
          </b-table>

          <div v-if="variants.length" class="mt-2">
            <b-button v-if="!readonly" size="is-small" icon-left="plus" @click="addVariant">
              {{ $t('sequences.splitAdd') }}
            </b-button>
            <span class="is-size-7 has-text-grey ml-3">{{ $t('sequences.splitHelp') }}</span>
          </div>

          <!-- Results, once anything has gone out. No winner and no p value:
               with a few hundred people an arm, the honest output is the
               counts, and deciding is the part a human does. -->
          <div v-if="anySent" class="mt-4">
            <p class="eyebrow">{{ $t('sequences.splitResults') }}</p>
            <table class="table is-narrow is-fullwidth is-size-7">
              <thead>
                <tr>
                  <th>{{ $t('sequences.splitArm') }}</th>
                  <th class="has-text-right">{{ $t('sequences.splitSent') }}</th>
                  <th class="has-text-right">{{ $t('sequences.splitDelivered') }}</th>
                  <th class="has-text-right">{{ $t('sequences.splitOpened') }}</th>
                  <th class="has-text-right">{{ $t('sequences.splitClicked') }}</th>
                  <th class="has-text-right">{{ $t('sequences.splitClickRate') }}</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="r in stats" :key="r.id">
                  <td><strong>{{ r.label }}</strong></td>
                  <td class="has-text-right">{{ r.sent }}</td>
                  <td class="has-text-right">{{ r.delivered }}</td>
                  <td class="has-text-right has-text-grey">{{ r.opened }}</td>
                  <td class="has-text-right">{{ r.clicked }}</td>
                  <td class="has-text-right">{{ rate(r.clicked, r.delivered) }}</td>
                </tr>
              </tbody>
            </table>
            <p class="is-size-7 has-text-grey">{{ $t('sequences.splitOpensWarning') }}</p>
          </div>
        </div>
      </section>

      <footer class="modal-card-foot">
        <!-- A preview is listmonk rendering the HTML. It cannot say how the
             subject reads in a list of unread mail, or whether the images load
             from outside the tailnet, which is what a copy in a real inbox is
             for. Offered on a live sequence too: reading what is going out is
             not editing it. -->
        <b-button v-if="templateID" icon-left="email-outline" @click="testItem = { id: templateID, name: templateName }">
          {{ $t('gallery.testSend') }}
        </b-button>

        <div class="is-flex-grow-1 has-text-right">
          <b-button @click="close">{{ $t('globals.buttons.close') }}</b-button>
          <b-button v-if="!readonly" type="is-primary" :disabled="!canSave" :loading="saving" @click="save">
            {{ $t('globals.buttons.save') }}
          </b-button>
        </div>
      </footer>
    </div>

    <template-test-dialog v-if="testItem" :template="testItem" @close="testItem = null" />
  </b-modal>
</template>

<script>
import Vue from 'vue';
import {
  createSequenceStep, createStepVariant, deleteStepVariant, getStepVariantStats,
  getStepVariants, getTemplates, updateSequenceStep, updateStepVariant,
} from '../api';
import TemplateTestDialog from './TemplateTestDialog.vue';

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

  components: { TemplateTestDialog },

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
      testItem: null,
      variants: [],
      stats: [],
      loadingVariants: false,
    };
  },

  computed: {
    txTemplates() {
      return this.templates.filter((t) => t.type === 'tx');
    },

    // For the test dialog's heading. The chosen template may not have loaded
    // yet on a step opened straight from the table, so the id stands in.
    templateName() {
      const tpl = this.templates.find((t) => t.id === this.templateID);
      return tpl ? tpl.name : `#${this.templateID}`;
    },

    // The step's own day is not a clash with itself.
    clashingDay() {
      const taken = this.takenDays.filter((d) => !this.step || d !== this.step.day_offset);
      return taken.indexOf(Number(this.dayOffset)) > -1;
    },

    // Weights are relative, so a share is only meaningful against their total.
    totalWeight() {
      return this.variants.reduce((sum, v) => sum + (Number(v.weight) || 0), 0);
    },

    anySent() {
      return this.stats.some((r) => r.sent > 0);
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
      this.testItem = null;
      this.variants = [];
      this.stats = [];
      this.loadTemplates();
      if (this.step) { this.loadVariants(); }
    },

    async loadVariants() {
      this.loadingVariants = true;
      try {
        const [list, stats] = await Promise.all([
          getStepVariants(this.step.id),
          getStepVariantStats(this.step.id),
        ]);
        this.variants = (list && list.variants) || [];
        this.stats = (stats && stats.variants) || [];
      } catch (e) {
        // A step with no variants is the common case and not an error worth a
        // toast, so only a real failure is surfaced.
        this.$utils.toast((e.response && e.response.data && e.response.data.message) || e.message, 'is-danger');
      } finally {
        this.loadingVariants = false;
      }
    },

    // Splitting starts from what the step already sends, so arm A is the
    // control rather than a blank row somebody has to fill in twice. B starts
    // as a copy of it: the point of a subject test is two templates that
    // differ in one line, and the fastest way there is to duplicate and edit.
    async startSplit() {
      // Sequentially, not Promise.all: the two inserts race on
      // unique (step_id, label) otherwise, and the loser's error is noise
      // rather than information.
      await this.createArm('A', this.templateID, this.subject);
      await this.createArm('B', this.templateID, this.subject);
      this.loadVariants();
    },

    async addVariant() {
      // Next free letter, so a third arm is C without anybody choosing.
      const used = this.variants.map((v) => v.label);
      let code = 'A'.charCodeAt(0);
      while (used.indexOf(String.fromCharCode(code)) > -1) { code += 1; }
      const base = this.variants[this.variants.length - 1] || {};
      await this.createArm(
        String.fromCharCode(code),
        base.listmonk_template_id || this.templateID,
        base.subject || this.subject,
      );
      this.loadVariants();
    },

    async createArm(label, templateID, subject) {
      try {
        await createStepVariant(this.step.id, {
          label,
          listmonk_template_id: templateID,
          subject,
          weight: 1,
        });
      } catch (e) {
        this.$utils.toast((e.response && e.response.data && e.response.data.message) || e.message, 'is-danger');
      }
    },

    async saveVariant(row) {
      try {
        await updateStepVariant(row.id, {
          listmonk_template_id: row.listmonk_template_id,
          subject: row.subject,
          weight: Number(row.weight),
        });
      } catch (e) {
        this.$utils.toast((e.response && e.response.data && e.response.data.message) || e.message, 'is-danger');
        this.loadVariants();
      }
    },

    removeVariant(row) {
      this.$utils.confirm(this.$t('sequences.splitDeleteConfirm', { label: row.label }), async () => {
        try {
          await deleteStepVariant(row.id);
        } catch (e) {
          // The API refuses an arm that has sent, and its message says to set
          // the weight to 0 instead. Shown as it came, because the reason is
          // the useful part.
          this.$utils.toast((e.response && e.response.data && e.response.data.message) || e.message, 'is-danger');
        }
        this.loadVariants();
      });
    },

    share(row) {
      if (!this.totalWeight) { return '-'; }
      if (!Number(row.weight)) { return this.$t('sequences.splitRetired'); }
      return `${Math.round((Number(row.weight) / this.totalWeight) * 100)}%`;
    },

    rate(part, whole) {
      if (!whole) { return '-'; }
      return `${Math.round((part / whole) * 1000) / 10}%`;
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
