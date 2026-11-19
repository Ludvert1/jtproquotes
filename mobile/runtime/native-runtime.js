/* Native transport is limited to the product's authenticated API. Firebase
   keeps its normal browser transport and persistent sign-in. */
(() => {
  const capacitor = window.Capacitor;
  if (!capacitor?.isNativePlatform?.()) return;
  const plugin = (name) => capacitor.registerPlugin(name);
  const http = plugin('CapacitorHttp');
  const documents = plugin('NativeDocuments');
  const files = plugin('Filesystem');
  const share = plugin('Share');
  const app = plugin('App');
  const origin = 'https://www.s-i-quotespro.com';
  const originalFetch = window.fetch.bind(window);

  window.fetch = async (input, init = {}) => {
    const request = input instanceof Request ? new Request(input, init) : new Request(new URL(input, location.href), init);
    const url = new URL(request.url);
    if (url.origin !== location.origin || !url.pathname.startsWith('/api/')) return originalFetch(input, init);
    const text = request.method === 'GET' || request.method === 'HEAD' ? undefined : await request.text();
    const type = request.headers.get('content-type') || '';
    const data = text && type.includes('application/json') ? JSON.parse(text) : text;
    const response = await http.request({
      url: origin + url.pathname + url.search,
      method: request.method,
      headers: Object.fromEntries(request.headers), data,
      connectTimeout: 20000, readTimeout: 150000, responseType: 'text',
    });
    const body = typeof response.data === 'string' ? response.data : JSON.stringify(response.data);
    return new Response([204, 205, 304].includes(response.status) ? null : body, {
      status: response.status, headers: response.headers,
    });
  };
  navigator.sendBeacon = (url, blob) => {
    if (!String(url).startsWith('/api/')) return false;
    Promise.resolve(blob instanceof Blob ? blob.text() : String(blob || '')).then((body) => window.fetch(url, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body,
    })).catch(() => {});
    return true;
  };
  const asBase64 = (blob) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result.split(',')[1]);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
  window.SIQ_SHARE_FILE = async (file, text = '') => {
    const name = String(file.name || 'Quote.pdf').replace(/[^a-zA-Z0-9_. -]/g, '_').slice(0, 140);
    const path = 'shared/' + crypto.randomUUID() + '-' + name;
    const written = await files.writeFile({ path, directory: 'CACHE', data: await asBase64(file), recursive: true });
    await share.share({ title: name, text, files: [written.uri], dialogTitle: 'Share quote' });
  };
  window.SIQ_PDF_IMAGE = async (source) => {
    if (!source.startsWith('/api/img?u=')) throw new Error('Unsupported quote image.');
    const response = await http.request({ url: origin + source, method: 'GET', responseType: 'arraybuffer', readTimeout: 60000 });
    const mime = Object.entries(response.headers || {}).find(([name]) => name.toLowerCase() === 'content-type')?.[1];
    if (response.status !== 200 || !/^image\/(png|jpeg|webp|gif)(;|$)/i.test(mime || '')) {
      throw new Error('A job photo could not be included in the PDF. Reconnect and try again.');
    }
    return 'data:' + mime.split(';')[0] + ';base64,' + response.data;
  };
  navigator.canShare = (data) => !!data.files?.length && data.files.every((file) => file instanceof Blob);
  navigator.share = async (data) => {
    if (data.files?.length) return window.SIQ_SHARE_FILE(data.files[0], data.text || '');
    return share.share({ title: data.title, text: data.text, url: data.url });
  };
  window.print = () => documents.print({ title: document.title }).catch((error) => alert(error.message));
  document.addEventListener('click', (event) => {
    const anchor = event.target.closest?.('a[download]');
    if (!anchor || !anchor.href.startsWith('blob:')) return;
    event.preventDefault();
    originalFetch(anchor.href).then((response) => response.blob()).then(async (blob) => {
      await documents.save({ name: anchor.download || 'Quote.pdf', mime: blob.type || 'application/octet-stream', data: await asBase64(blob) });
    }).catch((error) => { if (error.code !== 'USER_CANCELLED') alert(error.message || 'The file could not be saved.'); });
  }, true);

  app.addListener('backButton', () => {
    const back = new CustomEvent('siq-native-back', { cancelable: true });
    if (window.dispatchEvent(back)) app.minimizeApp();
  });
  if (window.SIQ_NATIVE_PUSH_ENABLED) {
    const push = plugin('PushNotifications');
    push.addListener('pushNotificationActionPerformed', ({ notification }) => {
      const destination = new URL(notification.data?.url || '/app', origin);
      if (destination.origin === origin && destination.searchParams.get('quote')) {
        location.assign('/?quote=' + encodeURIComponent(destination.searchParams.get('quote')));
      }
    });
  }
  document.addEventListener('DOMContentLoaded', () => {
    const footer = document.createElement('nav');
    footer.className = 'siq-account-links';
    footer.setAttribute('aria-label', 'Privacy and account');
    footer.innerHTML = '<a href="/privacy.html">Privacy</a><a href="/delete-account.html">Delete account</a>';
    document.body.append(footer);
    const offline = document.createElement('div');
    offline.className = 'siq-connectivity';
    offline.setAttribute('role', 'status');
    offline.textContent = 'You are offline. Reconnect to sync quotes and use online services.';
    document.body.prepend(offline);
    const update = () => { offline.hidden = navigator.onLine; };
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    update();
  });
})();
