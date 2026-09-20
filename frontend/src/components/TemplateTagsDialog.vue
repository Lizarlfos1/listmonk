<template>
  <b-modal scroll="keep" :aria-modal="true" :active="isVisible" :width="480" @close="close">
    <div class="modal-card content template-tags-dialog" style="width: auto">
      <header class="modal-card-head">
        <h4>{{ $t('gallery.tagsFor', { name: template.name }) }}</h4>
      </header>

      <section class="modal-card-body">
        <b-field :label="$t('gallery.tags')" :message="$t('gallery.tagsHelp')">
          <b-taginput v-model="tags" ellipsis icon="tag-outline" :data="suggestions" autocomplete allow-new
            :placeholder="$t('gallery.tagsPlaceholder')" :maxlength="40" :has-counter="false" />
        </b-field>
      </section>

      <footer class="modal-card-foot has-text-right">
        <b-button @click="close">{{ $t('globals.buttons.close') }}</b-button>
        <b-button type="is-primary" :loading="isSaving" @click="save">
          {{ $t('globals.buttons.save') }}
        </b-button>
      </footer>
    </div>
  </b-modal>
</template>

<script>
import { putTemplateTags } from '../api';

export default {
  name: 'TemplateTagsDialog',

  props: {
    // { id, name } from listmonk's own template list.
    template: { type: Object, required: true },
    value: { type: Array, default: () => [] },

    // Every tag already in use anywhere, for the autocomplete. Typing an
    // existing tag rather than inventing a near-miss is the whole difference
    // between a filter bar with six chips and one with sixty.
    suggestions: { type: Array, default: () => [] },
  },

  data() {
    return {
      isVisible: true,
      isSaving: false,
      tags: [...this.value],
    };
  },

  methods: {
    close() {
      this.isVisible = false;
      this.$emit('close');
    },

    async save() {
      this.isSaving = true;
      try {
        // The API normalises (trims, lowercases, dedupes) and returns what it
        // stored, so the parent takes that rather than what was typed. Showing
        // the typed form would leave the card disagreeing with the filter.
        const data = await putTemplateTags(this.template.id, this.tags);
        this.$emit('saved', { id: this.template.id, tags: data.tags });
        this.$utils.toast(this.$t('gallery.tagsSaved', { name: this.template.name }));
        this.close();
      } finally {
        this.isSaving = false;
      }
    },
  },
};
</script>
