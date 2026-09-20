<template>
  <b-modal scroll="keep" :aria-modal="true" :active="isVisible" :width="520" @close="close">
    <div class="modal-card content template-test-dialog" style="width: auto">
      <header class="modal-card-head">
        <h4>{{ $t('gallery.testFor', { name: template.name }) }}</h4>
      </header>

      <section class="modal-card-body">
        <b-field :label="$t('gallery.testTo')" :message="$t('gallery.testToHelp')">
          <b-input v-model="email" type="email" ref="email" :placeholder="$t('gallery.testToPlaceholder')"
            data-cy="test-email" @keydown.native.enter="send" />
        </b-field>

        <!-- Every {{ .Tx.Data.* }} parameter is optional and every template
             renders without one, so an empty object is the normal case and the
             harsher of the two to look at. The field is for checking the other
             path, which is why it starts collapsed. -->
        <p class="is-size-7">
          <a href="#" @click.prevent="showData = !showData" data-cy="test-data-toggle">
            {{ showData ? $t('gallery.testDataHide') : $t('gallery.testDataShow') }}
          </a>
        </p>
        <b-field v-if="showData" :message="$t('gallery.testDataHelp')" :type="dataError ? 'is-danger' : ''">
          <b-input v-model="dataJSON" type="textarea" rows="4" spellcheck="false" data-cy="test-data" />
        </b-field>

        <b-message type="is-warning" :closable="false" size="is-small">
          {{ $t('gallery.testWarning') }}
        </b-message>

        <b-message v-if="error" type="is-danger" :closable="false" size="is-small" data-cy="test-error">
          <strong>{{ error.error }}</strong>
          <p v-if="error.detail" class="mt-1">{{ error.detail }}</p>
        </b-message>
      </section>

      <footer class="modal-card-foot has-text-right">
        <b-button @click="close">{{ $t('globals.buttons.close') }}</b-button>
        <b-button type="is-primary" icon-left="email-outline" :loading="isSending" :disabled="!email"
          data-cy="btn-send-test" @click="send">
          {{ $t('gallery.testSend') }}
        </b-button>
      </footer>
    </div>
  </b-modal>
</template>

<script>
import { sendTemplateTest } from '../api';

// One copy of a template to one inbox, so it can be read in a mail client
// before anyone else gets it. The gallery thumbnail is listmonk rendering the
// HTML, which says nothing about what Gmail does to it, whether the images load
// from outside the tailnet, or how the subject reads in a list of unread mail.
//
// The address is remembered, because testing is iterative: you send, read it,
// fix the copy, send again, and retyping your own address each time is the
// friction that stops the second send happening.
const EMAIL_PREF = 'templates.testEmail';

export default {
  name: 'TemplateTestDialog',

  props: {
    // { id, name } from listmonk's own template list, or from a sequence step's
    // template. Only the id is sent; the copy and the subject are whatever
    // listmonk holds right now, which is the thing under test.
    template: { type: Object, required: true },
  },

  data() {
    return {
      isVisible: true,
      isSending: false,
      email: this.$utils.getPref(EMAIL_PREF) || '',
      showData: false,
      dataJSON: '{\n}',
      dataError: false,
      error: null,
    };
  },

  methods: {
    close() {
      this.isVisible = false;
      this.$emit('close');
    },

    async send() {
      if (this.isSending || !this.email) { return; }

      let data;
      if (this.showData && this.dataJSON.trim()) {
        try {
          data = JSON.parse(this.dataJSON);
        } catch (e) {
          this.dataError = true;
          this.error = { error: this.$t('gallery.testDataInvalid'), detail: e.message };
          return;
        }
      }
      this.dataError = false;
      this.error = null;

      this.isSending = true;
      try {
        const res = await sendTemplateTest(this.template.id, { email: this.email.trim(), data });
        this.$utils.setPref(EMAIL_PREF, this.email.trim());
        this.$utils.toast(this.$t('gallery.testSent', { email: res.email }));
        this.close();
      } catch (err) {
        // Shown in the dialog rather than as a toast, because the likely
        // failure is the allowlist refusing the address and its explanation is
        // a sentence about configuration that needs to stay on screen next to
        // the field that caused it. The CRM answers {error, detail}, which
        // listmonk's interceptor has no wording for.
        const body = (err.response && err.response.data) || {};
        this.error = {
          error: body.error || body.message || String(err),
          detail: body.detail || '',
        };
      } finally {
        this.isSending = false;
      }
    },
  },

  mounted() {
    this.$nextTick(() => {
      if (this.$refs.email) { this.$refs.email.focus(); }
    });
  },
};
</script>
