<template>
  <div class="template-gallery">
    <div v-for="t in templates" :key="t.id" class="tpl-card" :class="{ 'is-live': isLive(t) }"
      :data-cy="`tpl-card-${t.id}`">
      <!-- The thumbnail is the live preview endpoint in a scaled iframe, the
           same source CampaignPreview uses full size. No screenshot pipeline:
           nothing extra to run on the mini, and a thumbnail that cannot go
           stale because it is the template, rendered now. -->
      <a href="#" class="thumb" :data-id="t.id" :aria-label="$t('templates.preview')"
        @click.prevent="$emit('preview', t)">
        <iframe v-if="loaded[t.id]" :src="previewURL(t)" :title="t.name" sandbox loading="lazy"
          @load="onLoaded(t.id)" />
        <div v-if="!ready[t.id]" class="thumb-pending" />
      </a>

      <div class="meta">
        <div class="line">
          <a href="#" class="name" @click.prevent="$emit('edit', t)">{{ t.name }}</a>
          <b-tag v-if="t.isDefault" class="is-small">{{ $t('templates.default') }}</b-tag>
        </div>

        <p v-if="t.subject" class="subject">{{ t.subject }}</p>

        <div class="line">
          <b-tag :class="t.type" class="is-small" :data-cy="`type-${t.type}`">{{ typeLabel(t) }}</b-tag>
          <span class="id">#{{ t.id }}</span>
        </div>

        <div class="line tags">
          <a v-for="tag in tagsFor(t)" :key="tag" href="#" class="tag is-small tpl-tag"
            @click.prevent="$emit('filter-tag', tag)">{{ tag }}</a>
          <a href="#" class="tag is-small tpl-tag is-add" :data-cy="`btn-tags-${t.id}`"
            @click.prevent="$emit('tags', t)">
            <b-icon icon="tag-outline" size="is-small" />
            {{ tagsFor(t).length ? $t('gallery.editTags') : $t('gallery.addTags') }}
          </a>
        </div>

        <!-- Transactional templates only: a test goes out through /api/tx,
             which refuses anything else, and a campaign template is tested
             from the broadcast that uses it, body and template together. -->
        <div v-if="t.type === 'tx'" class="line actions">
          <a href="#" class="is-size-7" :data-cy="`btn-test-${t.id}`" @click.prevent="$emit('test', t)">
            <b-icon icon="email-outline" size="is-small" />
            {{ $t('gallery.testSend') }}
          </a>
        </div>

        <template-used-by :used-by="usedByFor(t)" warn />
      </div>
    </div>
  </div>
</template>

<script>
import { uris } from '../constants';
import TemplateUsedBy from './TemplateUsedBy.vue';

export default {
  name: 'TemplateGallery',

  components: { TemplateUsedBy },

  props: {
    templates: { type: Array, default: () => [] },

    // id -> { tags, used_by } from the CRM. A plain object rather than a Map so
    // Vue 2 can see through it without a wrapper.
    usage: { type: Object, default: () => ({}) },
  },

  data() {
    return {
      // Which iframes have been created, and which have finished rendering.
      // Separate because the placeholder has to survive the gap between the two
      // or the card flashes empty.
      loaded: {},
      ready: {},
      observer: null,
    };
  },

  methods: {
    previewURL(t) {
      return uris.previewTemplate.replace(':id', t.id);
    },

    typeLabel(t) {
      if (t.type === 'campaign') { return this.$tc('templates.typeCampaignHTML'); }
      if (t.type === 'campaign_visual') { return this.$tc('templates.typeCampaignVisual'); }
      return this.$tc('templates.typeTransactional');
    },

    tagsFor(t) {
      return this.usage[t.id] ? this.usage[t.id].tags : [];
    },

    usedByFor(t) {
      return this.usage[t.id] ? this.usage[t.id].used_by : [];
    },

    isLive(t) {
      return this.usedByFor(t).some((s) => s.status === 'active');
    },

    onLoaded(id) {
      this.$set(this.ready, id, true);
    },

    // Eight templates would be fine loaded all at once. Eighty would be eighty
    // simultaneous renders of full HTML email, which is why this is deferred
    // until the card is near the viewport and never undone afterwards: a card
    // that scrolls back out has already paid for itself.
    observeThumbs() {
      if (!this.observer) { return; }
      this.$el.querySelectorAll('.thumb:not([data-observed])').forEach((el) => {
        el.setAttribute('data-observed', '1');
        this.observer.observe(el);
      });
    },
  },

  mounted() {
    this.observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) { return; }
        this.$set(this.loaded, Number(entry.target.dataset.id), true);
        this.observer.unobserve(entry.target);
      });
    }, { rootMargin: '300px' });

    this.observeThumbs();
  },

  // Filtering and the initial fetch both replace the card list, so newly
  // rendered thumbs have to be picked up after the patch rather than only on
  // mount.
  updated() {
    this.observeThumbs();
  },

  beforeDestroy() {
    if (this.observer) { this.observer.disconnect(); }
  },
};
</script>
