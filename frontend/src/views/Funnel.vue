<template>
  <section class="funnel content relative">
    <b-loading :is-full-page="false" :active="loading" />

    <div v-if="data" class="funnel-layout">
      <!-- The journey, as a list. Every rung is here whether or not anything
           fires on it, because the gaps are half of what the page is for. -->
      <aside class="stage-list">
        <header class="list-head">
          <h1 class="title is-5">{{ $t('funnel.title') }}</h1>
          <p class="is-size-7 has-text-grey">{{ summary }}</p>
        </header>

        <ul>
          <li v-for="(stage, i) in data.stages" :key="stage.id"
            :class="{ 'is-selected': stage.id === selectedID }">
            <a role="button" tabindex="0" @click="select(stage.id)"
              @keydown.enter="select(stage.id)" @keydown.space.prevent="select(stage.id)">
              <span class="num">{{ i + 1 }}</span>
              <span class="detail">
                <span class="name">{{ stageLabel(stage) }}</span>
                <span v-if="stage.sequences.length" class="badge">
                  {{ $tc('funnel.sequenceCount', stage.sequences.length, { n: stage.sequences.length }) }}
                </span>
                <span v-else class="is-size-7 has-text-grey">{{ $t('funnel.noneAttached') }}</span>
              </span>
              <span class="reached" :class="{ 'is-empty': !stage.reached }">
                {{ stage.reached === null ? '—' : stage.reached }}
                <span class="unit">{{ $t('funnel.reached') }}</span>
              </span>
            </a>
          </li>
        </ul>

        <footer class="list-foot is-size-7 has-text-grey">
          <b-tooltip v-if="data.history_since" :label="historyCaveat" multilined position="is-top">
            <span class="footnote">{{ historyFootnote }}</span>
          </b-tooltip>
          <span v-else>{{ $t('funnel.historyEmpty') }}</span>
        </footer>
      </aside>

      <!-- One rung: its numbers, and every rule that fires on it. -->
      <div v-if="selected" class="stage-detail">
        <header class="detail-head">
          <div>
            <p class="eyebrow">
              {{ $t('funnel.stageOf', { n: selectedIndex + 1, total: data.stages.length }) }}
            </p>
            <h2 class="title is-4">{{ stageLabel(selected) }}</h2>
          </div>
          <div class="actions">
            <b-button icon-left="refresh" :loading="loading" @click="load">
              {{ $t('globals.buttons.refresh') }}
            </b-button>
            <!-- Always available. The dialog can create the sequence as well
                 as attach an existing one, so there is no state in which
                 adding a trigger is impossible and the button has nothing left
                 to be disabled for. -->
            <b-button type="is-primary" icon-left="plus" @click="addTrigger">
              {{ $t('funnel.addTrigger') }}
            </b-button>
          </div>
        </header>

        <div class="stat-strip">
          <div class="stat">
            <p class="figure">{{ selected.reached === null ? '—' : selected.reached }}</p>
            <p class="label">{{ $t('funnel.reachedThisStage') }}</p>
          </div>
          <div class="stat">
            <!-- Nobody "stops" at the last rung: it is the end of the journey,
                 and calling the goal a stop reads as a loss. -->
            <p class="figure">{{ isLastStage || selected.contacts === null ? '—' : selected.contacts }}</p>
            <p class="label">{{ $t('funnel.stoppedHereLabel') }}</p>
          </div>
          <div class="stat">
            <p class="figure">{{ wentOn === null ? '—' : `${wentOn}%` }}</p>
            <p class="label">{{ $t('funnel.wentOnLabel') }}</p>
          </div>
          <div class="stat">
            <p class="figure">{{ selected.sequences.length }}</p>
            <p class="label">{{ $t('funnel.triggersOnStage') }}</p>
          </div>
        </div>

        <div class="rules-head">
          <span class="eyebrow">{{ $t('funnel.whenSomebodyReaches', { stage: stageLabel(selected) }) }}</span>
          <span class="rule-order is-size-7 has-text-grey">{{ $t('funnel.rulesOrder') }}</span>
        </div>

        <div v-for="(rule, i) in selected.sequences" :key="rule.id" class="rule"
          :class="{ 'is-live': rule.status === 'active' }">
          <div class="rule-when">
            <p class="eyebrow">{{ i + 1 }} &nbsp;{{ $t('funnel.triggerWhen') }}</p>
            <p class="condition">{{ conditionLabel(rule) }}</p>
            <p class="is-size-7 has-text-grey">{{ audience(rule) }}</p>
          </div>

          <div class="rule-arrow"><b-icon icon="chevron-right" size="is-small" /></div>

          <div class="rule-sequence">
            <p class="eyebrow">{{ $t('funnel.startsSequence') }}</p>
            <router-link :to="{ name: 'sequence', params: { id: rule.id } }">{{ rule.name }}</router-link>
            <p class="is-size-7 has-text-grey">
              <span v-if="rule.step_count">{{ stepSummary(rule) }}</span>
              <span v-else class="has-text-warning-dark">{{ $t('funnel.noSteps') }}</span>
              · {{ $t('funnel.firesRate', { n: selected.entered_30d }) }}
            </p>
          </div>

          <div class="rule-stats">
            <span><b>{{ rule.active_count }}</b><em>{{ $t('funnel.inItLabel') }}</em></span>
            <span><b>{{ rule.sent_count }}</b><em>{{ $t('funnel.sentLabel') }}</em></span>
            <!-- Cancellations sit beside sent because a climbing one is this
                 rung mailing people who no longer want it: the scheduler
                 cancels anyone who stops being sendable, and this is the only
                 place that shows up. -->
            <span><b>{{ rule.cancelled_count }}</b><em>{{ $t('funnel.cancelledLabel') }}</em></span>
          </div>

          <div class="rule-status">
            <b-tag :class="rule.status">{{ rule.status }}</b-tag>
            <!-- Spelled out rather than hidden behind a pencil. Editing is how
                 a rule's condition and its narrowing are changed, and a bare
                 icon made that look like it was not on offer at all.
                 An active rule has neither: the API refuses to change a
                 running sequence's audience, here or anywhere. -->
            <template v-if="rule.status !== 'active'">
              <b-button size="is-small" icon-left="pencil-outline" @click="editTrigger(rule)">
                {{ $t('globals.buttons.edit') }}
              </b-button>
              <!-- An icon, but not a delete: detaching leaves the sequence,
                   its steps and everyone already in it exactly as they are.
                   The tooltip names the action and the confirm spells out what
                   it does and does not do, because a bin on its own would
                   promise something louder than what happens. -->
              <b-tooltip :label="$t('funnel.detach')" position="is-left">
                <b-button size="is-small" type="is-text" class="detach" icon-left="trash-can-outline"
                  :aria-label="$t('funnel.detach')" @click="detach(rule)" />
              </b-tooltip>
            </template>
            <b-tooltip v-else :label="$t('funnel.pauseToEdit')" position="is-left" multilined>
              <b-icon icon="warning-empty" size="is-small" class="locked" />
            </b-tooltip>
          </div>
        </div>

        <!-- Two live rules on one rung is legitimate (a welcome now, a nudge in
             a week) and is also how somebody accidentally gets two sequences at
             once. The page cannot tell those apart, so it says what is true. -->
        <b-message v-if="liveCount(selected) > 1" type="is-warning" :closable="false" size="is-small">
          {{ $t('funnel.multipleLive', { n: liveCount(selected) }) }}
        </b-message>

        <button type="button" class="add-rule" @click="addTrigger">
          + {{ selected.sequences.length ? $t('funnel.addAnotherTrigger') : $t('funnel.addTrigger') }}
        </button>
      </div>
    </div>

    <funnel-trigger-dialog v-if="data && selected" :is-open.sync="dialogOpen" :stage="selected"
      :stage-label="stageLabel(selected)" :conditions="data.conditions" :attachable="data.attachable"
      :rule="editing" @saved="onSaved" @created="onCreated" />
  </section>
</template>

<script>
import Vue from 'vue';
import FunnelTriggerDialog from '../components/FunnelTriggerDialog.vue';
import { getCrmFunnel, updateSequence } from '../api';
import { stageByID } from '../funnel';
import { conditionByID } from '../triggers';

// The funnel, and the rules that fire along it.
//
// Master and detail rather than one long page, because the two questions this
// screen answers are different sizes. "Where does the journey leak, and which
// rungs have nothing waiting on them" is the list on the left and wants to be
// seen at once. "What exactly happens when somebody reaches this rung" is the
// pane on the right and wants room for the rules, their conditions and their
// numbers.
//
// Three things about the model that the layout is shaped around:
//
//   * A rule is a sequence with a rung, a condition and optionally a clock and
//     a narrowing segment. It is stored on the sequence, so attaching or
//     editing one is a PATCH there and inherits the draft-or-paused guard: an
//     active rule cannot be edited, which is why those rows have no menu.
//   * Rules on a rung each fire on their own, in the order shown. That is the
//     only reading under which a day 0 welcome and a day 7 nudge can share a
//     rung, and it is why the caption says so rather than implying that the
//     first matching rule wins.
//   * Nothing is retroactive. A rule enrols people who meet its condition after
//     it was approved, never the backlog standing on the rung, so the counts on
//     the left and the rules on the right measure different things and are
//     never added together.
export default Vue.extend({
  name: 'Funnel',
  components: { FunnelTriggerDialog },

  data() {
    return {
      data: null, loading: true, selectedID: null, dialogOpen: false, editing: null,
    };
  },

  computed: {
    selected() {
      if (!this.data) { return null; }
      return this.data.stages.find((s) => s.id === this.selectedID) || this.data.stages[0] || null;
    },

    selectedIndex() {
      return this.data.stages.findIndex((s) => s.id === this.selected.id);
    },

    isLastStage() {
      return this.selectedIndex === this.data.stages.length - 1;
    },

    // Of the people who got this far, the share who got further. Null on the
    // last rung, and on any rung nobody has reached, where a percentage would
    // be a division by nothing dressed up as a measurement.
    wentOn() {
      const next = this.data.stages[this.selectedIndex + 1];
      if (!next || !this.selected.reached) { return null; }
      return next.conversion_from_previous;
    },

    summary() {
      const staged = this.data.stages.filter((s) => s.sequences.length).length;
      return [
        this.$t('funnel.stageTotal', { n: this.data.stages.length }),
        this.$t('funnel.withSequence', { n: staged }),
        this.data.contacts_available
          ? this.$t('funnel.contactTotal', { n: this.data.contacts_total })
          : this.$t('funnel.contactsUnknown'),
      ].join(' · ');
    },

    historyCaveat() {
      return this.$t('funnel.historySince', { date: this.$utils.niceDate(this.data.history_since) });
    },

    historyFootnote() {
      return this.$t('funnel.historyFootnote', { date: this.$utils.niceDate(this.data.history_since) });
    },
  },

  methods: {
    // The i18n label where the frontend's own copy of the ladder knows the
    // rung, the API's label where it does not: the two are mirrors, and a rung
    // added to one before the other should show its name rather than a blank.
    stageLabel(stage) {
      const known = stageByID(stage.id);
      return known ? this.$t(known.i18n) : stage.label;
    },

    conditionLabel(rule) {
      const known = conditionByID(rule.trigger_condition);
      if (!known) { return rule.trigger_condition; }
      return known.needsDelay
        ? this.$tc(known.describe, rule.trigger_delay_days, { days: rule.trigger_delay_days })
        : this.$t(known.describe);
    },

    // The second line of a rule: who it applies to among the people the
    // condition caught. Never "everyone": enrolment refuses anybody Listmonk
    // does not hold as enabled, so the widest a rule can be is everyone
    // reaching the rung who can still be mailed.
    audience(rule) {
      if (rule.trigger_filter) {
        return this.$t('funnel.narrowedTo', { filter: rule.trigger_filter });
      }
      const known = conditionByID(rule.trigger_condition);
      return this.$t(known ? `${known.i18n}Audience` : 'funnel.everyoneReaching');
    },

    // "day 0 to 0" is what a one-step sequence produces from a range, and it
    // reads like a bug because it says nothing twice.
    stepSummary(rule) {
      if (rule.step_count === 1) { return this.$t('funnel.stepsOne', { day: rule.first_day }); }
      return this.$t('funnel.stepsMany', {
        n: rule.step_count, from: rule.first_day, to: rule.last_day,
      });
    },

    liveCount(stage) {
      return stage.sequences.filter((s) => s.status === 'active').length;
    },

    // The rung lives in the query string so a refresh or a pasted link lands on
    // the rung that was being read.
    //
    // Written with history.replaceState rather than $router.replace on purpose:
    // App.vue keys the router-view on $route.fullPath, so any query change
    // remounts this view, which re-fetches the funnel and flashes the loading
    // overlay over a selection that needed no network at all. The alternative
    // was to change that key for every screen in the admin, which is a much
    // bigger thing to do to a fork for one page's sake.
    select(id) {
      if (this.selectedID === id) { return; }
      this.selectedID = id;
      try {
        const url = new URL(window.location.href);
        url.searchParams.set('stage', id);
        window.history.replaceState(window.history.state, '', url);
      } catch (e) {
        // A URL the browser will not let us rewrite is not a reason to fail to
        // change tab: the selection above has already happened.
      }
    },

    addTrigger() {
      this.editing = null;
      this.dialogOpen = true;
    },

    editTrigger(rule) {
      this.editing = rule;
      this.dialogOpen = true;
    },

    onSaved() {
      this.$utils.toast(this.$t('funnel.savedToast'));
      this.load();
    },

    // A sequence created here has a rule and no steps, so it cannot be approved
    // yet. Its page is where the next thing happens, so that is where this
    // goes rather than leaving a draft nobody looks at again.
    onCreated(created) {
      this.$router.push({ name: 'sequence', params: { id: created.id } });
    },

    // Back to a one-time sequence with no rung. It keeps its steps and its
    // enrolments: detaching stops it acquiring anyone new and says nothing
    // about the people already in it.
    detach(rule) {
      this.$utils.confirm(this.$t('funnel.detachConfirm', { name: rule.name }), async () => {
        try {
          await updateSequence(rule.id, {
            enrollment_mode: 'snapshot',
            trigger_stage: null,
            trigger_condition: null,
            trigger_delay_days: null,
            trigger_filter: null,
          });
          this.load();
        } catch (e) {
          this.$utils.toast((e.response && e.response.data && e.response.data.error) || e.message, 'is-danger');
        }
      });
    },

    async load() {
      this.loading = true;
      try {
        this.data = await getCrmFunnel();
        // The address bar, not $route.query: select() rewrites the URL without
        // the router, so the router's copy can be a rung behind.
        let fromUrl = null;
        try {
          fromUrl = new URL(window.location.href).searchParams.get('stage');
        } catch (e) { fromUrl = null; }
        const wanted = this.selectedID || fromUrl || this.$route.query.stage;
        const known = this.data.stages.some((s) => s.id === wanted);
        this.selectedID = known ? wanted : (this.data.stages[0] || {}).id;
      } finally {
        this.loading = false;
      }
    },
  },

  mounted() { this.load(); },
});
</script>
