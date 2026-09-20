<template>
  <b-menu-list>
    <b-menu-item :to="{ name: 'dashboard' }" tag="router-link" :active="activeItem.dashboard"
      icon="view-dashboard-variant-outline" :label="$t('menu.dashboard')" /><!-- dashboard -->

    <b-menu-item :expanded="isOpen('crm-campaigns')" :active="isOpen('crm-campaigns')" data-cy="crm-campaigns"
      @update:active="(state) => toggleGroup('crm-campaigns', state)" icon="file-multiple-outline"
      :label="$t('crmCampaigns.title')">
      <b-menu-item :to="{ name: 'crmCampaigns' }" tag="router-link" :active="isItemActive('crmCampaigns', ['crmCampaigns', 'crmCampaign'])"
        data-cy="all-crm-campaigns" icon="file-multiple-outline" :label="$t('crmCampaigns.all')" />
    </b-menu-item><!-- campaigns, the grouping -->

    <b-menu-item v-if="$can('campaigns:*')" :expanded="isOpen('campaigns')" :active="isOpen('campaigns')"
      data-cy="campaigns" @update:active="(state) => toggleGroup('campaigns', state)" icon="rocket-launch-outline"
      :label="$t('menu.broadcasts')">
      <b-menu-item v-if="$can('campaigns:get')" :to="{ name: 'campaigns' }" tag="router-link"
        :active="isItemActive('campaigns', ['campaigns', 'campaign'])" data-cy="all-campaigns" icon="rocket-launch-outline"
        :label="$t('menu.allBroadcasts')" />
      <b-menu-item v-if="$can('campaigns:get_analytics')" :to="{ name: 'campaignAnalytics' }" tag="router-link"
        :active="activeItem.campaignAnalytics" data-cy="analytics" icon="chart-bar"
        :label="$t('menu.broadcastAnalytics')" />
    </b-menu-item><!-- broadcasts -->

    <!-- Sim Sense fork: the drip layer. Sits with the two send mechanisms
         because it is one of them, above the content and the contacts they
         both draw on. -->
    <b-menu-item :expanded="isOpen('sequences')" :active="isOpen('sequences')" data-cy="sequences"
      @update:active="(state) => toggleGroup('sequences', state)" icon="calendar-clock"
      :label="$t('sequences.title')">
      <b-menu-item :to="{ name: 'sequences' }" tag="router-link"
        :active="isItemActive('sequences', ['sequences', 'sequence'])" data-cy="all-sequences" icon="calendar-clock"
        :label="$t('sequences.all')" />
      <b-menu-item :to="{ name: 'funnel' }" tag="router-link" :active="activeItem.funnel" data-cy="funnel"
        icon="chart-bar" :label="$t('funnel.title')" />
    </b-menu-item><!-- sequences -->

    <!-- Templates and media are shared: sequence steps render through the same
         templates broadcasts do, so filing them under broadcasts would hide
         them from the half of the product that the gallery's 'used by' line is
         about. -->
    <b-menu-item v-if="$can('templates:get', 'media:*')" :expanded="isOpen('content')" :active="isOpen('content')"
      data-cy="content" @update:active="(state) => toggleGroup('content', state)" icon="file-image-outline"
      label="Content">
      <b-menu-item v-if="$can('templates:get')" :to="{ name: 'templates' }" tag="router-link"
        :active="activeItem.templates" data-cy="templates" icon="file-image-outline"
        :label="$t('globals.terms.templates')" />
      <b-menu-item v-if="$can('media:*')" :to="{ name: 'media' }" tag="router-link" :active="activeItem.media"
        data-cy="media" icon="image-outline" :label="$t('menu.media')" />
    </b-menu-item><!-- content -->

    <!-- Lists and subscribers are shared by both send mechanisms too, so they
         are one section about who can be reached rather than two. -->
    <b-menu-item :expanded="isOpen('contacts')" :active="isOpen('contacts')" data-cy="contacts"
      @update:active="(state) => toggleGroup('contacts', state)" icon="account-multiple" label="Contacts">
      <b-menu-item v-if="$can('subscribers:get_all', 'subscribers:get')" :to="{ name: 'subscribers' }" tag="router-link"
        :active="isItemActive('subscribers', ['subscribers', 'subscribers_list', 'subscriber', 'crmContact'])" data-cy="all-subscribers" icon="account-multiple"
        :label="$t('menu.allSubscribers')" />
      <b-menu-item v-if="$can('subscribers:import')" :to="{ name: 'import' }" tag="router-link"
        :active="activeItem.import" data-cy="import" icon="file-upload-outline" :label="$t('menu.import')" />
      <b-menu-item :to="{ name: 'lists' }" tag="router-link" :active="isItemActive('lists', ['lists', 'list'])" data-cy="all-lists"
        icon="format-list-bulleted-square" :label="$t('menu.allLists')" />
      <b-menu-item :to="{ name: 'forms' }" tag="router-link" :active="activeItem.forms" class="forms"
        icon="newspaper-variant-outline" :label="$t('menu.forms')" />
      <b-menu-item v-if="$can('bounces:get')" :to="{ name: 'bounces' }" tag="router-link" :active="activeItem.bounces"
        data-cy="bounces" icon="email-bounce" :label="$t('globals.terms.bounces')" />
    </b-menu-item><!-- contacts -->

    <b-menu-item v-if="$can('settings:*', 'users:*', 'roles:*')" :expanded="isOpen('settings')"
      :active="isOpen('settings')" data-cy="settings" @update:active="(state) => toggleGroup('settings', state)"
      icon="cog-outline" :label="$t('menu.settings')">
      <b-menu-item v-if="$can('settings:get')" :to="{ name: 'settings' }" tag="router-link"
        :active="activeItem.settings" data-cy="all-settings" icon="cog-outline" :label="$t('menu.settings')" />
      <b-menu-item v-if="$can('settings:maintain')" :to="{ name: 'maintenance' }" tag="router-link"
        :active="activeItem.maintenance" data-cy="maintenance" icon="wrench-outline" :label="$t('menu.maintenance')" />
      <b-menu-item v-if="$can('settings:get')" :to="{ name: 'logs' }" tag="router-link" :active="activeItem.logs"
        data-cy="logs" icon="format-list-bulleted-square" :label="$t('menu.logs')" />
      <b-menu-item v-if="$can('users:get')" :to="{ name: 'users' }" tag="router-link" :active="activeItem.users"
        data-cy="users" icon="account-multiple" :label="$t('globals.terms.users')" />
      <b-menu-item v-if="$can('roles:get')" :to="{ name: 'userRoles' }" tag="router-link" :active="activeItem.userRoles"
        data-cy="userRoles" icon="newspaper-variant-outline" :label="$t('users.userRoles')" />
      <b-menu-item v-if="$can('roles:get')" :to="{ name: 'listRoles' }" tag="router-link" :active="activeItem.listRoles"
        data-cy="listRoles" icon="format-list-bulleted-square" :label="$t('users.listRoles')" />
    </b-menu-item><!-- settings -->
  </b-menu-list>
</template>

<script>
import { mapState } from 'vuex';

// Which route belongs in which section. The parent derives `activeGroup` from
// each route's `meta.group`, but the sections here no longer line up with those
// names (content and audience are drawn from several of them), so the mapping
// that decides what is open lives beside the markup it describes.
const GROUP_ROUTES = {
  'crm-campaigns': ['crmCampaigns', 'crmCampaign'],
  campaigns: ['campaigns', 'campaign', 'campaignAnalytics'],
  sequences: ['sequences', 'sequence', 'funnel'],
  content: ['templates', 'media'],
  contacts: ['subscribers', 'subscribers_list', 'subscriber', 'crmContact', 'import', 'lists', 'list', 'forms', 'bounces'],
  settings: ['settings', 'logs', 'maintenance', 'users', 'userRoles', 'listRoles', 'userProfile'],
};

export default {
  name: 'Navigation',

  props: {
    activeItem: { type: Object, default: () => { } },
    activeGroup: { type: Object, default: () => { } },
    isMobile: Boolean,
  },

  data() {
    return {
      // The section the user has just collapsed by hand. Without it, the
      // section holding the current page would spring open again the moment it
      // was closed, because being on one of its pages is what opens it.
      collapsed: null,
    };
  },

  watch: {
    $route() {
      this.collapsed = null;
    },
  },

  methods: {
    // True when the current route is the item's own page or one of the detail
    // pages belonging to it. App.vue keys activeItem on the route name alone,
    // so without this every detail page leaves its menu item unlit.
    isItemActive(name, routes) {
      const isNew = Boolean(this.$route.params) && this.$route.params.id === 'new';

      // A 'Create new' sibling owns the literal id 'new', so the list item must
      // not claim it as well and light two rows at once.
      if (this.activeItem[name]) {
        return !isNew;
      }

      return !isNew && (routes || []).indexOf(this.$route.name) > -1;
    },

    // Open if the parent says so, or if the page being looked at is in there.
    isOpen(group) {
      if (this.collapsed === group) {
        return false;
      }

      return this.activeGroup[group] === true
        || GROUP_ROUTES[group].indexOf(this.$route.name) > -1;
    },

    toggleGroup(group, state) {
      this.collapsed = state ? null : group;
      this.$emit('toggleGroup', group, state);
    },

    doLogout() {
      this.$emit('doLogout');
    },
  },

  computed: {
    ...mapState(['profile']),
  },

  mounted() {
    // A hack to close the open accordion burger menu items on click.
    // Buefy does not have a way to do this.
    if (this.isMobile) {
      document.querySelectorAll('.navbar li a[href]').forEach((e) => {
        e.onclick = () => {
          document.querySelector('.navbar-burger').click();
        };
      });
    }
  },
};

</script>
