/* eslint-disable no-undef */

/**
 * Only http(s) links leave the app for the system browser. Other schemes (file:, javascript:, custom protocols) are
 * denied: a crafted link inside rendered content (a call note, a chat message) could otherwise escape to the OS handler.
 */
function isSafeExternalUrl(url) {
  return typeof url === 'string' && /^https?:\/\//i.test(url);
}

module.exports = { isSafeExternalUrl };
