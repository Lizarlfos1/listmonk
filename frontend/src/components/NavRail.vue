<template>
  <div class="nav-rail-wrap" :style="navStyle" @mouseleave="hovered = null" @focusout="onFocusOut">
    <nav class="nav-rail">
      <button v-for="s in sections" :key="s.id" type="button" class="rail-item"
        :class="{ 'is-active': s.id === activeSection, 'is-shown': s.id === hovered }" :data-cy="s.id"
        @mouseenter="hovered = s.id" @focus="hovered = s.id" @click="selectSection(s)">
        <b-icon :icon="s.icon" />
        <span>{{ s.label }}</span>
      </button>
    </nav>

    <aside class="nav-panel" v-if="panelSection">
      <header class="panel-head">
        <div class="panel-title">
          <b-icon :icon="panelSection.icon" />
          <h2>{{ panelSection.label }}</h2>
        </div>
        <p class="panel-description">{{ panelSection.description }}</p>
      </header>

      <!-- Every group carries a heading, including the sections with a single
           group. A panel that sometimes has headings and sometimes does not
           reads as though something failed to load. -->
      <div class="panel-group" v-for="(g, n) in panelSection.groups" :key="n">
        <h3 v-if="g.heading">{{ g.heading }}</h3>
        <ul>
          <li v-for="item in g.items" :key="item.dataCy">
            <!-- An item is either a page of this admin or a link off it. The
                 external one never lights up: it is not somewhere you can be. -->
            <a v-if="item.href" :href="item.href" :data-cy="item.dataCy" target="_blank" rel="noopener noreferrer">
              {{ item.label }} <b-icon icon="chevron-right" size="is-small" />
            </a>
            <router-link v-else :to="item.to" :data-cy="item.dataCy" :class="{ 'is-active': isItemActive(item) }">
              {{ item.label }}
            </router-link>
          </li>
        </ul>
      </div>
    </aside>
  </div>
</template>

<script>
// Where the product analytics live. Hardcoded rather than read from the
// environment because the frontend is compiled into the Go binary, so a build
// time value and a hardcoded one are the same thing with different ceremony,
// and a wrong one here is a dead link rather than a broken page.
//
// Project 459544, dashboard 2117404: the funnel the CRM reports on, built from
// the events the edge functions emit. The CRM's own numbers stay in the CRM;
// this is the behavioural side that Listmonk and the drip layer cannot see.
const POSTHOG_DASHBOARD_URL = 'https://us.posthog.com/project/459544/dashboard/2117404';

// The two-column admin navigation: a permanent rail of sections, and a panel
// listing the pages of the section under the pointer. The panel is a flyout
// over the page, not a column beside it, so appearing and disappearing with
// the pointer never moves the page underneath.
//
// The structure is declared here rather than read from the router because the
// grouping is editorial: which pages belong together, and what to call the
// group, is a judgement the routes do not carry. `routes` lists every route
// that should light a section up, including the detail pages (a subscriber, a
// broadcast) that have no entry of their own.
export default {
  name: 'NavRail',

  data() {
    return {
      // The section under the pointer. The panel shows it while it is set, so
      // a section's pages can be read without leaving the page you are on.
      // Cleared on leaving the nav, which closes the panel: it sits over the
      // page rather than beside it, so leaving it open would cover the thing
      // you left the nav to read.
      hovered: null,

      // Height of the fixed navbar, measured rather than assumed: the nav sits
      // directly under it, and a guessed figure shows up as a gap or as a
      // strip of nav hidden behind it.
      navbarHeight: 0,
    };
  },

  watch: {
    $route() {
      this.hovered = null;
    },
  },

  methods: {
    // Keyboard equivalent of the pointer leaving: tabbing out of the nav
    // altogether, not tabbing from the rail into the panel it just opened.
    measureNavbar() {
      const navbar = document.querySelector('.navbar');
      this.navbarHeight = navbar ? navbar.offsetHeight : 0;
    },

    onFocusOut(e) {
      if (!this.$el.contains(e.relatedTarget)) {
        this.hovered = null;
      }
    },

    // Hovering already shows what is in a section, so the click is free to do
    // the thing hovering cannot: go there.
    selectSection(s) {
      const first = s.groups
        .reduce((acc, g) => acc.concat(g.items), [])
        .find((i) => !i.href);
      if (first && !this.isItemActive(first)) {
        this.$router.push(first.to);
      }
    },

    // An item lights up for its own page and for the detail pages that belong
    // to it: a sequence belongs to All sequences, a subscriber and a contact
    // timeline belong to All subscribers. Matching on the route name alone left
    // every one of those pages with nothing lit in the panel, which reads as
    // though you had navigated out of the section you are plainly still in.
    // `item.routes` names the extra ones, the same way a section's does.
    isItemActive(item) {
      // An external link has no route and can never be the current page.
      if (item.href) {
        return false;
      }

      const names = item.routes || [item.to.name];
      if (names.indexOf(this.$route.name) < 0) {
        return false;
      }

      // 'Create new' and an existing record are the same route, told apart by
      // the id. A pinned id must match exactly.
      if (item.to.params && item.to.params.id) {
        return this.$route.params.id === item.to.params.id;
      }

      // The converse: 'Create new' owns the literal id 'new', so a sibling
      // 'All x' item must not also claim it and light two rows at once.
      if (this.$route.params && this.$route.params.id === 'new') {
        return false;
      }

      return true;
    },
  },

  computed: {
    // The nav minus everything the logged in user may not see. A section whose
    // pages are all denied disappears with them.
    sections() {
      return this.definition
        .map((s) => ({
          ...s,
          groups: s.groups
            .map((g) => ({ ...g, items: g.items.filter((i) => !i.can || this.$can(...i.can)) }))
            .filter((g) => g.items.length > 0),
        }))
        .filter((s) => s.groups.length > 0);
    },

    activeSection() {
      const s = this.sections.find((i) => i.routes.indexOf(this.$route.name) > -1);
      return s ? s.id : null;
    },

    panelSection() {
      return this.sections.find((s) => s.id === this.hovered);
    },

    navStyle() {
      return {
        top: `${this.navbarHeight}px`,
        height: `calc(100vh - ${this.navbarHeight}px)`,
      };
    },

    definition() {
      return [
        {
          id: 'dashboard',
          icon: 'view-dashboard-variant-outline',
          label: this.$t('menu.dashboard'),
          description: 'How the list is growing and what went out lately.',
          routes: ['dashboard'],
          groups: [
            {
              heading: 'Overview',
              items: [
                { to: { name: 'dashboard' }, label: this.$t('menu.dashboard'), dataCy: 'all-dashboard' },
              ],
            },
            {
              heading: 'Product analytics',
              items: [
                {
                  href: POSTHOG_DASHBOARD_URL,
                  label: 'PostHog dashboard',
                  dataCy: 'posthog-dashboard',
                },
              ],
            },
          ],
        },
        {
          id: 'crm-campaigns',
          icon: 'file-multiple-outline',
          label: this.$t('crmCampaigns.title'),
          description: this.$t('crmCampaigns.description'),
          routes: ['crmCampaigns', 'crmCampaign'],
          groups: [
            {
              heading: this.$t('crmCampaigns.title'),
              items: [
                {
                  to: { name: 'crmCampaigns' },
                  routes: ['crmCampaigns', 'crmCampaign'],
                  label: this.$t('crmCampaigns.all'),
                  dataCy: 'all-crm-campaigns',
                },
              ],
            },
          ],
        },
        {
          id: 'campaigns',
          icon: 'rocket-launch-outline',
          // Broadcasts, not campaigns. The word campaign means the grouping in
          // this repo and has its own section above; only listmonk's schema
          // and routes still say campaign.
          label: this.$t('menu.broadcasts'),
          description: 'One-off sends: written, scheduled and reported on individually.',
          routes: ['campaigns', 'campaign', 'campaignAnalytics'],
          groups: [
            {
              heading: this.$t('menu.broadcasts'),
              items: [
                {
                  to: { name: 'campaigns' },
                  routes: ['campaigns', 'campaign'],
                  label: this.$t('menu.allBroadcasts'),
                  dataCy: 'all-campaigns',
                  can: ['campaigns:get'],
                },
              ],
            },
            {
              heading: 'Reporting',
              items: [
                {
                  to: { name: 'campaignAnalytics' },
                  // Named for what it can report on: this is listmonk's own
                  // analytics over tracked campaign sends, and a sequence step
                  // goes out through /api/tx, so it writes no row any of these
                  // charts read. A bare "Analytics" here reads as the place all
                  // reporting lives, which would send people looking for
                  // sequence figures that only exist on the sequence itself.
                  label: this.$t('menu.broadcastAnalytics'),
                  dataCy: 'analytics',
                  can: ['campaigns:get_analytics'],
                },
              ],
            },
          ],
        },
        {
          id: 'sequences',
          icon: 'calendar-clock',
          label: this.$t('sequences.title'),
          description: 'Drips that send a step at a time, counted from the day someone is enrolled.',
          routes: ['sequences', 'sequence', 'funnel'],
          groups: [
            {
              heading: this.$t('sequences.title'),
              items: [
                {
                  to: { name: 'sequences' },
                  routes: ['sequences', 'sequence'],
                  label: this.$t('sequences.all'),
                  dataCy: 'all-sequences',
                },
                // The funnel sits with the sequences rather than in its own
                // section because it is not a report: it is where a sequence is
                // wired to a rung, and the thing being wired is a sequence.
                { to: { name: 'funnel' }, label: this.$t('funnel.title'), dataCy: 'funnel' },
              ],
            },
          ],
        },
        // Templates and media sit in their own section rather than under
        // broadcasts, because sequence steps render through the same templates
        // and the gallery's 'used by' line is about sequences. Filing shared
        // content under one of the two send mechanisms hides it from the other.
        {
          id: 'content',
          icon: 'file-image-outline',
          label: 'Content',
          description: 'The templates and images that both broadcasts and sequence steps are built from.',
          routes: ['templates', 'media'],
          groups: [
            {
              heading: 'Content',
              items: [
                {
                  to: { name: 'templates' },
                  label: this.$t('globals.terms.templates'),
                  dataCy: 'templates',
                  can: ['templates:get'],
                },
                {
                  to: { name: 'media' }, label: this.$t('menu.media'), dataCy: 'media', can: ['media:*'],
                },
              ],
            },
          ],
        },
        // Lists and subscribers are shared by both send mechanisms too, so they
        // are one section about who can be reached rather than two.
        {
          id: 'contacts',
          icon: 'account-multiple',
          label: 'Contacts',
          description: 'Everyone who can be reached, the lists they are on, and who can no longer be reached.',
          routes: ['subscribers', 'subscribers_list', 'subscriber', 'crmContact', 'import', 'lists', 'list', 'forms', 'bounces'],
          groups: [
            {
              heading: 'People',
              items: [
                {
                  to: { name: 'subscribers' },
                  routes: ['subscribers', 'subscribers_list', 'subscriber', 'crmContact'],
                  label: this.$t('menu.allSubscribers'),
                  dataCy: 'all-subscribers',
                  can: ['subscribers:get_all', 'subscribers:get'],
                },
                {
                  to: { name: 'import' },
                  label: this.$t('menu.import'),
                  dataCy: 'import',
                  can: ['subscribers:import'],
                },
              ],
            },
            {
              heading: this.$t('globals.terms.lists'),
              items: [
                {
                  to: { name: 'lists' },
                  routes: ['lists', 'list'],
                  label: this.$t('menu.allLists'),
                  dataCy: 'all-lists',
                },
                { to: { name: 'forms' }, label: this.$t('menu.forms'), dataCy: 'forms' },
              ],
            },
            {
              heading: 'Deliverability',
              items: [
                {
                  to: { name: 'bounces' },
                  label: this.$t('globals.terms.bounces'),
                  dataCy: 'bounces',
                  can: ['bounces:get'],
                },
              ],
            },
          ],
        },
        {
          id: 'settings',
          icon: 'cog-outline',
          label: this.$t('menu.settings'),
          description: 'How this installation is configured, and what it has been doing.',
          routes: ['settings', 'logs', 'maintenance', 'users', 'userRoles', 'listRoles', 'userProfile'],
          groups: [
            {
              heading: this.$t('menu.settings'),
              items: [
                {
                  to: { name: 'settings' },
                  label: this.$t('menu.settings'),
                  dataCy: 'all-settings',
                  can: ['settings:get'],
                },
                {
                  to: { name: 'maintenance' },
                  label: this.$t('menu.maintenance'),
                  dataCy: 'maintenance',
                  can: ['settings:maintain'],
                },
                {
                  to: { name: 'logs' }, label: this.$t('menu.logs'), dataCy: 'logs', can: ['settings:get'],
                },
              ],
            },
            {
              heading: 'Access',
              items: [
                {
                  to: { name: 'users' },
                  label: this.$t('globals.terms.users'),
                  dataCy: 'users',
                  can: ['users:get'],
                },
                {
                  to: { name: 'userRoles' },
                  label: this.$t('users.userRoles'),
                  dataCy: 'userRoles',
                  can: ['roles:get'],
                },
                {
                  to: { name: 'listRoles' },
                  label: this.$t('users.listRoles'),
                  dataCy: 'listRoles',
                  can: ['roles:get'],
                },
              ],
            },
          ],
        },
      ];
    },
  },
  mounted() {
    this.measureNavbar();
    window.addEventListener('resize', this.measureNavbar);
  },

  beforeDestroy() {
    window.removeEventListener('resize', this.measureNavbar);
  },
};
</script>
