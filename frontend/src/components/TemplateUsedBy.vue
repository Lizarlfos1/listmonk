<template>
  <div class="template-used-by">
    <span v-if="!usedBy.length" class="none">{{ $t('gallery.usedByNobody') }}</span>

    <template v-else>
      <router-link v-for="s in usedBy" :key="s.sequence_id" class="use" :class="s.status"
        :to="{ name: 'sequence', params: { id: s.sequence_id } }" :title="stepTitle(s)">
        <b-icon v-if="s.status === 'active'" icon="warning-empty" size="is-small" />
        <span class="seq-name">{{ s.sequence_name }}</span>
        <span class="days">{{ $t('gallery.dayList', { days: dayList(s) }) }}</span>
      </router-link>

      <!-- The point of the whole feature. A template referenced by an active
           sequence is copy that is still going out, and listmonk's editor gives
           no hint of that before you save over it. -->
      <p v-if="warn && liveNames.length" class="live-warning">
        <b-icon icon="warning-empty" size="is-small" />
        {{ $t('gallery.liveWarning', { names: liveNames.join(', ') }) }}
      </p>
    </template>
  </div>
</template>

<script>
export default {
  name: 'TemplateUsedBy',

  props: {
    // The used_by array from the CRM's /templates/usage, already ordered with
    // active sequences first.
    usedBy: { type: Array, default: () => [] },

    // Whether to spell the active case out in a sentence underneath. On a card
    // there is room and it is worth the words; in a table row the red chip and
    // its icon say the same thing without doubling the row height.
    warn: { type: Boolean, default: false },
  },

  computed: {
    liveNames() {
      return this.usedBy.filter((s) => s.status === 'active').map((s) => s.sequence_name);
    },
  },

  methods: {
    dayList(s) {
      return s.steps.map((st) => st.day_offset).join(', ');
    },

    // The subjects behind the day numbers, on hover. Enough to tell two steps
    // apart without opening the sequence.
    stepTitle(s) {
      return s.steps.map((st) => `day ${st.day_offset}: ${st.subject}`).join('\n');
    },
  },
};
</script>
