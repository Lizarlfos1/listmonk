<template>
  <b-notification v-if="untagged.length" type="is-warning" has-icon icon="alert" :closable="false"
    class="broadcast-tag-notice">
    <p>{{ $t('broadcastTag.warning', { n: untagged.length }) }}</p>
    <p class="is-size-7">{{ $t('broadcastTag.help') }}</p>
    <pre class="is-size-7">{{ snippet }}</pre>
    <ul class="is-size-7 untagged">
      <li v-for="(url, i) in untagged.slice(0, 5)" :key="i">{{ url }}</li>
    </ul>
  </b-notification>
</template>

<script>
import Vue from 'vue';

// The tag the CRM reads back off the SES click event to tell which broadcast a
// click came from. A sequence step needs nothing like this, because the SES
// message id already resolves to a step we recorded sending. A broadcast is
// sent by listmonk, which knows who clicked what inside its own database, and
// this repo does not read that database, so the link has to say for itself.
const TAG = 'ss_b';
const SNIPPET = '?ss_b={{ .Campaign.ID }}';

// Only links to the product are worth warning about. An unsubscribe link, a
// link to a help article or a social profile leads nowhere that can produce a
// purchase, and flagging those would train everyone to close this notice.
const PRODUCT_HOST = /(^|\.)simsense\.app$/i;

export default Vue.extend({
  name: 'BroadcastTagNotice',

  props: {
    body: { type: String, default: '' },
  },

  data() {
    return { snippet: SNIPPET };
  },

  computed: {
    /**
     * Product links in this body with no tracking tag on them.
     *
     * Parsed out of the rendered HTML rather than with a regular expression
     * over the source, so a link built by the visual editor, one typed by
     * hand and one carrying an existing query string are all read the same
     * way. Template expressions inside an href are left alone: a URL with
     * {{ }} in it does not parse, and it is not this notice's business to
     * decide whether it will once rendered.
     */
    untagged() {
      if (!this.body) {
        return [];
      }

      const doc = new DOMParser().parseFromString(this.body, 'text/html');
      const out = [];
      doc.querySelectorAll('a[href]').forEach((a) => {
        const href = a.getAttribute('href');
        if (!href || href.includes('{{')) {
          return;
        }
        let url;
        try {
          url = new URL(href, 'https://simsense.app');
        } catch {
          return;
        }
        if (!PRODUCT_HOST.test(url.hostname)) {
          return;
        }
        if (!url.searchParams.has(TAG)) {
          out.push(href);
        }
      });
      return out;
    },
  },
});
</script>
