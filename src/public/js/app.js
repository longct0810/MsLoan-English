const csrfToken = document.querySelector('meta[name="csrf-token"]')?.content;

if (csrfToken) {
  document.querySelectorAll('form[method="post"], form:not([method])').forEach((form) => {
    if (!form.querySelector('input[name="_csrf"]')) {
      const input = document.createElement('input');
      input.type = 'hidden';
      input.name = '_csrf';
      input.value = csrfToken;
      form.appendChild(input);
    }
  });

  const nativeFetch = window.fetch.bind(window);
  window.fetch = (input, init = {}) => {
    const method = String(init.method || 'GET').toUpperCase();
    if (method !== 'GET' && method !== 'HEAD') {
      const headers = new Headers(init.headers || {});
      headers.set('X-CSRF-Token', csrfToken);
      init = { ...init, headers };
    }
    return nativeFetch(input, init);
  };
}

document.querySelectorAll('[data-table-search]').forEach((input) => {
  const table = document.querySelector(input.dataset.tableSearch);
  if (!table) return;
  input.addEventListener('input', () => {
    const keyword = input.value.trim().toLowerCase();
    table.querySelectorAll('tbody tr').forEach((row) => {
      row.hidden = !row.innerText.toLowerCase().includes(keyword);
    });
  });
});

document.querySelectorAll('[data-attendance-all]').forEach((button) => {
  button.addEventListener('click', () => {
    const form = button.closest('form') || document;
    form.querySelectorAll('.attendance-status').forEach((select) => {
      select.value = button.dataset.attendanceAll;
      select.dispatchEvent(new Event('change', { bubbles: true }));
    });
  });
});
