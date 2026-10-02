# KNEO Website — Reconciled Plan (Workstream A)

**Status:** Workstream A complete. No application code has been modified.
**Prepared:** 26 September 2026
**Inputs:** `docs/audits/claude-go-live-review.pdf`, `docs/audits/chatgpt-detailed-audit.docx`
(both extracted to `.extracted.txt` alongside — neither could be read by any installed
tool, so the PDF was decoded from its FlateDecode streams via the embedded ToUnicode
CMaps, and the DOCX from `word/document.xml`.)

---

## 0. Read this first — three things that change the brief

### 0.1 The stack in the brief does not exist

The brief specifies `src/config/site-facts.ts`, "client components", "first-load JS per
route from the build output", the "framework's image pipeline", AVIF via that pipeline,
and `<CTA intent="…">` components. All of that describes a Next.js/TypeScript app.

Measured:

| Looked for | Present |
|---|---|
| `package.json`, `tsconfig.json`, `next.config.*`, `tailwind.config.*`, `components.json` | **none** |
| `node_modules/`, `src/` | **absent** |
| Framework, router, SSG/SSR/ISR, component library | **none — there is no framework** |

What this actually is:

| | |
|---|---|
| Build | `build.sh` — bash + awk + sed + perl |
| Source | 55 HTML files in `_source/pages/`, 6 partials in `_source/partials/` |
| Templating | front-matter (`@TITLE`/`@DESC`/`@NAV`/`@OUT`), `{{INCLUDE:name}}`, `{{BASE}}`/`{{SITE}}`/`{{VER}}`/`{{YEARS}}` |
| Output | 54 directory-index routes + root `index.html`, committed to the repo |
| Styling | one hand-written `assets/css/main.css` (132 KB) |
| Scripting | one hand-written `assets/js/main.js` (104 KB), no libraries |
| Forms | `api/enquiry.js` — a Vercel serverless function, provider-agnostic |
| Animation libraries | none |

**Consequence.** Roughly a third of the brief's mechanics have no host here. They are not
impossible — they need translating, not importing. The translations are proposed in §4.
Nothing in the brief's *intent* is blocked; several of its *instructions* are.

`node` v24.19.0 and `npm` 11.17.0 **are** installed and the npm registry is reachable,
so Lighthouse CI, Playwright and axe are installable. Under guardrail 6 that needs your
approval before I add anything. `python3` resolves to the Microsoft Store stub (not
installed) and `convert` is the Windows FAT→NTFS converter, **not** ImageMagick — so
there is no local image or video tooling.

### 0.2 Both audits are partly stale — several P0 items are already closed

Both documents are dated 26 September 2026 and describe a site that has since moved. I
ran the brief's §5.A.4 defect scan against `_source/` rather than trusting the write-ups:

| Audit finding | Claimed | Measured now | Verdict |
|---|---|---|---|
| "23 vs 24+ years" inconsistency | must-fix #1 | `24+` **0** hits, `23+` **0**, `23 years` **0** | **already closed** |
| `ISO9001` missing a space | must-fix #2 | **0** hits; `ISO 9001` 14 hits | **already closed** |
| Canonicals/OG/robots/sitemap on `vercel.app` | must-fix #3 | `vercel.app` **0** hits | **already closed** |
| Office `502–504` vs `501–505` | must-fix #5 | `Office 50` **0** hits | **not present in source** |
| "0 collisions discovered on real hardware" | High | **0** hits | **already closed** |
| "40% less onsite time" | P0 (both audits) | **0** hits | **already closed** |
| "24/7 support" unqualified | High | reads **"24/7 support for AMC customers"** at `contact.html:185`, `services.html:136` | **already closed** |
| sitemap URL count | "60 URLs" | **54** | stale count |
| page count | "55 pages" | 55 source − 1 (`404.html`) = **54 indexable** = 54 sitemap URLs ✓ | reconciles |

**Do not "fix" these.** Re-applying a closed fix is how a correct page becomes wrong. Each
is listed in the register below with status `CLOSED-VERIFIED` and the grep that proves it.

### 0.3 The brief's grep list produces false positives

Two that would have caused real damage if actioned blindly:

- **`80%` matches `%E2%80%94`** — the URL-encoded em dash in `mailto:` links. Six hits in
  `careers.html` are encoded punctuation, not claims.
- **`Five industries` matches a blog article title.** Six of the seven hits are the article
  *"Five Industries, One Pattern: Why Visibility Comes First"*, its `<h1>`, its JSON-LD
  headline, and two cards linking to it. That title is editorially correct and is its own
  URL. **Only `industries.html:82` is the defect.**

---

## 1. Route inventory

| | Count |
|---|---|
| Source pages (`_source/pages/**.html`) | 55 |
| Indexable routes | 54 |
| `sitemap.xml` `<loc>` entries | 54 |
| Sitemap URLs that resolve to a built route | 54 / 54 |
| `404.html` in sitemap | no (correct) |
| Partials | 6 |

Route families: home; `industrial-automation`; `mapp` + 6 module pages; `products` + 4;
`services` + 8; `industries` + 6; `insights` + 13 articles; `about`, `contact`, `careers`,
`faq`, `expertise`, `privacy-policy`, `terms`, `sitemap`; `404`.

**Primary CTA per route: not yet inventoried.** Deferred to Workstream D, where it is the
input to the CTA audit script rather than a throwaway list.

---

## 2. Baseline measurements

Honest scope: I can measure asset weight, contrast, console errors, link integrity and
layout geometry in the in-app browser. I **cannot** produce Lighthouse or axe numbers
without installing tooling (§0.1), so the brief's §3 targets have **no baseline yet**.

### Measured now

| Asset | Size |
|---|---|
| `assets/video/hero-factory.mp4` | **25.4 MB** |
| `assets/css/main.css` | 132 KB |
| `assets/js/main.js` | 104 KB |
| `assets/img/solve/` (10 JPEG) | 500 KB |
| Largest images (`services/*.jpg`) | 256–294 KB each |

**The 25.4 MB hero video is the single largest performance defect on the site** and is
named by neither audit. It alone makes the brief's LCP ≤ 2.5 s target unreachable on
mobile. `assets/video/README.txt` already carries an ffmpeg recipe; ffmpeg is not
installed here.

### Not yet measurable

Lighthouse (mobile/desktop, 3 runs median), axe violations, INP, CLS, field CWV. These
need either npm-installed tooling (your approval) or PageSpeed Insights run against a
public URL after the domain move.

---

## 3. De-duplicated findings register

Severity: **P0** blocker · **P1** launch week · **P2** month 1 · **P3** backlog.
Source: **C** = Claude review, **G** = ChatGPT audit, **B** = both, **N** = found by me in this pass.

| ID | Route/area | Finding | Src | Sev | Fix | Eff | Decision | Files |
|---|---|---|---|---|---|---|---|---|
| F-01 | Home | "Six problems we are asked about most" sits above **10** cards | B | P0 | "The problems we are asked about most" (evergreen, no count) | S | N | `_source/pages/index.html:187` |
| F-02 | Industries hub | "Five industries, one pattern." sits above **6** tiles (verified: 6 `industry-tile`) | B | P0 | "Different industries. One recurring challenge." (G's evergreen wording) | S | N | `_source/pages/industries.html:82` |
| F-03 | Site-wide | 25.4 MB hero video | N | **P0** | Re-encode to ≤ 4 MB; poster frame; `preload="none"` until interaction | M | N | `assets/video/hero-factory.mp4` |
| F-04 | MAPP Vision | "Zero-defect standards" overpromises | C | P1 | "Consistent inspection on every part" | S | N | `products/mapp-vision.html:145` |
| F-05 | Services ×2 | "Unmatched after-sales support" superlative | C | P1 | "After-sales support with named engineers" | S | N | `services.html:137`, `services/onsite-commissioning.html:95` |
| F-06 | Expertise | "Siemens TIA / STEP 7 **V15.1**" dates the page | C | P2 | Drop the version number | S | N | `expertise.html:86` |
| F-07 | Onsite Commissioning | Two sub-cards both titled "Support" | C | P2 | "Remote support" / "Site visits" | S | N | `services/onsite-commissioning.html` |
| F-08 | Privacy, Terms | No effective / last-updated date | B | **P0** | Add both; mark "DRAFT – requires legal review" | S | N | `privacy-policy.html`, `terms.html` |
| F-09 | Privacy | No DPDP Act 2023 section | B | **P0** | Purpose, lawful basis, rights, retention, grievance officer | M | **Y** D-03 | `privacy-policy.html` |
| F-10 | Privacy | `sales@` is the privacy contact | C | P1 | Named grievance officer + dedicated address | S | **Y** D-03 | `privacy-policy.html` |
| F-11 | Privacy | States no tracking cookies are used | C | P1 | Must stay true, or ship consent banner first | S | N | `privacy-policy.html` |
| F-12 | Home | OEM/customer logos may imply endorsement | B | **P0** | `showLogos` flag; text names + accurate relationship wording until permissions confirmed | M | **Y** D-02 | `index.html`, `industrial-automation.html` |
| F-13 | Contact form | Never tested end-to-end | B | **P0** | `api/enquiry.js` returns 501 without a provider key → browser falls back to mailto. **Silent-ish failure.** Configure `RESEND_API_KEY`, then test | S | **Y** D-05 | `api/enquiry.js` |
| F-14 | Site-wide | `SITE_URL` still not the production domain | B | **P0** | Single env var → canonical, OG, sitemap, robots | S | **Y** D-01 | `build.sh:~47` |
| F-15 | Preview deploys | Not noindexed by environment | C | P1 | `X-Robots-Tag` on non-production | S | N | `vercel.json` |
| F-16 | Site-wide | No redirect map from legacy kneo.in URLs | C | P1 | 301 map — **do not guess old paths**; needs the real list | M | **Y** D-06 | new |
| F-17 | Site-wide | Structured data incomplete | B | P2 | Organization, LocalBusiness, WebSite, BreadcrumbList, FAQPage, Article, SoftwareApplication — no fabricated ratings/offers | M | N | `build.sh` |
| F-18 | Insights | Listing cards show no date; 4 articles show "Insight" not read time; no author | C | P2 | Date + read time on cards; author "KNEO Engineering Team" | S | N | `insights.html` |
| F-19 | Careers | 6 roles, no dates — will look stale | C | P2 | "Roles we regularly hire for" | S | N | `careers.html` |
| F-20 | About | Hero "The partner behind the world's smartest factories" oversells; also conflicts with home's "The Engineering Partner for Modern Manufacturing." | C+N | P2 | One master positioning line, used twice | S | N | `about.html` |
| F-21 | MAPP overview | "Six modules. One platform…" repeated 3× | C | P3 | Keep in hero only | S | N | `mapp.html` |
| F-22 | MAPP EYE | OEE waterfall −18/−16/−6% with no context | B | P2 | Label "Illustrative" | S | N | `mapp/mapp-eye.html` |
| F-23 | Products | "80% reduction" vs "4–6 h manual effort" vs "in minutes" tell three stories | C | P2 | One story; hold evidence for sales | S | **Y** D-04 | `products/*.html` |
| F-24 | PFMEA | "60% less engineering effort vs Excel" unevidenced | B | P2 | Back it or soften to "significantly less" | S | **Y** D-04 | `products/pfmea.html` |
| F-25 | Auto Ballooning | File formats may exceed production support | G | **P0** | Verify every format before launch | S | **Y** D-07 | `products/auto-ballooning.html` |
| F-26 | Home "What we do" | Brand list omits Delta and Yaskawa (About/Services include them) | C | P2 | One master brand list | S | N | `index.html` |
| F-27 | Blog ×4 | Quantified outcomes (60%, 30%, 80%) inside article narratives | N | P2 | Decide: evidenced case studies, or qualitative | S | **Y** D-04 | `blog/*.html` |
| F-28 | Site-wide | No CTA system; CTA wording ad hoc | G | P1 | Intent-based CTA table (brief §5.D) | L | N | many |
| F-29 | Services | No offshore-engineering proposition | G | P1 | "Offshore Engineering. Onsite Commissioning." section | M | **Y** D-08 | `services.html` |
| F-30 | Site-wide | No analytics, no consent banner | B | P1 | Provider-agnostic layer, no-op until consent | M | **Y** D-09 | new |
| F-31 | Site-wide | No security headers | Brief | P2 | HSTS, CSP report-only, X-CTO, Referrer-Policy, Permissions-Policy | S | N | `vercel.json` |

### Already closed — verified, do not re-fix

| ID | Audit item | Proof |
|---|---|---|
| C-01 | 23 vs 24+ years | `grep -ric "24+\|23+\|23 years" _source/` → **0** |
| C-02 | `ISO9001` spacing | → **0**; `ISO 9001` 14 hits, consistent |
| C-03 | `vercel.app` in canonicals/OG/robots/sitemap | → **0** |
| C-04 | "0 collisions" | → **0** |
| C-05 | "40% less onsite time" | → **0** |
| C-06 | 24/7 unqualified | reads "24/7 support **for AMC customers**" |
| C-07 | Office unit numbers | `Office 50` → **0** in source |

---

## 4. Where the two audits conflict

**4.1 Years of experience.** Claude says *"Use 23 everywhere (founded 2003)"*. ChatGPT says
*"Prefer 'Engineering Since 2003' … removes a recurring annual maintenance issue"*.

→ **Recommend ChatGPT.** A hard-coded "23" is wrong on 1 January and silently wrong for a
year. The site has already adopted "Since 2003" (13 hits, 0 for any year count), so this
conflict is resolved in ChatGPT's favour *and already implemented*. The facts module should
derive any year count from `foundingYear` so the option stays open without a second source
of truth.

**4.2 Industries heading.** Claude says *"Change to 'Six industries…'"*. ChatGPT says
*"Prefer evergreen wording such as 'Different industries. One recurring challenge.'"*

→ **Recommend ChatGPT**, same reasoning: a count in prose has to be maintained against a
list that changes. Applies equally to F-01 on the home page.

**4.3 Scope and urgency.** Claude frames six must-fixes as ~half a day. ChatGPT frames a
launch decision plus a 30/60/90 acquisition programme.

→ **Not a conflict.** Claude is a go-live gate, ChatGPT is a growth plan. Sequenced, not
merged: the P0 block below is Claude's gate; Workstreams C–I are ChatGPT's programme.

**4.4 Redesign.** Both say do not redesign. The brief agrees ("an upgrade, not a redesign").
→ **Adopted as a constraint.** Recorded here because it bounds Workstream G: motion may be
added, visual language may not be replaced.

---

## 5. Proposed architecture (for approval)

### 5.1 Facts module — `_source/facts.conf` + build-time substitution

TypeScript is not available. The equivalent with the same guarantees:

```
# _source/facts.conf — single source of truth. No fact may live anywhere else.
company.name           = KNEO Automation Pvt. Ltd.
company.foundingYear   = 2003
company.iso            = ISO 9001:2015 Certified · Engineering since 2003
company.countries      = 30
...
stat.oee.value         = 18
stat.oee.label         = typical OEE uplift
stat.oee.evidence      =
stat.oee.verified      = false
```

`build.sh` gains a `{{FACT:key}}` resolver. The enforcement the brief asks for — *"a stat
with `verified: false` must never render as a number; enforce this in the component"* —
becomes a **build-time failure**: `{{STAT:oee}}` emits the label alone when
`verified = false`, and `build.sh` exits non-zero if a page interpolates a `.value` whose
`.verified` is not `true`. That is stronger than a runtime component guard, because it
cannot reach production at all.

### 5.2 CTA system — `{{CTA:intent}}` partial

A partial per intent plus a `{{CTABAND:intent}}`, resolving to markup carrying
`data-cta-id`, `data-intent`, `data-source-route`. The contact form reads these from the
query string. An audit script walks the built output and fails if any indexable route has
≠ 1 primary CTA — same gate the brief specifies, enforced in CI rather than by convention.

### 5.3 Motion system — tokens already partly exist

`main.css` already defines `--ease`, `--ease-out`, `--ease-in-out`. The brief's easing
values match `--ease` (`cubic-bezier(.22,1,.36,1)`) and `--ease-out`
(`cubic-bezier(.16,1,.3,1)`) exactly — so the token layer is a **rename and completion**,
not a new system. Add duration and stagger tokens; keep primitives as CSS classes driven
by the existing IntersectionObserver in `main.js`.

**The ≤ 20 KB gzipped motion budget is already met** — there is no animation library, and
all motion is hand-written CSS inside the existing 132 KB stylesheet. The risk is the
opposite of the brief's: not bundle size, but that `main.css`/`main.js` are single
unsplittable files. Splitting them is a larger change than this programme should absorb;
I recommend accepting it and measuring, not restructuring.

---

## 6. DECISIONS NEEDED

| ID | Decision | Blocks | Why I cannot decide it |
|---|---|---|---|
| ~~D-01~~ | **ANSWERED 26 Sep:** target domain is `kneo.in`, but deployment is later. `SITE_URL` stays on `https://kneo-website.vercel.app` while testing, and flips to `https://kneo.in` at deploy. One variable, one edit. | F-14 | resolved |
| D-02 | OEM/customer logo permissions — which may be shown, and the exact relationship wording | F-12 | Legal/commercial fact, not a code decision |
| D-03 | Privacy grievance officer — name and dedicated address | F-09, F-10 | Personnel fact |
| D-04 | Quantified claims — is there evidence for 80%, 60%, 30%, 18%? | F-23, F-24, F-27 | Evidence policy: unverified numbers must not render |
| D-05 | Email provider + `RESEND_API_KEY` in Vercel | F-13 | Account access |
| D-06 | Legacy kneo.in URL list for the 301 map | F-16 | Brief says do not guess old paths |
| D-07 | Auto Ballooning production-ready file formats | F-25 | Product fact |
| D-08 | Offshore engagement models + commercial specifics | F-29 | Commercial policy |
| D-09 | Analytics provider and consent approach | F-30 | Tooling/legal choice |
| D-10 | Office unit numbers — 502–504 or 501–505 | — (not in source) | Raised by the audit; not currently on the site |
| D-11 | Partner badges — Inductive Automation, Siemens, ISO 9001:2015 | Workstream H | Documented status only |
| D-12 | **May I install Lighthouse CI, Playwright and axe via npm?** | All §3 acceptance gates | Guardrail 6: >15 KB needs approval |
| D-13 | **Does the brief's stack translation in §5 stand?** | Workstreams B, D, G | The brief assumes a framework that is not here |

---

## 7. Recommended sequence

**Gate 1 — go-live blockers (P0).** F-01, F-02, F-03, F-08, F-09, F-12, F-13, F-14, F-25.
Everything except F-03 is copy, config or a decision. F-03 (video) needs ffmpeg, which is
not installed.

**Gate 2 — launch week (P1).** F-04, F-05, F-10, F-11, F-15, F-16, F-28, F-29, F-30.

**Gate 3 — month 1 (P2)** then **backlog (P3).**

---

## 8. What I did not do

- Did not modify any application code (brief §7).
- Did not invoke the UI/design skills named in your prompt. Workstream A is discovery;
  they belong in Workstreams D and G.
- Did not produce Lighthouse or axe baselines — tooling absent, pending D-12.
- Did not inventory primary CTAs per route — deferred to Workstream D, where it is the
  input to the audit script.
- Did not fix the seven already-closed items, and recommend nobody does.

---

## 9. Approval requested

Workstream A is complete. To proceed to Workstream B I need, at minimum:

1. **D-13** — confirmation that the §5 stack translation is acceptable.
2. **D-12** — whether I may install QA tooling via npm.
3. **D-01** — the production domain.
4. Confirmation that the seven **CLOSED-VERIFIED** items stay closed.

Everything else in the DECISIONS register can arrive as the relevant workstream starts.

---

## 10. Addendum — 26 Sep, after Workstream A

### 10.1 Out-of-sequence change: global density

You asked for reduced spacing and text size across all pages. That sits outside the
checkpoint protocol (§4.1 of the brief), so recording it plainly: **this was done on your
direct instruction, before Workstream A was approved.** It is copy-free and revertible in
one line.

Implemented as three tokens in `:root`, with every size and vertical rhythm expressed as
`calc(<original> * var(--token))`:

```css
--type-scale:  .93;   /* headings and leads */
--body-scale:  .97;   /* body copy — floor is .94 (15px) */
--space-scale: .76;   /* vertical rhythm */
```

Set all three to `1` and the original scale returns. That is the entire revert.

**Body copy is deliberately on its own knob.** What made pages feel oversized was an h1 at
77px and 51px of section padding, not 16px body text. Shrinking body copy is the one change
here that costs readability, and this site is read by plant managers and controls engineers
scanning for capability, so it moved 16px → 15.5px and no further.

Measured at 1280px on the home page:

| | Before | After |
|---|---|---|
| Page height | 13,206px | **12,399px** |
| Hero h1 | 76.8px | 71.4px |
| h2 | 58.9px | 54.8px |
| Body | 16px / 26.4 lh | 15.5px / 24.8 lh |
| Section padding | 51.2px | 38.9px |

Verified across home, industrial-automation, mapp, about, services, contact,
auto-ballooning and insights: body 15.52px on all eight, no horizontal overflow on any.
Mobile (385px): body 15.5px, h1 37.2px, no sideways scroll.

### 10.2 New finding

| ID | Route/area | Finding | Src | Sev | Fix | Eff | Decision | Files |
|---|---|---|---|---|---|---|---|---|
| F-32 | Site-wide | **14 label styles render below 12px**, smallest `logo-tile__meta` at 9.92px; also `cell__tag` 10.88px (×23), `radial__key` 10.08px, `footer__title` 10.88px, `stat__label` 11.2px, `eyebrow` 11.52px (×12) | N | P2 | Raise the label floor to 12px | S | N | `main.css` — `.cell__tag`, `.stat__label`, `.logo-tile__meta`, `.eyebrow`, `.radial__*`, `.footer__title`, `.cat` |

**Not caused by the density change.** These are all `rem`-based (`.68rem`, `.7rem`), and
the change moved `body` font-size, not `html`, so `rem` sizes were untouched. Verified by
reading each rule. They were already this size; the density pass simply surfaced them.

### 10.3 D-01 answered

Target domain `kneo.in` confirmed; deployment later. `SITE_URL` stays on
`https://kneo-website.vercel.app` during testing. F-14 becomes a one-variable flip at
deploy rather than a pre-launch task — but note that while `SITE_URL` points at
vercel.app, **canonicals and OG URLs legitimately point there too**, which is correct for
a test deployment and must not be "fixed" before the move.

---

## 11. CORRECTION — my §0.2 was wrong on two rows

A third document arrived (`docs/audits/vercel-revalidation.docx`, same date, revalidated
against the live Vercel URL). It caught a defect I had marked closed, and it was right.

**My error:** §5.A.4 of the brief says to grep for those terms. I grepped `_source/` only.
This site is template-driven — `{{YEARS}}` and `{{SITE}}` are resolved by `build.sh` — so
the strings that matter never appear in source. **A defect scan on a templated site has to
run against built output, and mine did not.**

Re-run against built HTML, the two rows that change:

| Item | I said | Actually |
|---|---|---|
| "23 years" inconsistency | already closed (0 hits in source) | **55 hits in built output** — every page |
| `vercel.app` in canonicals/OG/sitemap | already closed (0 hits in source) | **560 hits**, incl. all 54 sitemap URLs |

### F-33 — dynamic year counter (supersedes C-01)

`build.sh:262` computes `YEARS=$(( $(date +%Y) - 2003 ))` → **23**. It renders in the stats
block and in the footer of all 55 pages:

> © 2026 KNEO Automation Pvt. Ltd. · **23 Years · 30+ Countries · 400+** Projects

Both other audits recommended evergreen "Engineering since 2003" and the prose adopted it —
but the **counter** was never removed. So the site says "since 2003" in prose and "23 Years"
in the footer of every page. The third audit's fix is the right one: **remove the dynamic
counter**, do not just change its label. Severity **P0**.

### The other three rendered claims

| Claim | Built hits | Status |
|---|---|---|
| `30+` countries | 121 | unverified — D-04 |
| `400+` projects | 63 | unverified — D-04 |
| `8` years in Industry 4.0 | stats block | unverified — D-04 |

These are exactly the "internal evidence/approval register" the third audit asks for, and
the `stats[]` + `verified` design in §5.1 is built for them.

### `vercel.app` is not currently a defect

560 hits, but per D-01 the site is deliberately on vercel.app while testing. Canonicals
pointing there is **correct for a test deployment**. It becomes a P0 the moment the domain
moves, and it is one `SITE_URL` flip. Left as F-14, not reopened.

### What the third audit adds that the other two did not

| | |
|---|---|
| **Product hierarchy** | Group the portfolio as 01 Automation Engineering / 02 Manufacturing Intelligence / 03 Digital Quality. **The single most valuable new idea across all three documents** — it fixes a real navigation problem no one else named. |
| **Nav rename** | "MES Platform" → "MAPP Platform". Verified present in `header.html:18`, `header.html:206`, `footer.html:36`. Concrete, cheap, and the brand name is the one buyers will search. |
| **SEO cluster map** | Landing pages grouped by cluster with a CTA each — more actionable than the flat list in the ChatGPT audit. |
| **MAPP module-selection matrix** | problem → module → user → inputs → outputs. |

### Where it is weak

- **The 8.8/10 has no rubric behind it.** No method, no weighting, no comparison basis. It
  reads precise and is not measurable. Ignore the number; use the findings.
- **It conflicts with the density work.** It calls the homepage "long and information-dense"
  and asks for more whitespace (P2), which is the opposite of the direction just taken. Both
  can be true — it wants *hierarchy*, not *air* — but the tension is real and is flagged
  rather than silently resolved.
- Like the others, it restates some items already closed (`24+`, `ISO9001`, `0 collisions`,
  `40%`, unqualified 24/7 — all still 0 in built output).

### Convergence is the real signal

Three independent reviews, three different methods, and they agree on five things: verify
the quantified claims, verify the logos, publish case studies, make the offshore engineering
offer explicit, and test the contact form. **That agreement is worth more than any of the
three individual scores.** Those five are the programme.
