import { icon, type IconName } from './icons';
import { audio } from '../services/audio';

export const $ = <T extends HTMLElement = HTMLElement>(sel: string, root: ParentNode = document) => root.querySelector<T>(sel)!;
export const $$ = <T extends HTMLElement = HTMLElement>(sel: string, root: ParentNode = document) => Array.from(root.querySelectorAll<T>(sel));

export function el<T extends HTMLElement = HTMLElement>(html: string): T {
  const t = document.createElement('template');
  t.innerHTML = html.trim();
  return t.content.firstElementChild as T;
}

export function setText(node: HTMLElement, text: string) {
  if (node.textContent !== text) node.textContent = text;
}

/** Delegate clicks on [data-act] elements inside root. */
export function onAct(root: HTMLElement, handlers: Record<string, (target: HTMLElement, ev: Event) => void>) {
  root.addEventListener('click', (ev) => {
    const t = (ev.target as HTMLElement).closest<HTMLElement>('[data-act]');
    if (!t || !root.contains(t)) return;
    if (t.classList.contains('disabled') && !t.dataset.allowDisabled) {
      t.animate([{ transform: 'translateX(0)' }, { transform: 'translateX(-5px)' }, { transform: 'translateX(5px)' }, { transform: 'translateX(0)' }], { duration: 220 });
      audio.play('nope');
      return;
    }
    const fn = handlers[t.dataset.act!];
    if (fn) { audio.play('click'); fn(t, ev); }
  });
}

// ── toasts ───────────────────────────────────────────────────
let toastRoot: HTMLElement | null = null;
export function toast(msg: string, ic?: IconName) {
  if (!toastRoot) { toastRoot = el('<div class="toasts"></div>'); document.getElementById('ui')!.appendChild(toastRoot); }
  const t = el(`<div class="toast">${ic ? icon(ic) : ''}<span></span></div>`);
  t.querySelector('span:last-child')!.textContent = msg;
  toastRoot.appendChild(t);
  while (toastRoot.children.length > 3) toastRoot.firstElementChild!.remove();
  setTimeout(() => t.remove(), 2800);
}

// ── modals (queued so celebrations never stack on top of each other) ──
export interface ModalOpts {
  html: string;
  banner?: string;
  bannerColors?: [string, string];
  dismissable?: boolean;
  onClose?: () => void;
  wide?: boolean;
}
export interface ModalHandle { root: HTMLElement; card: HTMLElement; close: () => void }

const queue: (() => void)[] = [];
let active = 0;

export function modalOpen() { return active > 0; }

export function queueModal(open: () => void) {
  if (active === 0) open();
  else queue.push(open);
}

export function openModal(o: ModalOpts): ModalHandle {
  active++;
  const dismissable = o.dismissable ?? true;
  const root = el(`<div class="modal-wrap"><div class="modal">
      ${o.banner ? `<div class="modal-banner" style="${o.bannerColors ? `--bc1:${o.bannerColors[0]};--bc2:${o.bannerColors[1]}` : ''}">${o.banner}</div>` : ''}
      ${dismissable ? `<button class="x" data-x aria-label="Close">${icon('close')}</button>` : ''}
      ${o.html}
    </div></div>`);
  const card = root.querySelector<HTMLElement>('.modal')!;
  if (o.banner) card.style.paddingTop = '34px';
  let closed = false;
  const close = () => {
    if (closed) return;
    closed = true;
    audio.play('close');
    root.classList.add('out');
    setTimeout(() => {
      root.remove();
      active--;
      o.onClose?.();
      const next = queue.shift();
      if (next) next();
    }, 200);
  };
  if (dismissable) {
    root.addEventListener('click', (ev) => { if (ev.target === root) close(); });
    root.querySelector('[data-x]')?.addEventListener('click', close);
  }
  document.body.appendChild(root);
  audio.play('open');
  return { root, card, close };
}

export function confirmModal(title: string, text: string, yes = 'OK', no = 'Cancel', yesCls = 'pink'): Promise<boolean> {
  return new Promise((resolve) => {
    let result = false;
    const m = openModal({
      html: `<h2>${title}</h2><p>${text}</p><div class="actions"><button class="btn ${yesCls}" data-yes>${yes}</button><button class="btn gray" data-no>${no}</button></div>`,
      onClose: () => resolve(result),
    });
    m.card.querySelector('[data-yes]')!.addEventListener('click', () => { result = true; m.close(); });
    m.card.querySelector('[data-no]')!.addEventListener('click', () => m.close());
  });
}
