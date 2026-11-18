// Inline script source, run before the router starts (see app/layout.js).
//
// An address such as https://admin.newtolet.com//admin/?tab=payments loads the
// page, but the browser reads "//admin/..." as a link to a host called
// "admin". The router then calls history.replaceState with that cross-origin
// URL, which throws and leaves the "This page couldn't load" screen. This
// guard sends the browser to the same address with the extra slashes removed.
//
// Kept as a string because it is injected with next/script; it uses no regex
// so nothing needs escaping inside a template literal.
export const DOUBLE_SLASH_GUARD = `
(function () {
  try {
    var path = location.pathname;
    if (path.charAt(0) === '/' && path.charAt(1) === '/') {
      var parts = path.split('/').filter(function (part) { return part.length > 0; });
      var clean = '/' + parts.join('/');
      if (parts.length > 0 && path.charAt(path.length - 1) === '/') clean += '/';
      location.replace(clean + location.search + location.hash);
    }
  } catch (e) {}
})();
`
