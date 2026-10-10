// CSP-safe replacement for inline onload handlers. Fonts must not delay the app.
for (const link of document.querySelectorAll('link[data-echo-deferred-font]')) {
  const apply = () => { link.media = 'all'; };
  link.addEventListener('load', apply, { once: true });
  if (link.sheet) apply(); // A cached stylesheet may have loaded before this deferred script.
}
