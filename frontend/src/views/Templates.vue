<template>
  <section class="templates">
    <header class="columns page-header">
      <div class="column is-10">
        <h1 class="title is-4">
          {{ $t('globals.terms.templates') }}
          <span v-if="templates.length > 0">({{ templates.length }})</span>
        </h1>
      </div>
      <div class="column has-text-right">
        <b-field v-if="$can('templates:manage')" expanded>
          <b-button expanded type="is-primary" icon-left="plus" class="btn-new" @click="showNewForm">
            {{ $t('globals.buttons.new') }}
          </b-button>
        </b-field>
      </div>
    </header>

    <!-- Sim Sense fork: view switch, and the two filters the gallery needs. -->
    <b-field grouped group-multiline class="gallery-toolbar">
      <b-field>
        <b-radio-button v-for="t in typeCounts" :key="t.value" v-model="typeFilter" :native-value="t.value"
          size="is-small" :data-cy="`filter-type-${t.value || 'all'}`">
          {{ t.label }} <span class="count">{{ t.count }}</span>
        </b-radio-button>
      </b-field>

      <b-field v-if="allTags.length">
        <b-select v-model="tagFilter" size="is-small" icon="tag-outline" data-cy="filter-tag">
          <option value="">{{ $t('gallery.allTags') }}</option>
          <option v-for="tag in allTags" :key="tag" :value="tag">{{ tag }}</option>
        </b-select>
      </b-field>

      <b-field expanded class="view-switch">
        <b-radio-button v-model="view" native-value="grid" size="is-small" data-cy="view-grid"
          :title="$t('gallery.gridView')">
          <b-icon icon="view-dashboard-variant-outline" size="is-small" />
        </b-radio-button>
        <b-radio-button v-model="view" native-value="list" size="is-small" data-cy="view-list"
          :title="$t('gallery.listView')">
          <b-icon icon="format-list-bulleted-square" size="is-small" />
        </b-radio-button>
      </b-field>
    </b-field>

    <template-gallery v-if="view === 'grid'" :templates="visibleTemplates" :usage="usage"
      @preview="previewTemplate" @edit="showEditForm" @tags="showTagsDialog" @test="showTestDialog"
      @filter-tag="(t) => { tagFilter = t; }" />

    <b-table v-else :data="visibleTemplates" :hoverable="true" :loading="loading.templates" default-sort="createdAt">
      <b-table-column v-slot="props" field="name" :label="$t('globals.fields.name')" :td-attrs="$utils.tdID" sortable>
        <a href="#" @click.prevent="showEditForm(props.row)">
          {{ props.row.name }}
        </a>
        <b-tag v-if="props.row.isDefault">
          {{ $t('templates.default') }}
        </b-tag>

        <p class="is-size-7 has-text-grey" v-if="props.row.type === 'tx'">
          {{ props.row.subject }}
        </p>
      </b-table-column>

      <b-table-column v-slot="props" field="type" :label="$t('globals.fields.type')" sortable>
        <b-tag v-if="props.row.type === 'campaign'" :class="props.row.type" :data-cy="`type-${props.row.type}`">
          {{ $tc('templates.typeCampaignHTML') }}
        </b-tag>
        <b-tag v-else-if="props.row.type === 'campaign_visual'" :class="props.row.type"
          :data-cy="`type-${props.row.type}`">
          {{ $tc('templates.typeCampaignVisual') }}
        </b-tag>
        <b-tag v-else :class="props.row.type" :data-cy="`type-${props.row.type}`">
          {{ $tc('templates.typeTransactional') }}
        </b-tag>
      </b-table-column>

      <b-table-column v-slot="props" field="id" :label="$t('globals.fields.id')" sortable>
        {{ props.row.id }}
      </b-table-column>

      <b-table-column v-slot="props" :label="$t('gallery.tags')" width="14%">
        <a v-for="tag in tagsFor(props.row)" :key="tag" href="#" class="tag is-small tpl-tag"
          @click.prevent="tagFilter = tag">{{ tag }}</a>
        <a href="#" class="tag is-small tpl-tag is-add" :aria-label="$t('gallery.editTags')"
          @click.prevent="showTagsDialog(props.row)">
          <b-icon icon="tag-outline" size="is-small" />
        </a>
      </b-table-column>

      <b-table-column v-slot="props" :label="$t('gallery.usedBy')" width="20%">
        <template-used-by :used-by="usedByFor(props.row)" />
      </b-table-column>

      <b-table-column v-slot="props" field="createdAt" :label="$t('globals.fields.createdAt')" sortable>
        {{ $utils.niceDate(props.row.createdAt) }}
      </b-table-column>

      <b-table-column v-slot="props" field="updatedAt" :label="$t('globals.fields.updatedAt')" sortable>
        {{ $utils.niceDate(props.row.updatedAt) }}
      </b-table-column>

      <b-table-column v-slot="props" cell-class="actions" align="right">
        <div>
          <a href="#" @click.prevent="previewTemplate(props.row)" data-cy="btn-preview"
            :aria-label="$t('templates.preview')">
            <b-tooltip :label="$t('templates.preview')" type="is-dark">
              <b-icon icon="file-find-outline" size="is-small" />
            </b-tooltip>
          </a>
          <!-- Transactional only: /api/tx refuses a campaign template, and a
               broadcast's own test send is the right one for those. -->
          <a v-if="props.row.type === 'tx'" href="#" @click.prevent="showTestDialog(props.row)" data-cy="btn-test"
            :aria-label="$t('gallery.testSend')">
            <b-tooltip :label="$t('gallery.testSend')" type="is-dark">
              <b-icon icon="email-outline" size="is-small" />
            </b-tooltip>
          </a>
          <a href="#" @click.prevent="showEditForm(props.row)" data-cy="btn-edit"
            :aria-label="$t('globals.buttons.edit')">
            <b-tooltip :label="$t('globals.buttons.edit')" type="is-dark">
              <b-icon icon="pencil-outline" size="is-small" />
            </b-tooltip>
          </a>
          <a href="#" @click.prevent="$utils.prompt(`Clone template`,
            { placeholder: 'Name', value: `Copy of ${props.row.name}` },
            (name) => cloneTemplate(name, props.row))" data-cy="btn-clone" :aria-label="$t('globals.buttons.clone')">
            <b-tooltip :label="$t('globals.buttons.clone')" type="is-dark">
              <b-icon icon="file-multiple-outline" size="is-small" />
            </b-tooltip>
          </a>
          <a v-if="!props.row.isDefault && props.row.type === 'campaign'" href="#"
            @click.prevent="$utils.confirm(null, () => makeTemplateDefault(props.row))" data-cy="btn-set-default"
            :aria-label="$t('templates.makeDefault')">
            <b-tooltip :label="$t('templates.makeDefault')" type="is-dark">
              <b-icon icon="check-circle-outline" size="is-small" />
            </b-tooltip>
          </a>
          <span v-else class="a has-text-grey-light">
            <b-icon icon="check-circle-outline" size="is-small" />
          </span>

          <a v-if="!props.row.isDefault" href="#" @click.prevent="$utils.confirm(null, () => deleteTemplate(props.row))"
            data-cy="btn-delete" :aria-label="$t('globals.buttons.delete')">
            <b-tooltip :label="$t('globals.buttons.delete')" type="is-dark">
              <b-icon icon="trash-can-outline" size="is-small" />
            </b-tooltip>
          </a>
          <span v-else class="a has-text-grey-light">
            <b-icon icon="trash-can-outline" size="is-small" />
          </span>
        </div>
      </b-table-column>

      <template #empty v-if="!loading.templates">
        <empty-placeholder />
      </template>
    </b-table>

    <!-- Add / edit form modal -->
    <b-modal scroll="keep" :aria-modal="true" :active.sync="isFormVisible" :width="1200" :can-cancel="false"
      class="template-modal">
      <template-form :data="curItem" :is-editing="isEditing" @finished="formFinished" />
    </b-modal>

    <campaign-preview v-if="previewItem" type="template" :id="previewItem.id" :template-type="previewItem.type"
      :title="previewItem.name" @close="closePreview" />

    <template-tags-dialog v-if="tagsItem" :template="tagsItem" :value="tagsFor(tagsItem)" :suggestions="allTags"
      @saved="onTagsSaved" @close="tagsItem = null" />

    <template-test-dialog v-if="testItem" :template="testItem" @close="testItem = null" />
  </section>
</template>

<script>
import Vue from 'vue';
import { mapState } from 'vuex';
import CampaignPreview from '../components/CampaignPreview.vue';
import EmptyPlaceholder from '../components/EmptyPlaceholder.vue';
import TemplateGallery from '../components/TemplateGallery.vue';
import TemplateTagsDialog from '../components/TemplateTagsDialog.vue';
import TemplateTestDialog from '../components/TemplateTestDialog.vue';
import TemplateUsedBy from '../components/TemplateUsedBy.vue';
import { getTemplateUsage } from '../api';

import TemplateForm from './TemplateForm.vue';

// Sim Sense fork: remembered across visits, because the choice between the
// gallery and the table is a working preference, not a per-page decision.
const VIEW_PREF = 'templates.view';

export default Vue.extend({
  components: {
    CampaignPreview,
    TemplateForm,
    EmptyPlaceholder,
    TemplateGallery,
    TemplateTagsDialog,
    TemplateTestDialog,
    TemplateUsedBy,
  },

  data() {
    return {
      curItem: null,
      isEditing: false,
      isFormVisible: false,
      previewItem: null,

      // Sim Sense fork.
      view: this.$utils.getPref(VIEW_PREF) || 'grid',
      typeFilter: '',
      tagFilter: '',
      // Keyed by listmonk template id: { tags, used_by }, from the CRM.
      usage: {},
      tagsItem: null,
      testItem: null,
    };
  },

  methods: {
    fetchTemplates() {
      this.$api.getTemplates();
      this.fetchUsage();
    },

    // --- Sim Sense fork -----------------------------------------------------

    async fetchUsage() {
      const data = await getTemplateUsage();
      // The CRM keys everything on the template id; an entry for a template
      // listmonk no longer has is simply never looked up.
      this.usage = Object.fromEntries(data.map((u) => [u.listmonk_template_id, u]));
    },

    tagsFor(t) {
      return this.usage[t.id] ? this.usage[t.id].tags : [];
    },

    usedByFor(t) {
      return this.usage[t.id] ? this.usage[t.id].used_by : [];
    },

    showTagsDialog(t) {
      this.tagsItem = t;
    },

    showTestDialog(t) {
      this.testItem = t;
    },

    onTagsSaved({ id, tags }) {
      // Patched in place rather than refetching the lot: the API returned what
      // it stored, so the two cannot drift, and the card does not blink.
      const entry = this.usage[id] || { listmonk_template_id: id, tags: [], used_by: [] };
      this.$set(this.usage, id, { ...entry, tags });
      // A tag that was the only one of its kind disappears from the filter with
      // it, which would otherwise leave the page filtered to nothing.
      if (this.tagFilter && !this.allTags.includes(this.tagFilter)) { this.tagFilter = ''; }
    },

    // Show the edit form.
    showEditForm(data) {
      this.curItem = data;
      this.isFormVisible = true;
      this.isEditing = true;
    },

    // Show the new form.
    showNewForm() {
      this.curItem = { type: 'campaign' };
      this.isFormVisible = true;
      this.isEditing = false;
    },

    formFinished() {
      this.$api.getTemplates();
      this.fetchUsage();
    },

    previewTemplate(c) {
      this.previewItem = c;
    },

    closePreview() {
      this.previewItem = null;
    },

    cloneTemplate(name, t) {
      const data = {
        name,
        type: t.type,
        subject: t.subject,
        body: t.body,
        body_source: t.bodySource,
      };
      this.$api.createTemplate(data).then((d) => {
        this.$api.getTemplates();
        this.$emit('finished');
        this.$utils.toast(`'${d.name}' created`);
      });
    },

    makeTemplateDefault(tpl) {
      this.$api.makeTemplateDefault(tpl.id).then(() => {
        this.$api.getTemplates();
        this.$utils.toast(this.$t('globals.messages.created', { name: tpl.name }));
      });
    },

    deleteTemplate(tpl) {
      this.$api.deleteTemplate(tpl.id).then(() => {
        this.$api.getTemplates();
        this.$utils.toast(this.$t('globals.messages.deleted', { name: tpl.name }));
      });
    },
  },

  computed: {
    ...mapState(['templates', 'loading']),

    // Sim Sense fork. Every tag in use, for the filter and the editor's
    // autocomplete. Taken from templates rather than from the usage payload so
    // a tag left behind by a deleted template cannot appear in the list.
    allTags() {
      const seen = new Set();
      this.templates.forEach((t) => this.tagsFor(t).forEach((tag) => seen.add(tag)));
      return [...seen].sort();
    },

    // Counts next to each type, so the filter says what it would hide before
    // you click it. Nothing is hidden by default: sequence steps only ever use
    // transactional templates, but defaulting to that filter is how someone
    // concludes their campaign template has been deleted.
    typeCounts() {
      const count = (type) => this.templates.filter((t) => t.type === type).length;
      return [
        { value: '', label: this.$t('gallery.allTypes'), count: this.templates.length },
        { value: 'tx', label: this.$tc('templates.typeTransactional'), count: count('tx') },
        { value: 'campaign', label: this.$tc('templates.typeCampaignHTML'), count: count('campaign') },
        {
          value: 'campaign_visual',
          label: this.$tc('templates.typeCampaignVisual'),
          count: count('campaign_visual'),
        },
      ];
    },

    visibleTemplates() {
      return this.templates.filter((t) => (!this.typeFilter || t.type === this.typeFilter)
        && (!this.tagFilter || this.tagsFor(t).includes(this.tagFilter)));
    },
  },

  watch: {
    view(v) {
      this.$utils.setPref(VIEW_PREF, v);
    },
  },

  created() {
    this.$root.$on('page.refresh', this.fetchTemplates);
  },

  destroyed() {
    this.$root.$off('page.refresh', this.fetchTemplates);
  },

  mounted() {
    // ?id=N opens that template's editor straight away. Sim Sense fork: a
    // sequence step names the template it sends, and "edit this email" has to
    // land on the email rather than on a list to hunt through. There is no
    // route for a single template in listmonk (the editor is a modal on this
    // page), so the deep link is a query rather than a path.
    this.$api.getTemplates().then((data) => {
      const id = Number(this.$route.query.id);
      if (!id) { return; }
      const tpl = (data || []).find((t) => t.id === id);
      if (tpl) { this.showEditForm(tpl); }
    });
    this.fetchUsage();
  },
});
</script>
