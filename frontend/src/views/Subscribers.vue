<template>
  <section class="subscribers">
    <header class="columns page-header">
      <div class="column is-10">
        <h1 class="title is-4">
          {{ $t('globals.terms.subscribers') }}
          <span v-if="!isNaN(subscribers.total)">
            (<span data-cy="count">{{ subscribers.total }}</span>)
          </span>
          <span v-if="currentList">
            &raquo; {{ currentList.name }}
            <span v-if="queryParams.subStatus" class="has-text-grey has-text-weight-normal is-capitalized">({{
              queryParams.subStatus }})</span>
          </span>
        </h1>
      </div>
      <div class="column has-text-right">
        <b-field v-if="$can('subscribers:manage')" expanded>
          <b-button expanded type="is-primary" icon-left="plus" @click="showNewForm" data-cy="btn-new" class="btn-new">
            {{ $t('globals.buttons.new') }}
          </b-button>
        </b-field>
      </div>
    </header>

    <section class="subscribers-controls">
      <div class="columns">
        <div class="column is-8">
          <form @submit.prevent="onSubmit">
            <div>
              <b-field addons>
                <b-input @input="onSimpleQueryInput" v-model="queryInput" expanded
                  :placeholder="$t('subscribers.queryPlaceholder')" icon="magnify" ref="query"
                  :disabled="isSearchAdvanced" data-cy="search" />
                <p class="controls">
                  <b-button native-type="submit" type="is-primary" icon-left="magnify" :disabled="isSearchAdvanced"
                    data-cy="btn-search" />
                </p>
              </b-field>

              <div v-if="isSearchAdvanced">
                <b-input v-model="queryParams.queryExp" @keydown.native.enter="onAdvancedQueryEnter" type="textarea"
                  ref="queryExp" placeholder="subscribers.name LIKE '%user%' or subscribers.status='blocklisted'"
                  data-cy="query" />
                <span class="is-size-6 has-text-grey">
                  {{ $t('subscribers.advancedQueryHelp') }}.{{ ' ' }}
                  <a href="https://listmonk.app/docs/querying-and-segmentation" target="_blank"
                    rel="noopener noreferrer">
                    {{ $t('globals.buttons.learnMore') }}.
                  </a>
                </span>
                <div class="buttons">
                  <b-button native-type="submit" type="is-primary" icon-left="magnify" data-cy="btn-query">
                    {{
                      $t('subscribers.query') }}
                  </b-button>
                  <b-button @click.prevent="toggleAdvancedSearch" icon-left="cancel" data-cy="btn-query-reset">
                    {{ $t('subscribers.reset') }}
                  </b-button>
                </div>
              </div><!-- advanced query -->
            </div>
          </form>
          <div v-if="!isSearchAdvanced" class="toggle-advanced">
            <a href="#" @click.prevent="toggleAdvancedSearch" data-cy="btn-advanced-search">
              <b-icon icon="cog-outline" size="is-small" />
              {{ $t('subscribers.advancedQuery') }}
            </a>
          </div>
        </div><!-- search -->

        <div class="column is-4">
          <b-field :label="$t('funnel.stage')" label-position="on-border">
            <b-select v-model="stageFilter" @input="onStageFilter" expanded data-cy="stage-filter">
              <option value="">{{ $t('funnel.allStages') }}</option>
              <option v-for="s in funnelStages" :key="s.id" :value="s.id">{{ $t(s.i18n) }}</option>
            </b-select>
          </b-field>
          <p class="is-size-7 has-text-grey">{{ $t('funnel.derivedHelp') }}</p>
        </div><!-- funnel stage filter -->
      </div>
    </section><!-- control -->

    <p v-if="crmFailedAt > 0" class="is-size-7 has-text-grey" data-cy="crm-unavailable">
      {{ $t('contacts.crmUnavailable') }}
    </p>

    <br />
    <b-table :data="subscribers.results ?? []" :loading="loading.subscribers" @check-all="onTableCheck"
      @check="onTableCheck" :checked-rows.sync="bulk.checked" paginated backend-pagination pagination-position="both"
      @page-change="onPageChange" :current-page="queryParams.page" :per-page="subscribers.perPage"
      :total="subscribers.total" hoverable checkable backend-sorting @sort="onSort">
      <template #top-left>
        <div class="actions">
          <a class="a" href="#" @click.prevent="exportSubscribers" data-cy="btn-export-subscribers">
            <b-icon icon="cloud-download-outline" size="is-small" />
            {{ $t('subscribers.export') }}
          </a>
          <template v-if="bulk.checked.length > 0">
            <a class="a" href="#" @click.prevent="showBulkListForm" data-cy="btn-manage-lists">
              <b-icon icon="format-list-bulleted-square" size="is-small" /> Manage lists
            </a>
            <a class="a" href="#" @click.prevent="deleteSubscribers" data-cy="btn-delete-subscribers">
              <b-icon icon="trash-can-outline" size="is-small" /> Delete
            </a>
            <a class="a" href="#" @click.prevent="blocklistSubscribers" data-cy="btn-manage-blocklist">
              <b-icon icon="account-off-outline" size="is-small" /> Blocklist
            </a>
            <span class="a">
              {{ $t('globals.messages.numSelected', { num: numSelectedSubscribers }) }}
              <span v-if="!bulk.all && subscribers.total > subscribers.perPage">
                &mdash;
                <a href="#" @click.prevent="selectAllSubscribers">
                  {{ $t('globals.messages.selectAll', { num: subscribers.total }) }}
                </a>
              </span>
            </span>
          </template>
        </div>
      </template>

      <b-table-column v-slot="props" field="email" :label="$t('subscribers.email')" header-class="cy-email" sortable
        :td-attrs="$utils.tdID">
        <a :href="`/subscribers/${props.row.id}`" @click.prevent="showEditForm(props.row)"
          :class="{ 'blocklisted': props.row.status === 'blocklisted' }">
          {{ props.row.email }}
          <copy-text :text="`${props.row.email}`" hide-text />
        </a>
        <b-tag v-if="props.row.status !== 'enabled'" :class="props.row.status" data-cy="blocklisted">
          {{ $t(`subscribers.status.${props.row.status}`) }}
        </b-tag>
        <b-taglist>
          <template v-for="l in props.row.lists">
            <router-link :to="`/subscribers/lists/${l.id}`" :key="l.id" style="padding-right:0.5em;">
              <b-tag :class="l.subscriptionStatus" size="is-small" :key="l.id">
                {{ l.name }}
                <sup v-if="l.optin === 'double' || l.subscriptionStatus == 'unsubscribed'">
                  {{ $t(`subscribers.status.${l.subscriptionStatus}`) }}
                </sup>
              </b-tag>
            </router-link>
          </template>
        </b-taglist>
      </b-table-column>

      <b-table-column v-slot="props" field="lists" :label="$t('globals.terms.lists')" header-class="cy-lists" centered>
        {{ listCount(props.row.lists) }}
      </b-table-column>

      <b-table-column v-slot="props" field="funnel_stage" :label="$t('funnel.stage')"
        header-class="cy-funnel-stage">
        <b-tag size="is-small">{{ stageLabel(props.row) }}</b-tag>
      </b-table-column>

      <b-table-column v-slot="props" field="crm_sent" :label="$t('contacts.sent')" centered
        header-class="cy-crm_sent is-hidden-touch" cell-class="is-hidden-touch">
        {{ engagementNum(props.row, 'sends_sent') }}
      </b-table-column>

      <b-table-column v-slot="props" field="crm_opened" :label="$t('contacts.opened')" centered
        header-class="cy-crm_opened is-hidden-touch" cell-class="is-hidden-touch">
        {{ engagementNum(props.row, 'opened') }}
      </b-table-column>

      <b-table-column v-slot="props" field="crm_clicked" :label="$t('contacts.clicked')" centered
        header-class="cy-crm_clicked is-hidden-touch" cell-class="is-hidden-touch">
        {{ engagementNum(props.row, 'clicked') }}
      </b-table-column>

      <b-table-column v-slot="props" field="crm_last_sent" :label="$t('contacts.lastSent')"
        header-class="cy-crm_last_sent is-hidden-touch" cell-class="is-hidden-touch date-cell">
        {{ engagementDate(props.row) }}
      </b-table-column>

      <b-table-column v-slot="props" field="created_at" :label="$t('globals.fields.createdAt')"
        header-class="cy-created_at" cell-class="date-cell" sortable>
        {{ $utils.shortDate(props.row.createdAt) }}
      </b-table-column>

      <b-table-column v-slot="props" field="updated_at" :label="$t('globals.fields.updatedAt')"
        header-class="cy-updated_at" cell-class="date-cell" sortable>
        {{ $utils.shortDate(props.row.updatedAt) }}
      </b-table-column>

      <b-table-column v-slot="props" cell-class="actions" align="right">
        <div>
          <router-link :to="{ name: 'crmContact', params: { email: props.row.email } }" data-cy="btn-timeline"
            :aria-label="$t('contacts.viewTimeline')">
            <b-tooltip :label="$t('contacts.viewTimeline')" type="is-dark">
              <b-icon icon="clock-start" size="is-small" />
            </b-tooltip>
          </router-link>
          <a :href="`/api/subscribers/${props.row.id}/export`" data-cy="btn-download"
            :aria-label="$t('subscribers.downloadData')">
            <b-tooltip :label="$t('subscribers.downloadData')" type="is-dark">
              <b-icon icon="cloud-download-outline" size="is-small" />
            </b-tooltip>
          </a>
          <a v-if="$can('subscribers:manage')" :href="`/subscribers/${props.row.id}`"
            @click.prevent="showEditForm(props.row)" data-cy="btn-edit" :aria-label="$t('globals.buttons.edit')">
            <b-tooltip :label="$t('globals.buttons.edit')" type="is-dark">
              <b-icon icon="pencil-outline" size="is-small" />
            </b-tooltip>
          </a>
          <a v-if="$can('subscribers:manage')" href="#" @click.prevent="deleteSubscriber(props.row)"
            data-cy="btn-delete" :aria-label="$t('globals.buttons.delete')">
            <b-tooltip :label="$t('globals.buttons.delete')" type="is-dark">
              <b-icon icon="trash-can-outline" size="is-small" />
            </b-tooltip>
          </a>
        </div>
      </b-table-column>

      <template #empty v-if="!loading.subscribers">
        <empty-placeholder />
      </template>
    </b-table>

    <!-- Manage list modal -->
    <b-modal scroll="keep" :aria-modal="true" :active.sync="isBulkListFormVisible" :width="500" class="has-overflow">
      <subscriber-bulk-list :num-subscribers="this.numSelectedSubscribers" @finished="bulkChangeLists" />
    </b-modal>

    <!-- Add / edit form modal -->
    <b-modal scroll="keep" :aria-modal="true" :active.sync="isFormVisible" :width="850" @close="onFormClose">
      <subscriber-form :data="curItem" :is-editing="isEditing" @finished="querySubscribers" />
    </b-modal>
  </section>
</template>

<script>
import Vue from 'vue';
import { mapState } from 'vuex';
import EmptyPlaceholder from '../components/EmptyPlaceholder.vue';
import { uris } from '../constants';
import SubscriberBulkList from './SubscriberBulkList.vue';
import SubscriberForm from './SubscriberForm.vue';
import CopyText from '../components/CopyText.vue';
import {
  FUNNEL_STAGES, deriveStage, stageByID, stageQuery,
} from '../funnel';

// How long a failed engagement call suppresses further ones. Long enough that a
// CRM that is down does not mean a request and a toast on every page turn, short
// enough that one that comes back is picked up without a browser reload.
const CRM_RETRY_MS = 5 * 60 * 1000;

export default Vue.extend({
  components: {
    SubscriberForm,
    SubscriberBulkList,
    CopyText,
    EmptyPlaceholder,
  },

  data() {
    return {
      // Current subscriber item being edited.
      curItem: null,
      isSearchAdvanced: false,
      isEditing: false,
      isFormVisible: false,
      isBulkListFormVisible: false,

      // Table bulk row selection states.
      bulk: {
        checked: [],
        all: false,
      },

      queryInput: '',

      // Funnel stage filter. Empty means every stage.
      stageFilter: '',

      // True only when this view switched to advanced search in order to apply
      // a stage filter, so that clearing the filter can undo a mode change the
      // operator did not ask for without undoing one they did.
      stageOpenedAdvanced: false,

      // CRM engagement for the rows on screen, keyed by lowercased e-mail.
      // Empty until (and unless) the CRM answers.
      engagement: {},
      engagementToken: 0,
      crmFailedAt: 0,

      // Query params to filter the getSubscribers() API call.
      queryParams: {
        // Search query expression.
        queryExp: '',
        search: '',

        // ID of the list the current subscriber view is filtered by.
        listID: null,
        page: 1,
        orderBy: 'id',
        order: 'desc',
        subStatus: null,
      },
    };
  },

  methods: {
    // Count the lists from which a subscriber has not unsubscribed.
    listCount(lists) {
      return lists.reduce((defVal, item) => (defVal + (item.subscriptionStatus !== 'unsubscribed' ? 1 : 0)), 0);
    },

    toggleAdvancedSearch() {
      this.isSearchAdvanced = !this.isSearchAdvanced;
      this.queryParams.search = '';

      // Toggling to simple search.
      if (!this.isSearchAdvanced) {
        this.queryInput = '';
        this.queryParams.queryExp = '';
        // Resetting the query throws the stage clause away with it, so the
        // select must not go on claiming a filter that is no longer applied.
        this.stageFilter = '';
        this.stageOpenedAdvanced = false;
        this.queryParams.page = 1;
        this.querySubscribers();
        this.$refs.query.focus();
        return;
      }

      // Toggling to advanced search.
      const q = this.simpleQueryExp();
      if (q) {
        this.queryParams.queryExp = q;
      }

      // Toggling to advanced search.
      this.$nextTick(() => {
        this.$refs.queryExp.focus();
      });
    },

    // What the operator typed in the simple search box, as the SQL expression
    // the advanced box would hold. Factored out because the stage filter has to
    // switch to advanced mode too, and it must carry their search across rather
    // than silently drop it.
    simpleQueryExp() {
      const q = this.queryInput.replace(/'/, "''").trim();
      if (!q) {
        return '';
      }

      if (this.$utils.validateEmail(q)) {
        return `email = '${q.toLowerCase()}'`;
      }

      return `(name ~* '${q}' OR email ~* '${q.toLowerCase()}')`;
    },

    // The operator's own expression, with our stage clause taken back out.
    //
    // Recovered from the text rather than stashed away when the filter was
    // applied: the advanced box stays editable while a stage is selected, so a
    // stashed copy would go stale the moment they typed in it, and clearing the
    // filter would then restore a query they had already changed.
    withoutStageClause(exp) {
      const e = (exp || '').trim();

      for (let i = 0; i < FUNNEL_STAGES.length; i += 1) {
        const q = stageQuery(FUNNEL_STAGES[i].id);
        if (e === q) {
          return '';
        }

        const suffix = ` and (${q})`;
        if (e.endsWith(suffix)) {
          return e.slice(0, e.length - suffix.length).trim();
        }
      }

      return e;
    },

    // The stage filter goes through the same advanced query the operator could
    // have typed themselves, so it applies to the whole set and listmonk's
    // pagination and total stay true. Filtering the loaded page instead would
    // leave both of them lying.
    //
    // An expression already in the box is kept and ANDed with, not replaced.
    // Refusing would have been defensible too, but the two filters answer
    // different questions ("who am I looking at" and "how far have they got")
    // and they compose. What is not acceptable is throwing either away without
    // saying so, which is why the stage clause is appended in a shape that can
    // be recognised and removed again.
    onStageFilter(id) {
      const base = this.isSearchAdvanced
        ? this.withoutStageClause(this.queryParams.queryExp)
        : this.simpleQueryExp();

      if (!id) {
        this.queryParams.queryExp = base;

        // Only undo the mode switch if this view made it and there is nothing
        // of the operator's left in the box to show them.
        if (this.stageOpenedAdvanced && !base) {
          this.isSearchAdvanced = false;
          this.stageOpenedAdvanced = false;
        }

        this.querySubscribers({ page: 1 });
        return;
      }

      const q = stageQuery(id);
      this.queryParams.queryExp = base ? `(${base}) and (${q})` : q;

      if (!this.isSearchAdvanced) {
        this.stageOpenedAdvanced = true;
        this.isSearchAdvanced = true;

        // The API takes a search or an expression, not both, and
        // querySubscribers() drops the search whenever an expression is set.
        // Emptying the box stops it showing a search that is not applied.
        this.queryInput = '';
        this.queryParams.search = '';
      }

      this.querySubscribers({ page: 1 });
    },

    // Where a row has got to, derived from the attributes the hourly sync has
    // already written onto it. No request: listmonk sends attribs with the row.
    stageLabel(row) {
      const s = stageByID(deriveStage(row.attribs));
      return s ? this.$t(s.i18n) : '';
    },

    // A dash, not a zero, when the CRM has not answered. A printed zero cannot
    // be told apart from a real one, and "we never sent them anything" and "we
    // do not know" are very different things to put next to a name.
    engagementNum(row, field) {
      const e = this.engagement[(row.email || '').toLowerCase()];
      return e ? e[field] : '-';
    },

    engagementDate(row) {
      const e = this.engagement[(row.email || '').toLowerCase()];
      return e && e.last_sent_at ? this.$utils.shortDate(e.last_sent_at) : '-';
    },

    // One call for the page that has just rendered, never one per row.
    //
    // Nothing waits on this. The rows come from listmonk and are on screen
    // already; these columns fill in afterwards if the CRM answers. This is
    // listmonk's own subscribers screen and it has to keep working when the
    // drip API is down, so a failure is swallowed and remembered rather than
    // repeated on every page turn.
    fetchEngagement() {
      // A previous page's numbers must never sit under this page's rows.
      this.engagement = {};

      const rows = this.subscribers.results || [];
      if (rows.length === 0) {
        return;
      }

      if (this.crmFailedAt && Date.now() - this.crmFailedAt < CRM_RETRY_MS) {
        return;
      }

      // Deduplicated and capped because the endpoint rejects more than 500
      // addresses, and a rejected call would cost the whole page its numbers.
      const emails = [...new Set(rows.map((r) => (r.email || '').toLowerCase()).filter((e) => e))]
        .slice(0, 500);

      this.engagementToken += 1;
      const token = this.engagementToken;

      this.$api.getCrmEngagement(emails).then((data) => {
        // A slow answer for an older page must not land on a newer one.
        if (token !== this.engagementToken) {
          return;
        }

        const out = {};
        (data.results || []).forEach((r) => {
          out[(r.email || '').toLowerCase()] = r;
        });
        this.engagement = out;
        this.crmFailedAt = 0;
      }).catch(() => {
        if (token !== this.engagementToken) {
          return;
        }
        this.crmFailedAt = Date.now();
      });
    },

    // Mark all subscribers in the query as selected.
    selectAllSubscribers() {
      this.bulk.all = true;
    },

    onTableCheck() {
      // Disable bulk.all selection if there are no rows checked in the table.
      if (this.bulk.checked.length !== this.subscribers.total) {
        this.bulk.all = false;
      }
    },

    // Show the edit list form.
    showEditForm(sub) {
      this.curItem = sub;
      this.isFormVisible = true;
      this.isEditing = true;
    },

    // Show the new list form.
    showNewForm() {
      this.curItem = {};
      this.isFormVisible = true;
      this.isEditing = false;
    },

    showBulkListForm() {
      this.isBulkListFormVisible = true;
    },

    onFormClose() {
      if (this.$route.params.id) {
        this.$router.push({ name: 'subscribers' });
      }
    },

    onPageChange(p) {
      this.querySubscribers({ page: p });
    },

    onSort(field, direction) {
      this.querySubscribers({ orderBy: field, order: direction });
    },

    // Prepares an SQL expression for simple name search inputs and saves it
    // in this.queryExp.
    onSimpleQueryInput(v) {
      const q = v.replace(/'/, "''").trim();
      this.queryParams.queryExp = '';
      this.queryParams.page = 1;
      this.queryParams.search = q.toLowerCase();
    },

    // Ctrl + Enter on the advanced query searches.
    onAdvancedQueryEnter(e) {
      if (e.ctrlKey) {
        this.onSubmit();
      }
    },

    onSubmit() {
      this.querySubscribers({ page: 1 });
    },

    // Search / query subscribers.
    querySubscribers(params) {
      this.queryParams = { ...this.queryParams, ...params };

      const qp = {
        list_id: this.queryParams.listID,
        search: this.queryParams.search,
        query: this.queryParams.queryExp,
        page: this.queryParams.page,
        subscription_status: this.queryParams.subStatus,
        order_by: this.queryParams.orderBy,
        order: this.queryParams.order,
      };

      if (this.queryParams.queryExp) {
        delete qp.search;
      } else {
        delete qp.queryExp;
      }

      this.$nextTick(() => {
        this.$api.getSubscribers(qp).then(() => {
          this.bulk.checked = [];
        });
      });
    },

    deleteSubscriber(sub) {
      this.$utils.confirm(
        null,
        () => {
          this.$api.deleteSubscriber(sub.id).then(() => {
            this.querySubscribers();

            this.$utils.toast(this.$t('globals.messages.deleted', { name: sub.name }));
          });
        },
      );
    },

    blocklistSubscribers() {
      let fn = null;
      if (!this.bulk.all && this.bulk.checked.length > 0) {
        // If 'all' is not selected, blocklist subscribers by IDs.
        fn = () => {
          const ids = this.bulk.checked.map((s) => s.id);
          this.$api.blocklistSubscribers({ ids })
            .then(() => this.querySubscribers());
        };
      } else {
        // 'All' is selected, blocklist by query.
        fn = () => {
          this.$api.blocklistSubscribersByQuery({
            search: this.queryParams.search,
            query: this.queryParams.queryExp,
            list_ids: this.queryParams.listID ? [this.queryParams.listID] : null,
            subscription_status: this.queryParams.subStatus,
          }).then(() => this.querySubscribers());
        };
      }

      this.$utils.confirm(this.$t('subscribers.confirmBlocklist', { num: this.numSelectedSubscribers }), fn);
    },

    exportSubscribers() {
      const num = !this.bulk.all && this.bulk.checked.length > 0
        ? this.bulk.checked.length : this.subscribers.total;

      this.$utils.confirm(this.$t('subscribers.confirmExport', { num }), () => {
        const q = new URLSearchParams();

        if (this.queryParams.search) {
          q.append('search', this.queryParams.search);
        } else if (this.queryParams.queryExp) {
          q.append('query', this.queryParams.queryExp);
        }

        if (this.queryParams.listID) {
          q.append('list_id', this.queryParams.listID);
        }

        if (this.queryParams.subStatus) {
          q.append('subscription_status', this.queryParams.subStatus);
        }

        // Export selected subscribers.
        if (!this.bulk.all && this.bulk.checked.length > 0) {
          this.bulk.checked.map((s) => q.append('id', s.id));
        }

        document.location.href = `${uris.exportSubscribers}?${q.toString()}`;
      });
    },

    deleteSubscribers() {
      let fn = null;
      if (!this.bulk.all && this.bulk.checked.length > 0) {
        // If 'all' is not selected, delete subscribers by IDs.
        fn = () => {
          const ids = this.bulk.checked.map((s) => s.id);
          this.$api.deleteSubscribers({ id: ids })
            .then(() => {
              this.querySubscribers();

              this.$utils.toast(this.$t('subscribers.subscribersDeleted', { num: this.numSelectedSubscribers }));
            });
        };
      } else {
        // 'All' is selected, delete by query.
        fn = () => {
          this.$api.deleteSubscribersByQuery({
            // If the query expression is empty, explicitly pass `all=true`
            // so that the backend deletes all records in the DB with an empty query string.
            all: this.queryParams.queryExp.trim() === '' && this.queryParams.search.trim() === '',
            search: this.queryParams.search,
            query: this.queryParams.queryExp,
            list_ids: this.queryParams.listID ? [this.queryParams.listID] : null,
            subscription_status: this.queryParams.subStatus,
          }).then(() => {
            this.querySubscribers();

            this.$utils.toast(this.$t(
              'subscribers.subscribersDeleted',
              { num: this.numSelectedSubscribers },
            ));
          });
        };
      }

      this.$utils.confirm(this.$t('subscribers.confirmDelete', { num: this.numSelectedSubscribers }), fn);
    },

    bulkChangeLists(action, preconfirm, lists) {
      const data = {
        action,
        query: this.fullQueryExp,
        search: this.queryParams.search,
        list_ids: this.queryParams.listID ? [this.queryParams.listID] : null,
        target_list_ids: lists.map((l) => l.id),
      };

      if (preconfirm) {
        data.status = 'confirmed';
      }

      let fn = null;
      if (!this.bulk.all && this.bulk.checked.length > 0) {
        // If 'all' is not selected, perform by IDs.
        fn = this.$api.addSubscribersToLists;
        data.ids = this.bulk.checked.map((s) => s.id);
      } else {
        // 'All' is selected, perform by query.
        data.query = this.queryParams.queryExp;
        data.subscription_status = this.queryParams.subStatus;
        fn = this.$api.addSubscribersToListsByQuery;
      }

      fn(data).then(() => {
        this.querySubscribers();
        this.$utils.toast(this.$t('subscribers.listChangeApplied'));
      });
    },
  },

  watch: {
    // Every path that loads rows ends up here, including the edit form and the
    // refresh event, so the engagement call hangs off the rows themselves
    // rather than off each caller of querySubscribers().
    'subscribers.results': function onSubscriberResults() {
      this.fetchEngagement();
    },
  },

  computed: {
    ...mapState(['subscribers', 'lists', 'loading']),

    funnelStages() {
      return FUNNEL_STAGES;
    },

    numSelectedSubscribers() {
      if (this.bulk.all) {
        return this.subscribers.total;
      }
      return this.bulk.checked.length;
    },

    // Returns the list that the subscribers are being filtered by in.
    currentList() {
      if (!this.queryParams.listID || !this.lists.results) {
        return null;
      }

      return this.lists.results.find((l) => l.id === this.queryParams.listID);
    },
  },

  created() {
    this.$root.$on('page.refresh', this.querySubscribers);
  },

  destroyed() {
    this.$root.$off('page.refresh', this.querySubscribers);
  },

  mounted() {
    if (this.$route.params.listID) {
      this.queryParams.listID = parseInt(this.$route.params.listID, 10);
    }
    if (this.$route.query.subscription_status) {
      this.queryParams.subStatus = this.$route.query.subscription_status;
    }

    if (this.$route.params.id) {
      this.$api.getSubscriber(parseInt(this.$route.params.id, 10)).then((data) => {
        this.showEditForm(data);
      });
    } else {
      // Get subscribers on load.
      this.querySubscribers();
    }
  },
});
</script>
