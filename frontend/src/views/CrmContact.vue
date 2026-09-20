<template>
  <section class="crm-contact content relative">
    <router-link :to="{ name: 'subscribers' }" class="is-size-7">
      <b-icon icon="chevron-left" size="is-small" /> {{ $t('globals.terms.subscribers') }}
    </router-link>

    <!-- The CRM being unreachable is the only case with nothing to render: the
         whole page, identity included, comes from that one call. -->
    <b-notification v-if="crmError" type="is-danger" :closable="false">
      {{ $t('contacts.crmUnavailable') }}
      <span v-if="crmError !== true"> {{ crmError }}</span>
    </b-notification>

    <b-notification v-else-if="notFound" type="is-warning" :closable="false">
      {{ $t('globals.messages.notFound', { name: email }) }}
    </b-notification>

    <template v-else-if="data">
      <header class="columns is-vcentered">
        <div class="column">
          <h1 class="title is-4">
            {{ subscriber && subscriber.name ? subscriber.name : email }}
            <b-tag v-if="subscriber" :class="subscriber.status">
              {{ $t(`subscribers.status.${subscriber.status}`) }}
            </b-tag>
          </h1>
          <p class="email has-text-grey">{{ email }}</p>
        </div>
        <div class="column has-text-right" v-if="subscriber">
          <router-link :to="{ name: 'subscriber', params: { id: subscriber.id } }" class="is-size-7">
            {{ $tc('globals.terms.subscriber', 1) }} #{{ subscriber.id }}
            <b-icon icon="arrow-top-right" size="is-small" />
          </router-link>
        </div>
      </header>

      <!-- Listmonk down loses the contact record, not the drip history. Saying
           so beside a history that is entirely present is the honest shape:
           blanking the page would imply we know less than we do. -->
      <b-notification v-if="!data.listmonk_available" type="is-warning" :closable="false">
        {{ $t('contacts.listmonkUnavailable') }}
        <span v-if="data.listmonk_error"> {{ data.listmonk_error }}</span>
      </b-notification>

      <div class="columns">
        <div class="column is-half">
          <div class="box funnel">
            <h3 class="is-size-7 has-text-grey is-uppercase">{{ $t('funnel.title') }}</h3>
            <p class="stage-now">
              <template v-if="currentStage">{{ $t(currentStage.i18n) }}</template>
              <span v-else class="has-text-grey is-italic">{{ $t('globals.terms.none') }}</span>
            </p>
            <!-- The whole ladder, not just the rung: the rungs are ordered and
                 the useful question is how far along someone is, which a single
                 label cannot answer. -->
            <ol class="ladder">
              <li v-for="s in stages" :key="s.id"
                  :class="{ reached: isReached(s), current: isCurrent(s) }">
                <span class="pip" />
                <span class="rung">{{ $t(s.i18n) }}</span>
              </li>
            </ol>
            <p class="is-size-7 has-text-grey">{{ $t('funnel.derivedHelp') }}</p>
          </div>
        </div>

        <div class="column is-half">
          <div class="box">
            <h3 class="is-size-7 has-text-grey is-uppercase">{{ $t('contacts.engagement') }}</h3>
            <div class="counts">
              <div>
                <span class="n">{{ data.enrollments.length }}</span>
                <span class="k">{{ $t('contacts.enrollments') }}</span>
              </div>
              <div>
                <span class="n">{{ activeCount }}</span>
                <span class="k">{{ $t('contacts.activeSequences') }}</span>
              </div>
              <div>
                <span class="n">{{ counts.sent }}</span>
                <span class="k">{{ $t('contacts.sent') }}</span>
              </div>
              <div>
                <span class="n">{{ counts.opened }}</span>
                <span class="k">{{ $t('contacts.opened') }}</span>
              </div>
              <div>
                <span class="n">{{ counts.clicked }}</span>
                <span class="k">{{ $t('contacts.clicked') }}</span>
              </div>
            </div>
            <p class="is-size-7 has-text-grey">
              {{ $t('contacts.lastSent') }}:
              <template v-if="lastSentAt">{{ $utils.niceDate(lastSentAt, true) }}</template>
              <template v-else>{{ $t('contacts.never') }}</template>
            </p>
          </div>

          <div class="box" v-if="subscriber">
            <h3 class="is-size-7 has-text-grey is-uppercase">{{ $t('subscribers.lists') }}</h3>
            <template v-if="subscriber.lists && subscriber.lists.length">
              <router-link v-for="l in subscriber.lists" :key="l.id" class="tag list-tag"
                           :to="{ name: 'subscribers_list', params: { listID: l.id } }">
                {{ l.name }}
              </router-link>
            </template>
            <p v-else class="has-text-grey is-italic">{{ $t('globals.terms.none') }}</p>
          </div>
        </div>
      </div>

      <h2 class="title is-6">{{ $t('contacts.timeline') }}</h2>

      <!-- Rendered in the order the API merged it. Re-sorting here would pick a
           different tie-break to the one the server already applied, so a send
           and its delivery in the same second could swap places on reload. -->
      <ol class="timeline" v-if="data.timeline.length">
        <li v-for="(t, i) in data.timeline" :key="entryKey(t, i)" :class="['entry', t.kind]">
          <span class="mark"><b-icon :icon="kindIcon(t.kind)" size="is-small" /></span>
          <div class="body">
            <p class="desc">{{ t.description }}</p>
            <p class="meta is-size-7 has-text-grey">
              {{ $utils.shortDate(t.at, true) }}
              <template v-if="t.sequence_name">
                &middot;
                <router-link v-if="sequenceID(t.sequence_name)"
                             :to="{ name: 'sequence', params: { id: sequenceID(t.sequence_name) } }">
                  {{ t.sequence_name }}
                </router-link>
                <span v-else>{{ t.sequence_name }}</span>
              </template>
            </p>
          </div>
        </li>
      </ol>

      <!-- Most of the list has never been mailed, so this is the ordinary case
           rather than a failure, and it should not read like one. -->
      <empty-placeholder v-else icon="email-outline" :label="$t('contacts.noHistory')" />
    </template>
  </section>
</template>

<script>
import Vue from 'vue';
import EmptyPlaceholder from '../components/EmptyPlaceholder.vue';
import { FUNNEL_STAGES, stageByID } from '../funnel';
import { getCrmContact } from '../api';

// Only icons in listmonk's fontello subset render at all, so each kind is
// mapped explicitly rather than named from the payload.
const KIND_ICONS = {
  enrolled: 'account-check-outline',
  sent: 'email-outline',
  delivered: 'check-circle-outline',
  opened: 'file-find-outline',
  clicked: 'link-variant',
  bounced: 'email-bounce',
  complained: 'warning-empty',
  stage: 'arrow-up',
  cancelled: 'cancel',
};

export default Vue.extend({
  name: 'CrmContact',
  components: { EmptyPlaceholder },

  data() {
    return {
      data: null,
      loading: true,
      notFound: false,
      crmError: null,
    };
  },

  computed: {
    // vue-router has already decoded the segment, so this is the raw address
    // including any '+' the URL carried literally.
    email() {
      return this.$route.params.email || '';
    },

    subscriber() {
      return this.data ? this.data.subscriber : null;
    },

    stages() {
      return FUNNEL_STAGES;
    },

    // Null whenever the attributes it is derived from are, which is exactly the
    // Listmonk outage case.
    currentStage() {
      return this.data && this.data.stage ? stageByID(this.data.stage) : null;
    },

    activeCount() {
      return this.data.enrollments.filter((e) => e.status === 'active').length;
    },

    // Counted off the merged timeline rather than off sends and events
    // separately, so the numbers can never disagree with the rows below them.
    counts() {
      const out = { sent: 0, opened: 0, clicked: 0 };
      this.data.timeline.forEach((t) => {
        if (t.kind in out) { out[t.kind] += 1; }
      });
      return out;
    },

    lastSentAt() {
      const t = this.data.timeline.find((e) => e.kind === 'sent');
      return t ? t.at : null;
    },

    // Timeline entries name their sequence but do not carry its id, so the link
    // target comes from the enrolments and sends, which do.
    sequenceIDs() {
      const m = {};
      this.data.enrollments.forEach((e) => { m[e.sequence_name] = e.sequence_id; });
      this.data.sends.forEach((s) => { m[s.sequence_name] = s.sequence_id; });
      return m;
    },
  },

  methods: {
    isReached(s) {
      return this.data.stage_rank !== null && s.rank <= this.data.stage_rank;
    },

    isCurrent(s) {
      return !!this.currentStage && s.id === this.currentStage.id;
    },

    kindIcon(kind) {
      return KIND_ICONS[kind] || 'text';
    },

    sequenceID(name) {
      return this.sequenceIDs[name] || null;
    },

    // Stage rows carry no id of their own, and two entries can share a kind and
    // a timestamp, so the index is part of the key. The list is replaced whole
    // on reload and never reordered in place, so that is stable.
    entryKey(t, i) {
      return `${t.kind}-${t.at}-${i}`;
    },

    async load() {
      this.loading = true;
      this.notFound = false;
      this.crmError = null;
      try {
        this.data = await getCrmContact(this.email);
      } catch (e) {
        if (e.response && e.response.status === 404) {
          this.notFound = true;
        } else {
          // The CRM puts its sentence in .error, where listmonk's interceptor
          // looks for .message, so unwrapping it is on the caller.
          this.crmError = (e.response && e.response.data && e.response.data.error) || e.message || true;
        }
      } finally {
        this.loading = false;
      }
    },
  },

  watch: {
    // The subscribers screen can land here repeatedly without unmounting.
    $route() { this.load(); },
  },

  mounted() { this.load(); },
});
</script>

<style scoped lang="scss">
.crm-contact {
  .email {
    font-family: monospace;
    font-variant-ligatures: none;
  }

  .list-tag {
    margin-right: 5px;
  }

  .funnel {
    .stage-now {
      font-weight: 600;
      margin: 2px 0 10px 0;
    }

    .ladder {
      list-style: none;
      margin: 0 0 10px 0;
      padding: 0;

      li {
        display: flex;
        align-items: center;
        padding: 3px 0;
        color: #9a9a9a;
      }

      .pip {
        width: 10px;
        height: 10px;
        border-radius: 50%;
        border: 2px solid #dbdbdb;
        margin-right: 10px;
        flex: none;
      }

      li.reached {
        color: #363636;
        .pip { background: #36995b; border-color: #36995b; }
      }

      li.current .rung { font-weight: 600; }
    }
  }

  .counts {
    display: flex;
    flex-wrap: wrap;
    gap: 22px;
    margin: 6px 0 10px 0;

    .n {
      display: block;
      font-size: 1.6em;
      line-height: 1.2;
      font-weight: 600;
    }

    .k {
      font-size: 0.75em;
      text-transform: uppercase;
      color: #7a7a7a;
    }
  }

  .timeline {
    list-style: none;
    margin: 0;
    padding: 0;

    .entry {
      display: flex;
      padding: 10px 0;
      border-bottom: 1px solid #ededed;

      &:last-child { border-bottom: 0; }
    }

    .mark {
      width: 30px;
      height: 30px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      margin-right: 12px;
      flex: none;
      background: #f3f3f3;
      color: #7a7a7a;
    }

    .body { min-width: 0; }
    .desc { margin: 0; word-break: break-word; }
    .meta { margin: 2px 0 0 0; }

    /* Colour carries the kind, because the descriptions are prose from the API
       and a bounce should not have to be read to be noticed. */
    .sent .mark { background: #e7effb; color: #0055d4; }
    .delivered .mark,
    .opened .mark,
    .clicked .mark { background: #e8f5e9; color: #256029; }
    .bounced .mark { background: #fff3e0; color: #9a5b00; }
    .complained .mark,
    .cancelled .mark { background: #fdecea; color: #c0341d; }
    .stage .mark { background: #f1ecfa; color: #5b3fa8; }
  }
}
</style>
