// No PC/navegador: setas do teclado (ou de um controle conectado) movem o foco
// para o item mais próximo naquela direção, como numa TV. Enter = OK, Esc/Backspace = voltar.

const SELECTOR = '[tabindex="0"], button, a[href], input, [role="button"]';

function center(r: DOMRect) {
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
}

function visible(el: HTMLElement) {
  const r = el.getBoundingClientRect();
  return r.width > 0 && r.height > 0 && r.bottom > 0 && r.right > 0 && r.top < window.innerHeight * 3;
}

function move(dir: 'ArrowUp' | 'ArrowDown' | 'ArrowLeft' | 'ArrowRight') {
  const current = document.activeElement as HTMLElement | null;
  const all = Array.from(document.querySelectorAll<HTMLElement>(SELECTOR)).filter((el) => el !== current && visible(el));
  if (!current || current === document.body) {
    all[0]?.focus();
    return;
  }
  const from = center(current.getBoundingClientRect());
  let best: HTMLElement | null = null;
  let bestScore = Infinity;
  for (const el of all) {
    const c = center(el.getBoundingClientRect());
    const dx = c.x - from.x;
    const dy = c.y - from.y;
    const ok =
      (dir === 'ArrowRight' && dx > 4) || (dir === 'ArrowLeft' && dx < -4) ||
      (dir === 'ArrowDown' && dy > 4) || (dir === 'ArrowUp' && dy < -4);
    if (!ok) continue;
    const primary = dir === 'ArrowLeft' || dir === 'ArrowRight' ? Math.abs(dx) : Math.abs(dy);
    const cross = dir === 'ArrowLeft' || dir === 'ArrowRight' ? Math.abs(dy) : Math.abs(dx);
    const score = primary + cross * 2.5;
    if (score < bestScore) {
      bestScore = score;
      best = el;
    }
  }
  if (best) {
    best.focus();
    best.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' });
  }
}

let installed = false;
export function installSpatialNav(onBack?: () => void) {
  if (installed || typeof window === 'undefined') return;
  installed = true;
  window.addEventListener('keydown', (e) => {
    const target = e.target as HTMLElement;
    const typing = target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA';
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
      if (typing && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) return;
      e.preventDefault();
      move(e.key as any);
    } else if ((e.key === 'Escape' || (e.key === 'Backspace' && !typing)) && onBack) {
      e.preventDefault();
      onBack();
    }
  });
}
