export function bindChinaSourceDetailsKeyboard(root: ParentNode): void {
  root.querySelectorAll<HTMLElement>('[data-china-source-summary]').forEach((summary) => {
    summary.addEventListener('keydown', (event) => {
      if (event.key !== 'Enter' && event.key !== ' ') return;

      const details = summary.closest<HTMLDetailsElement>('details');
      if (!details) return;

      event.preventDefault();
      details.open = !details.open;
    });
  });
}
