// doc_id: doc_other_0009 — Font Audit & Override (M21)
// Detects CJK / custom fonts referenced by the source HTML that are NOT
// actually loaded in headless Chrome.  Used by dom-to-ui-compare to:
//   1. Force both source and preview onto the SAME fallback stack (pixel parity)
//   2. Emit a feedback entry asking the reviewer to install the missing font
'use strict';

/**
 * Inside puppeteer page: extract font-family strings used + check availability.
 * @param {import('puppeteer-core').Page} page
 * @returns {Promise<{ usedFamilies: string[], missingFamilies: string[],
 *                     availableFamilies: string[] }>}
 */
async function auditFonts(page) {
  return await page.evaluate(() => {
    // Collect every distinct font-family value used by visible elements
    const families = new Set();
    document.querySelectorAll('body *').forEach(el => {
      const ff = window.getComputedStyle(el).fontFamily;
      if (ff) families.add(ff);
    });
    // Each value can be "FontA, 'FontB Subset', sans-serif" — split top-level
    const split = [];
    for (const stack of families) {
      const parts = stack.split(',').map(s => s.trim().replace(/^["']|["']$/g, ''));
      for (const p of parts) {
        if (p && !/^(serif|sans-serif|monospace|cursive|fantasy|system-ui|ui-\w+|inherit|initial|unset)$/i.test(p)) {
          split.push(p);
        }
      }
    }
    const used = Array.from(new Set(split));
    const missing = [];
    const available = [];
    for (const f of used) {
      // Use document.fonts.check — if returns false, the font is not loaded.
      let ok = false;
      try {
        ok = document.fonts.check(`12px "${f}"`);
      } catch (e) {}
      if (ok) available.push(f);
      else missing.push(f);
    }
    return { usedFamilies: used, missingFamilies: missing, availableFamilies: available };
  });
}

/**
 * Build a <style> tag that forces every missing family to a deterministic
 * fallback so both source and preview render with identical glyph metrics.
 */
function buildFontOverrideStyle(missingFamilies, fallbackStack) {
  if (!missingFamilies || missingFamilies.length === 0) return '';
  const fallback = fallbackStack || `"Microsoft JhengHei", "Microsoft YaHei", "Noto Sans CJK TC", "Noto Sans CJK SC", "PingFang TC", "Hiragino Sans GB", sans-serif`;
  // Use @font-face local() trick: declare each missing family as an alias to local fallback.
  const decls = missingFamilies.map(f => `
@font-face {
  font-family: "${f}";
  src: local("Microsoft JhengHei"), local("Microsoft YaHei"), local("Noto Sans CJK TC"), local("PingFang TC"), local("Arial");
  font-weight: 100 900;
  font-style: normal;
}`).join('\n');
  return `<style id="ucuf-font-override">
${decls}
/* Belt-and-suspenders: if @font-face local() still misses, force the body stack. */
html,body { font-family: ${fallback} !important; }
* { font-family: inherit !important; }
</style>`;
}

/**
 * Build a <script> tag that hides broken image icons (when src 404s).
 * Applied to BOTH source and preview to keep parity.
 */
function buildBrokenImageHiderScript() {
  return `<script>
(function(){
  function hide(e){
    if (e && e.target && e.target.tagName === 'IMG') {
      e.target.style.visibility = 'hidden';
      e.target.style.opacity = '0';
    }
  }
  document.addEventListener('error', hide, true);
  // Catch images already broken at load time
  document.addEventListener('DOMContentLoaded', function(){
    document.querySelectorAll('img').forEach(function(img){
      if (img.complete && img.naturalWidth === 0) {
        img.style.visibility = 'hidden'; img.style.opacity = '0';
      }
    });
  });
})();
</script>`;
}

/**
 * Build <style> with @font-face declarations using base64 data URIs for known
 * project fonts. Injected into BOTH the HTML side and the UCUF preview side so
 * rendering is pixel-accurate with real typefaces.
 * Base64 embedding avoids any file:// cross-origin restrictions in headless Chrome.
 *
 * @param {string} projectRoot  Absolute path to the project workspace root.
 * @returns {string}  HTML <style> block, or '' if no matching font files found.
 */
function buildProjectFontFaces(projectRoot) {
  const fs   = require('fs');
  const path = require('path');
  const FONTS = [
    { family: 'NotoSansTC', relPath: 'assets/resources/fonts/notosans_tc/font.ttf' },
    { family: 'Manrope',    relPath: 'assets/resources/fonts/manrope/font.ttf'    },
    { family: 'Newsreader', relPath: 'assets/resources/fonts/newsreader/font.ttf' },
  ];
  const decls = FONTS
    .map(f => {
      const absPath = path.join(projectRoot, f.relPath);
      try {
        const b64 = fs.readFileSync(absPath).toString('base64');
        return `@font-face { font-family: "${f.family}"; src: url("data:font/truetype;base64,${b64}") format("truetype"); font-weight: 100 900; font-style: normal; }`;
      } catch {
        return null;
      }
    })
    .filter(Boolean);
  if (decls.length === 0) return '';
  return `<style id="ucuf-project-fonts">\n${decls.join('\n')}\n</style>`;
}

/** Set of font family names that buildProjectFontFaces covers. */
const PROJECT_FONT_FAMILIES = new Set(['NotoSansTC', 'Manrope', 'Newsreader']);

module.exports = { auditFonts, buildFontOverrideStyle, buildBrokenImageHiderScript, buildProjectFontFaces, PROJECT_FONT_FAMILIES };
