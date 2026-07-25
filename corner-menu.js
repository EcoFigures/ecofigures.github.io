// Powers the bottom-right "+" menu (Suggest a figure / Report an error / Contact).
// Included on every page - has no dependency on the database/filter elements.
document.addEventListener('DOMContentLoaded', () => {
  const cornerMenu = document.querySelector('.corner-menu');
  const cornerMenuBtn = document.getElementById('cornerMenuBtn');
  if (!cornerMenu || !cornerMenuBtn) return;

  cornerMenuBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    const isOpen = cornerMenu.classList.toggle('open');
    cornerMenuBtn.setAttribute('aria-expanded', isOpen);
  });

  document.addEventListener('click', (e) => {
    if (!cornerMenu.contains(e.target)) {
      cornerMenu.classList.remove('open');
      cornerMenuBtn.setAttribute('aria-expanded', 'false');
    }
  });
});
