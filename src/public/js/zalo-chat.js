// Keep the app launch directly tied to the user's click. No timed redirect:
// a browser confirmation may remain open while the user decides.
'use strict';
document.querySelectorAll('[data-zalo-chat]').forEach((button) => {
  button.addEventListener('click', () => {
    const fallback = button.parentElement.querySelector('[data-zalo-fallback]');
    if (fallback) fallback.classList.remove('d-none');
  });
});
