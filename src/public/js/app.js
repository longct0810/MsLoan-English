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
