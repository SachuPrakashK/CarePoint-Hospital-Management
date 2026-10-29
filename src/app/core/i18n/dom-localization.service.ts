import { DOCUMENT } from '@angular/common';
import { Injectable, OnDestroy, effect, inject } from '@angular/core';
import { UI_CATALOG } from './ui-catalog';
import { LanguageService } from './language.service';

const ATTRIBUTE_NAMES = ['placeholder', 'title', 'aria-label'] as const;
const ENGLISH_TO_KEY = new Map<string, string>(
  Object.entries(UI_CATALOG).map(([key, value]) => [value, key]),
);

@Injectable({ providedIn: 'root' })
export class DomLocalizationService implements OnDestroy {
  private readonly document = inject(DOCUMENT);
  private readonly language = inject(LanguageService);
  private readonly originalText = new WeakMap<Text, string>();
  private readonly appliedText = new WeakMap<Text, string>();
  private readonly originalAttributes = new WeakMap<Element, Map<string, string>>();
  private readonly appliedAttributes = new WeakMap<Element, Map<string, string>>();
  private observer?: MutationObserver;
  private scheduled = false;

  constructor() {
    effect(() => {
      this.language.current();
      this.language.activeTranslations();
      this.schedule();
    });
    queueMicrotask(() => this.start());
  }

  private start() {
    const root = this.document.body;
    if (!root || typeof MutationObserver === 'undefined') return;
    this.localize(root);
    this.observer = new MutationObserver(() => this.schedule());
    this.observer.observe(root, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
      attributeFilter: [...ATTRIBUTE_NAMES],
    });
  }

  private schedule() {
    if (this.scheduled) return;
    this.scheduled = true;
    queueMicrotask(() => {
      this.scheduled = false;
      if (this.document.body) this.localize(this.document.body);
    });
  }

  private localize(root: Node) {
    const walker = this.document.createTreeWalker(
      root,
      NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT,
    );
    let node: Node | null = root;
    while (node) {
      if (node.nodeType === Node.TEXT_NODE) this.localizeText(node as Text);
      else this.localizeAttributes(node as Element);
      node = walker.nextNode();
    }
  }

  private localizeText(node: Text) {
    if (node.parentElement?.closest('[data-no-translate], script, style, code, pre')) return;
    const current = node.data;
    const previousSource = this.originalText.get(node);
    const previousApplied = this.appliedText.get(node);
    const source = previousSource && current === previousApplied ? previousSource : current;
    const normalized = source.replace(/\s+/g, ' ').trim();
    const key = ENGLISH_TO_KEY.get(normalized);
    if (!key) return;
    this.originalText.set(node, source);
    const translated = this.language.translate(key);
    const next = source.replace(normalized, translated);
    this.appliedText.set(node, next);
    if (current !== next) node.data = next;
  }

  private localizeAttributes(element: Element) {
    if (element.closest('[data-no-translate]')) return;
    for (const name of ATTRIBUTE_NAMES) {
      const current = element.getAttribute(name);
      if (!current) continue;
      let originals = this.originalAttributes.get(element);
      let applied = this.appliedAttributes.get(element);
      const previousSource = originals?.get(name);
      const previousApplied = applied?.get(name);
      const source = previousSource && current === previousApplied ? previousSource : current;
      const key = ENGLISH_TO_KEY.get(source.trim());
      if (!key) continue;
      if (!originals) {
        originals = new Map();
        this.originalAttributes.set(element, originals);
      }
      originals.set(name, source);
      const translated = this.language.translate(key);
      if (!applied) {
        applied = new Map();
        this.appliedAttributes.set(element, applied);
      }
      applied.set(name, translated);
      if (current !== translated) element.setAttribute(name, translated);
    }
  }

  ngOnDestroy() {
    this.observer?.disconnect();
  }
}
