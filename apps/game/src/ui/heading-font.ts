// Menu titles use the pixel font, which has no Thai letters: a Thai title fell back to a small plain font and
// looked weaker than the text under it. Titles holding Thai get `.th` (Chakra Petch, bold, larger in style.css);
// Latin titles ("LEVEL UP!", "SHOP") keep the pixel look.
const THAI = /[฀-๿]/;
const HEAD = '.box h1, .box h2, .box h3, .estory h2';

function mark(h: Element): void {
  h.classList.toggle('th', THAI.test(h.textContent || ''));
}

export function watchHeadings(): void {
  document.querySelectorAll(HEAD).forEach(mark);
  new MutationObserver((recs) => {
    for (const r of recs) {
      const el = r.target.nodeType === Node.ELEMENT_NODE ? (r.target as Element) : r.target.parentElement;
      const h = el?.closest(HEAD);
      if (h) mark(h);
      else if (el) el.querySelectorAll(HEAD).forEach(mark);
    }
  }).observe(document.body, { childList: true, characterData: true, subtree: true });
}

watchHeadings();
