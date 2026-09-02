// Generates docs/LaGrange-Parking-Developer-Guide.docx — a Word developer guide
// styled after the MGP "Standard Intranet (Flexible Sections)" document.
// Run: node scripts/generate-dev-guide.mjs
import {
  AlignmentType, BorderStyle, Document, ExternalHyperlink, Footer, HeadingLevel, ImageRun,
  LevelFormat, Packer, PageBreak, PageNumber, Paragraph, ShadingType, Table, TableCell,
  TableOfContents, TableRow, TextRun, WidthType, convertInchesToTwip,
} from 'docx';
import { readFileSync, writeFileSync } from 'node:fs';

// ---- palette (matched to the reference document) ---------------------------
const BANNER_BLUE = '1F5C8B';
const HEADING_BLUE = '2E74B5';
const TITLE_BLUE = '1F4E79';
const CALLOUT_FILL = 'EAF3FA';
const CALLOUT_BORDER = '7FB2D9';
const CODE_FILL = 'F2F2F2';
const GRAY = '808080';

const BODY_FONT = 'Arial';
const CODE_FONT = 'Consolas';

// ---- helpers ---------------------------------------------------------------
const p = (text, opts = {}) =>
  new Paragraph({
    spacing: { after: 120, ...opts.spacing },
    ...opts.para,
    children: Array.isArray(text)
      ? text
      : [new TextRun({ text, font: BODY_FONT, size: 21, ...opts.run })],
  });

const bold = (text) => new TextRun({ text, font: BODY_FONT, size: 21, bold: true });
const plain = (text) => new TextRun({ text, font: BODY_FONT, size: 21 });
const mono = (text) => new TextRun({ text, font: CODE_FONT, size: 19 });

const h1 = (text) => new Paragraph({ heading: HeadingLevel.HEADING_1, spacing: { before: 240, after: 120 }, children: [new TextRun({ text, font: BODY_FONT, size: 26, bold: true, color: HEADING_BLUE })] });
const h2 = (text) => new Paragraph({ heading: HeadingLevel.HEADING_2, spacing: { before: 240, after: 100 }, children: [new TextRun({ text, font: BODY_FONT, size: 23, bold: true, color: HEADING_BLUE })] });
const h3 = (text) => new Paragraph({ heading: HeadingLevel.HEADING_3, spacing: { before: 200, after: 80 }, children: [new TextRun({ text, font: BODY_FONT, size: 21, bold: true, color: TITLE_BLUE })] });

const bullet = (runs, level = 0) =>
  new Paragraph({
    bullet: { level },
    spacing: { after: 60 },
    children: Array.isArray(runs) ? runs : [plain(runs)],
  });

let numInstance = 0;
const numberedList = (items) => {
  numInstance += 1;
  return items.map(
    (runs) =>
      new Paragraph({
        numbering: { reference: 'steps', level: 0, instance: numInstance },
        spacing: { after: 60 },
        children: Array.isArray(runs) ? runs : [plain(runs)],
      })
  );
};

const code = (lines) =>
  (Array.isArray(lines) ? lines : [lines]).map(
    (line, i, arr) =>
      new Paragraph({
        shading: { type: ShadingType.CLEAR, fill: CODE_FILL },
        spacing: { after: i === arr.length - 1 ? 120 : 0 },
        indent: { left: convertInchesToTwip(0.25) },
        children: [new TextRun({ text: line || ' ', font: CODE_FONT, size: 19 })],
      })
  );

const caption = (text) =>
  new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: 160 },
    children: [new TextRun({ text, font: BODY_FONT, size: 18, italics: true, color: GRAY })],
  });

// Screenshot (captured from the live sites at 1280x800) + italic caption
const screenshot = (file, captionText, widthIn = 6.2) => {
  const w = Math.round(widthIn * 96);
  const h = Math.round(w * (800 / 1280));
  return [
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 120, after: 60 },
      children: [
        new ImageRun({
          type: 'png',
          data: readFileSync(new URL(`../docs/guide-assets/${file}`, import.meta.url)),
          transformation: { width: w, height: h },
        }),
      ],
    }),
    caption(captionText),
  ];
};

const link = (text, url) =>
  new ExternalHyperlink({
    link: url,
    children: [new TextRun({ text, font: BODY_FONT, size: 21, color: HEADING_BLUE, underline: {} })],
  });

const noBorder = { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' };

// Dark-blue chapter banner (like the reference's section headers)
const banner = (text) =>
  new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({
        children: [
          new TableCell({
            shading: { type: ShadingType.CLEAR, fill: BANNER_BLUE },
            borders: { top: noBorder, bottom: noBorder, left: noBorder, right: noBorder },
            margins: { top: 160, bottom: 160, left: 240, right: 240 },
            children: [
              new Paragraph({
                children: [new TextRun({ text, font: BODY_FONT, size: 28, bold: true, color: 'FFFFFF' })],
              }),
            ],
          }),
        ],
      }),
    ],
  });

// Light-blue callout box ("Before you begin — …")
const callout = (title, bodyChildren) =>
  new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({
        children: [
          new TableCell({
            shading: { type: ShadingType.CLEAR, fill: CALLOUT_FILL },
            borders: {
              top: { style: BorderStyle.SINGLE, size: 6, color: CALLOUT_BORDER },
              bottom: { style: BorderStyle.SINGLE, size: 6, color: CALLOUT_BORDER },
              left: { style: BorderStyle.SINGLE, size: 6, color: CALLOUT_BORDER },
              right: { style: BorderStyle.SINGLE, size: 6, color: CALLOUT_BORDER },
            },
            margins: { top: 160, bottom: 160, left: 240, right: 240 },
            children: [
              new Paragraph({
                spacing: { after: 100 },
                children: [new TextRun({ text: title, font: BODY_FONT, size: 21, bold: true, color: HEADING_BLUE })],
              }),
              ...bodyChildren,
            ],
          }),
        ],
      }),
    ],
  });

const spacer = () => new Paragraph({ spacing: { after: 120 }, children: [] });

// Simple bordered 2-column-ish table
const infoTable = (rows, widths) =>
  new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: rows.map(
      (cells, r) =>
        new TableRow({
          children: cells.map(
            (cell, c) =>
              new TableCell({
                width: widths ? { size: widths[c], type: WidthType.PERCENTAGE } : undefined,
                shading: r === 0 ? { type: ShadingType.CLEAR, fill: 'DEEAF6' } : undefined,
                margins: { top: 60, bottom: 60, left: 120, right: 120 },
                children: [
                  new Paragraph({
                    children: [
                      r === 0
                        ? new TextRun({ text: String(cell), font: BODY_FONT, size: 20, bold: true })
                        : cell instanceof TextRun
                          ? cell
                          : Array.isArray(cell)
                            ? cell[0]
                            : new TextRun({ text: String(cell), font: BODY_FONT, size: 20 }),
                      ...(Array.isArray(cell) ? cell.slice(1) : []),
                    ],
                  }),
                ],
              })
          ),
        })
    ),
  });

const pageBreak = () => new Paragraph({ children: [new PageBreak()] });

// ---- document content ------------------------------------------------------
const children = [];

// Cover page
children.push(
  new Paragraph({ spacing: { before: convertInchesToTwip(2.2) * 20 / 20 }, children: [] }),
  new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 2600, after: 200 },
    children: [new TextRun({ text: 'MGP Inc. — GIS & Web Applications', font: BODY_FONT, size: 24, bold: true, color: '404040' })],
  }),
  new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: 160 },
    children: [new TextRun({ text: 'La Grange Parking Apps', font: BODY_FONT, size: 52, bold: true, color: TITLE_BLUE })],
  }),
  new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: 400 },
    children: [new TextRun({ text: 'Developer Guide', font: BODY_FONT, size: 30, italics: true, color: '595959' })],
  }),
  new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: 300 },
    children: [
      new TextRun({
        text: 'How the Village of La Grange permit and public parking maps are built, how to make the most common content edits safely, and how to verify and deploy changes.',
        font: BODY_FONT, size: 21, color: '404040',
      }),
    ],
  }),
  new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: 80 },
    children: [link('Permit app — mango-cliff-087d26410.7.azurestaticapps.net', 'https://mango-cliff-087d26410.7.azurestaticapps.net')],
  }),
  new Paragraph({
    alignment: AlignmentType.CENTER,
    children: [link('Public app — ashy-mud-0b906db10.7.azurestaticapps.net', 'https://ashy-mud-0b906db10.7.azurestaticapps.net')],
  }),
  pageBreak()
);

// Table of contents
children.push(
  new Paragraph({
    spacing: { after: 120 },
    children: [new TextRun({ text: 'Table of Contents', font: BODY_FONT, size: 26, bold: true, color: HEADING_BLUE })],
  }),
  new TableOfContents('Table of Contents', { hyperlink: true, headingStyleRange: '1-3' }),
  new Paragraph({
    spacing: { before: 200 },
    children: [new TextRun({ text: 'If page numbers are missing, right-click the table and choose "Update Field" (or press Ctrl+A then F9).', font: BODY_FONT, size: 18, italics: true, color: GRAY })],
  }),
  pageBreak()
);

// ---------------------------------------------------------------- Chapter 1
children.push(banner('1. Overview & Architecture'), spacer());
children.push(h1('1. Overview & Architecture'));
children.push(p('The repo builds two public, mobile-friendly interactive parking maps for the Village of La Grange from one codebase. Each is a static single-page app with hash routing — no server, no login, no identity.'));
children.push(h2('Live sites — always compare against these'));
children.push(
  bullet([bold('Permit app: '), link('https://mango-cliff-087d26410.7.azurestaticapps.net', 'https://mango-cliff-087d26410.7.azurestaticapps.net')]),
  bullet([bold('Public app: '), link('https://ashy-mud-0b906db10.7.azurestaticapps.net', 'https://ashy-mud-0b906db10.7.azurestaticapps.net')])
);
children.push(p('Before and after any change, open the live site next to your local dev server — what is deployed is the reference for "how it should look".'));
children.push(
  infoTable(
    [
      ['App', 'Audience', 'Build mode / profile', 'Live URL'],
      ['Permit', 'Permit holders (4 permit-type pages)', [mono('--mode permit · lagrange-permit.json')], 'mango-cliff-087d26410.7.azurestaticapps.net'],
      ['Public', 'Visitors (time-based parking)', [mono('--mode public · lagrange-public.json')], 'ashy-mud-0b906db10.7.azurestaticapps.net'],
    ],
    [12, 30, 28, 30]
  ),
  spacer()
);
children.push(h2('Technology stack'));
children.push(
  bullet('React 19 + TypeScript + Vite 7 — no state library, React hooks only'),
  bullet([plain('ArcGIS Maps SDK for JavaScript v5 ('), mono('@arcgis/core'), plain(') — anonymous access, no login')]),
  bullet([plain('Custom CSS with '), mono('--lf-*'), plain(' / '), mono('--font-*'), plain(' variables (defaults in '), mono('src/styles/index.css'), plain(')')]),
  bullet('Azure Static Web Apps (Free plan) hosting — one SWA resource per app')
);
children.push(h2('The Guided Finder is the app'));
children.push(p([mono('App.tsx'), plain(' renders the '), bold('Guided Finder'), plain(' directly — the "pick your permit type" experience the Village reviewed and approved. Two alternative layouts remain reachable for internal comparison only: '), mono('#/explorer'), plain(' (the Explorer / '), mono('ParkingApp.tsx'), plain(') and '), mono('#/directory'), plain('. Nothing links to them.')]));
children.push(...screenshot('permit-picker.png', 'The permit app\u2019s Guided Finder — the visitor picks a permit type, then sees only that page\u2019s lots and rules.'));
children.push(callout('Do not add a landing page or layout chooser', [
  p('The old HomePage.tsx that asked visitors to pick a layout was removed on purpose (it is in git history if ever needed). The Guided Finder is the single public experience — do not reintroduce a chooser.'),
]));
children.push(spacer());
children.push(h2('Profile-driven design'));
children.push(p([plain('Nearly every piece of content a developer will ever be asked to change lives in a JSON profile, not in components: '), mono('public/profiles/lagrange-permit.json'), plain(' and '), mono('public/profiles/lagrange-public.json'), plain('. A profile controls the layer URL and field mapping, symbology and legend, the audience tabs (which lots, which rules, all sidebar text), branding, and map extent. Components are generic — '), bold('never hardcode field names, lot ids, or copy in components'), plain('.')]));
children.push(p([plain('Which profile loads is set per build mode by '), mono('VITE_PROFILE'), plain(' in '), mono('.env.permit'), plain(' / '), mono('.env.public'), plain('.')]));
children.push(h2('Data flow (permit app)'));
children.push(
  ...code([
    'main.tsx (esriConfig.apiKey) -> App -> useParkingProfile() -> GuidedFinder',
    '  useParkingLayer    FeatureLayer + renderer from profile.symbology (baseWhere applied)',
    '  useSelectedLot     queries the current page\'s feature set',
    '  useRelatedRules    queries ParkingRule by AREAID + the page\'s ruleWhere',
    '  useSubzoneAreaIds  which lots have designated overnight bands drawn',
    '  GuidedFinder       definitionExpression = baseWhere AND memberFilter',
    '                     memberFilter = tab.areaIds  (Village\'s verbatim list — wins)',
    '                                  ?? rules-derived (useAudienceAreaIds)',
    '                                  ?? tab.where (HAS* flags — last resort)',
    '    PermitInfo ("What you need to know") | MapPanel | FeatureList | LotDetailCard',
  ])
);
children.push(h2('Repository layout'));
children.push(
  infoTable(
    [
      ['Path', 'What lives there'],
      [[mono('public/profiles/')], 'The two app profiles — most content edits happen here'],
      [[mono('src/components/')], 'Generic React components (GuidedFinder in templates/, MapPanel, LotDetailCard…)'],
      [[mono('src/hooks/')], 'Data hooks (useParkingLayer, useRelatedRules, useSubzoneAreaIds…)'],
      [[mono('src/config/types.ts')], 'TypeScript shape of the profile JSON — read this before editing a profile'],
      [[mono('scripts/')], 'Verification scripts run against the live GIS services (read-only)'],
      [[mono('docs/')], 'PROJECT-CONTEXT.md, DATA.md, BACKLOG.md — required reading (see below)'],
      [[mono('CLAUDE.md')], 'Condensed working notes for AI-assisted editing — accurate for humans too'],
      [[mono('DEPLOY.md')], 'Azure resources and manual deploy commands'],
    ],
    [30, 70]
  ),
  spacer()
);
children.push(callout('The nested lagrange-parking/ folder is a stale copy', [
  p('The repo root is the real app. The lagrange-parking/ subfolder is an old duplicate — never edit or commit anything inside it.'),
]));
children.push(pageBreak());

// ---------------------------------------------------------------- Chapter 2
children.push(banner('2. Getting Started'), spacer());
children.push(h1('2. Getting Started'));
children.push(p('A fresh clone runs with no configuration. There is no database, no API server, and no secrets needed for local development — both apps read public ArcGIS Online services anonymously.'));
children.push(h2('Step 1 — Install and run'));
children.push(
  ...numberedList([
    [plain('Install Node.js 20+ (24 recommended), then run '), mono('npm install')],
    [mono('npm run dev'), plain(' starts the permit app (Vite, usually http://localhost:5173)')],
    [mono('npm run dev:public'), plain(' starts the public app — both can run at once; Vite picks the next free port')],
  ])
);
children.push(h2('Step 2 — Know the commands'));
children.push(
  ...code([
    'npm run dev            # permit app  (--mode permit)',
    'npm run dev:public     # public app  (--mode public)',
    'npm run build          # both -> dist/permit and dist/public',
    'npm run lint           # 5 errors on main are pre-existing — do not chase them',
    'node scripts/verify-permit-pages.mjs   # check profiles against live data',
  ])
);
children.push(p('There is no test framework. Verification is done with the scripts in Chapter 6 plus a manual browser pass.'));
children.push(callout('About VITE_ARCGIS_API_KEY — the repo contradicts itself', [
  p([plain('Comments in '), mono('src/main.tsx'), plain(' say an API key is required for the basemap. Measured truth: the GISC tile services currently serve tiles anonymously, so the app runs keyless and a fresh clone renders correctly with no .env at all.')]),
  p('Keep the key in production builds anyway — ArcGIS Online sharing can change underneath this repo. If the basemap ever disappears, run node scripts/verify-basemaps.mjs before assuming it is a code bug.'),
]));
children.push(pageBreak());

// ---------------------------------------------------------------- Chapter 3
children.push(banner('3. Content Rules — Non-Negotiable'), spacer());
children.push(h1('3. Content Rules — Non-Negotiable'));
children.push(p('These come from the Village stakeholder (Charity) and are easy to violate by accident. Do not break them without her explicit sign-off.'));
children.push(
  bullet([bold('No pricing. '), plain('RATE_TEXT / RATE_MONTHLY exist in the data and are populated (e.g. "$45/month"). They are deliberately excluded from every profile display list. Do not surface them.')]),
  bullet([bold('No "decal". '), plain('The word survives only as internal RULETYPE codes (CBD_DECAL, COMMUTER_DECAL…). It must never appear in user-visible text.')]),
  bullet([bold('Guidance over policy. '), plain('Plain language telling someone where they may park — not ordinance text.')]),
  bullet([bold('tab.areaIds is policy. '), plain('It is the Village\'s verbatim list of which lots appear on each permit page. Never replace it with a data-derived guess.')]),
  bullet([bold('Per-lot detail is secondary. '), plain('The permit-wide "What you need to know" panel is the primary content. The permit profile\'s fields.display is intentionally empty — do not add attribute rows back without stakeholder approval.')])
);
children.push(spacer());
children.push(callout('Before you change any behaviour — read docs/BACKLOG.md', [
  p('Several obvious-looking "bugs" are known upstream data problems with a decision already attached (e.g. lots that return no rules on some pages). Check the backlog before "fixing" anything, and check the dated "Current state" block in docs/PROJECT-CONTEXT.md to know what is currently true.'),
]));
children.push(pageBreak());

// ---------------------------------------------------------------- Chapter 4
children.push(banner('4. Common Edits (Profiles)'), spacer());
children.push(h1('4. Common Edits (Profiles)'));
children.push(p([plain('Every task in this chapter is a JSON edit in '), mono('public/profiles/'), plain(' — no component changes. In dev, profiles are fetched at runtime: save the JSON and hard-reload the browser. In production the profile ships with the build, so deploy after editing (Chapter 7).')]));
children.push(p([plain('The authoritative shape of the profile is '), mono('src/config/types.ts'), plain(' — every property is documented there.')]));

children.push(h2('4.1 — Edit the "What you need to know" sidebar text'));
children.push(
  ...numberedList([
    [plain('Open '), mono('lagrange-permit.json'), plain(' and find the tab by its '), mono('id'), plain(' ('), mono('resident-overnight'), plain(', '), mono('resident-24hr'), plain(', '), mono('commuter'), plain(', '), mono('employees'), plain(')')],
    [plain('Edit '), mono('tab.guide.sections'), plain(' — each section has a '), mono('title'), plain(' and '), mono('bullets'), plain('; bullets support nested '), mono('items'), plain(' and inline '), mono('links')],
    [plain('Save and hard-reload — verify the wording on the page')],
  ])
);
children.push(caption('Example: the "Effective October 1st, …" prefixes added Sept 2026 were one-line edits to two guide bullets.'));

children.push(h2('4.2 — Add or remove a lot on a permit page'));
children.push(
  ...numberedList([
    [plain('Add/remove the AREAID in that tab\'s '), mono('areaIds'), plain(' array (this list is policy — see Chapter 3)')],
    [plain('Update the related guide text if it names lots (e.g. "valid anywhere within Lot 2 and Lot 4")')],
    [plain('Run '), mono('node scripts/verify-permit-pages.mjs'), plain(' — every listed id must resolve against the live service')],
  ])
);
children.push(callout('The lot must also pass the layer baseWhere', [
  p([plain('The permit app\'s layer filter is '), mono("USERCLASS = 'PERMIT'"), plain(' — a lot whose USERCLASS is VISITOR will be listed but never draw. Check with a quick anonymous query before adding (see Chapter 5), as was done when LOT4 was added to the Employees page.')]),
]));
children.push(spacer());

children.push(h2('4.3 — Rename how a lot displays'));
children.push(p([plain('Add an entry to '), mono('profile.nameOverrides'), plain(' keyed by AREAID (e.g. '), mono('"VILLAGEHALLPARKINGSTRUCTURE": "VH Garage"'), plain('). This relabels map labels, lists, and detail cards without touching hosted data.')]));

children.push(h2('4.4 — Notes on lot detail cards'));
children.push(
  bullet([mono('tab.note'), plain(' — shown on every lot card for that page')]),
  bullet([mono('tab.lotNotes'), plain(' — per-AREAID override of '), mono('note')]),
  bullet([mono('tab.lotSubzoneNotes'), plain(' — per-AREAID note in the green designated-area callout style; wins over the live GIS-derived subzone note')])
);

children.push(h2('4.5 — Designated spaces inside a lot (two mechanisms)'));
children.push(p([bold('Subzones ('), mono('profile.subzones'), bold(') — '), plain('draws the resident overnight bands from the hosted LaGrange_Overnight_Resident_Subzones layer on any tab with '), mono('showSubzones: true'), plain('. Bands appear only when a lot is selected and the view is zoomed in ('), mono('minScale'), plain(') — both stakeholder requirements.')]));
children.push(...screenshot('resident-lot5-subzones.png', 'Subzones — Resident Overnight page, Lot 5 selected: the green bands are the only spaces valid overnight, and the lot card carries the matching note.'));
children.push(p([bold('Overlay layers ('), mono('profile.overlayLayers'), bold(') — '), plain('draw an arbitrary filtered polygon (e.g. the Lot 5 CBD employee rows). Key properties: '), mono('where'), plain(' (server-side filter), '), mono('showForAreaId'), plain(' (only while that lot is selected), and '), mono('showForTabIds'), plain(' (only on those permit pages). The Lot 5 CBD overlay is pinned to '), mono('["employees"]'), plain('.')]));
children.push(...screenshot('employees-lot5-overlay.png', 'Overlay — Employees page, Lot 5 selected: the same lot instead shows the CBD employee rows overlay (showForTabIds: ["employees"]).'));
children.push(callout('Only permitted areas were digitized — absence of green is ambiguous', [
  p('"No bands" can mean "nothing permitted here" or "not drawn yet" (VH Garage, Lot 15). useSubzoneAreaIds asks the service which lots actually have bands and the card sentence only shows for those. Never show the "park only in the highlighted areas" sentence unconditionally.'),
  p('This also fails quiet: if the subzone service stops answering anonymously, all bands and notes silently disappear. See docs/DATA.md §3.6.'),
]));
children.push(spacer());

children.push(h2('4.6 — Public map availability / time-limit text'));
children.push(p([plain('The "Public parking" block on the public app\'s lot cards ('), bold('Availability / Time limit'), plain(') comes from '), mono('profile.areaInfo'), plain(' in '), mono('lagrange-public.json'), plain(' — hard-coded per-lot overrides, '), bold('not'), plain(' the hosted ParkingRule table. If the Village changes a time limit, edit the '), mono('timeLimit'), plain(' string there (e.g. Village Hall Surface Lot 3 hr → 4 hr, Sept 2026). Check whether the hosted data needs the same change and flag it if so.')]));children.push(...screenshot('public-vh-surface-lot.png', 'Public app, Village Hall Surface Lot — the Availability / Time limit lines come from profile.areaInfo, not from the GIS rules.'));
children.push(h2('4.7 — Legend and symbology'));
children.push(p([mono('profile.symbology'), plain(' maps renderer field values to colors/labels; '), mono('ruleSymbology'), plain(' colors the rule chips. The public profile also supports '), mono('match'), plain('-based categories and a '), mono('consolidateList'), plain(' block that collapses ~100 on-street segments into one row.')]));
children.push(pageBreak());

// ---------------------------------------------------------------- Chapter 5
children.push(banner('5. Data & GIS Services'), spacer());
children.push(h1('5. Data & GIS Services'));
children.push(p('Both apps read hosted ArcGIS Online feature services anonymously. Full data model, pipeline (LGDM → FGDB → AGOL) and every known data defect: docs/DATA.md. Publishing steps: docs/GIS-PUBLISH.md.'));
children.push(
  infoTable(
    [
      ['Service / sublayer', 'Purpose'],
      [[mono('LaGrange_Parking_Permits/FeatureServer/2')], 'ParkingArea polygons — the lots (AREAID, AREANAME, USERCLASS, FACILITYTYPE, HAS* flags, MAXSPACES)'],
      [[mono('LaGrange_Parking_Permits/FeatureServer/3')], 'ParkingRule table — related rules by AREAID (RULETYPE, ENFORCE_TEXT, MAXDURATION, PERMITZONE)'],
      [[mono('LaGrange_Overnight_Resident_Subzones/FeatureServer/0')], 'Designated overnight parking bands (YES-only digitization)'],
      [[mono('LaGrangeImportantPlaces_ParkingContext_/FeatureServer/0')], 'Reference polygons — parks, civic buildings, Metra station'],
    ],
    [45, 55]
  ),
  spacer()
);
children.push(callout('Republishing the service breaks both apps — every time', [
  p('Republishing resets AGOL sharing to org-only and both apps immediately fail with {"code":499,"message":"Token Required"}. After ANY republish, re-share Public and verify: an untokened fetch of'),
  ...code(['…/FeatureServer/2/query?where=1=1&returnCountOnly=true&f=json']),
  p('must return a count, not an error. Sublayer ids survive an overwrite ([2] ParkingArea, [3] ParkingRule) — the profiles hardcode those URLs.'),
]));
children.push(spacer());
children.push(h2('Querying the live data (read-only, no credentials)'));
children.push(p('Any REST query works anonymously — handy for checking an AREAID or rule before a profile edit:'));
children.push(
  ...code([
    "node -e 'fetch(\"https://services2.arcgis.com/FwavjPsU0K1YB1vX/arcgis/rest/services/\" +",
    "  \"LaGrange_Parking_Permits/FeatureServer/2/query?where=AREAID=%27LOT4%27\" +",
    "  \"&outFields=AREAID,USERCLASS,HASCBD&returnGeometry=false&f=json\")",
    "  .then(r=>r.json()).then(j=>console.log(JSON.stringify(j.features)))'",
  ])
);
children.push(pageBreak());

// ---------------------------------------------------------------- Chapter 6
children.push(banner('6. Verify & Test'), spacer());
children.push(h1('6. Verify & Test'));
children.push(p('Run these before showing changes to the Village or deploying. All are read-only against the live services.'));
children.push(
  infoTable(
    [
      ['Script', 'What it proves'],
      [[mono('verify-permit-pages.mjs')], 'Every lot listed in every permit tab resolves against the live service and returns rules for its page. Warns on lots with NO RULES (known upstream RULETYPE mislabels — not profile bugs).'],
      [[mono('verify-basemaps.mjs')], 'Each basemap actually serves a real deepest-zoom tile over La Grange (service metadata alone is not proof of coverage).'],
      [[mono('inspect-service.mjs')], 'Schema + value distributions of the hosted service.'],
      [[mono('verify-filters.mjs')], 'Historical — predates the four-page model. Do not trust its three-audience buckets.'],
    ],
    [30, 70]
  ),
  spacer()
);
children.push(h2('Manual browser pass'));
children.push(
  ...numberedList([
    'Permit app: open each of the four permit pages; click a lot on each; confirm the sidebar text, notes, and any designated-space bands look right',
    'Resident pages: select Lot 5 and confirm the overnight bands draw when zoomed in; Employees: select Lot 5 and confirm the CBD rows overlay draws instead',
    'Public app: select a few lots and confirm Availability / Time limit text',
  ])
);
children.push(...screenshot('public-overview.png', 'Public app overview — legend categories, consolidated on-street row, and the lot list. Compare your local build against the live site.'));
children.push(callout('Known noise — do not chase these', [
  bullet('5 ESLint errors on main are pre-existing'),
  bullet('Esri deprecation warnings in the console (Home/Locate widgets, Polygon.centroid) are expected'),
  bullet('NO RULES warnings for Lot 13 (commuter), Lot 2 / VH Garage (employees) are upstream data issues; those pages set showRules: false anyway'),
]));
children.push(pageBreak());

// ---------------------------------------------------------------- Chapter 7
children.push(banner('7. Build, Publish & Deploy'), spacer());
children.push(h1('7. Build, Publish & Deploy'));
children.push(h2('Step 1 — Build'));
children.push(...code(['npm run build   # -> dist/permit and dist/public']));
children.push(h2('Step 2 — Commit and push'));
children.push(callout('Branch gotcha — local is master, remote default is main', [
  p([plain('The local branch is named '), mono('master'), plain(' but the GitHub default branch is '), mono('main'), plain('. A plain '), mono('git push origin master'), plain(' creates a stray remote branch. Always push with:')]),
  ...code(['git push origin master:main']),
]));
children.push(spacer());
children.push(h2('Step 3 — Deploy both Static Web Apps'));
children.push(p('Azure context: tenant Spark by MGP (Community-Essentials.com), subscription "Microsoft Azure Sponsorship", resource group rg-lagrange-parking. Full details and recreate-from-scratch commands: DEPLOY.md.'));
children.push(p('PowerShell (verified 2026-09-01):'));
children.push(
  ...code([
    '# Permit',
    '$TOKEN = az staticwebapp secrets list -n lagrange-parking-permit -g rg-lagrange-parking `',
    '           --query "properties.apiKey" -o tsv',
    'npx -y "@azure/static-web-apps-cli" deploy ./dist/permit --deployment-token $TOKEN --env production',
    '',
    '# Public',
    '$TOKEN = az staticwebapp secrets list -n lagrange-parking-public -g rg-lagrange-parking `',
    '           --query "properties.apiKey" -o tsv',
    'npx -y "@azure/static-web-apps-cli" deploy ./dist/public --deployment-token $TOKEN --env production',
  ])
);
children.push(h2('Step 4 — Smoke-test the live sites'));
children.push(
  ...numberedList([
    'Fetch each site\'s /profiles/*.json and confirm your edits are present',
    'Open both URLs, click through a permit page and a public lot card',
  ])
);
children.push(p('CI note: .github/workflows/deploy.yml builds both apps and uploads an artifact but does not deploy. Deploys are manual until SWA tokens are added as GitHub secrets (see DEPLOY.md).'));
children.push(pageBreak());

// ---------------------------------------------------------------- Chapter 8
children.push(banner('8. Troubleshooting'), spacer());
children.push(h1('8. Troubleshooting'));
children.push(
  infoTable(
    [
      ['Symptom', 'Cause / fix'],
      ['Both apps show no parking data; console shows {"code":499,"Token Required"}', 'The feature service was republished and sharing reset to org-only. Re-share Public in AGOL (Chapter 5 callout).'],
      ['Basemap or aerial is blank', 'Run node scripts/verify-basemaps.mjs. The GISC_IMAGERY_* mosaics 404 over La Grange even though metadata looks fine — use COUNTY_IMAGERY_COOK_2025_Project.'],
      ['All designated-space bands and notes vanished', 'The subzone service stopped answering anonymously — it fails quiet. Check the service, not the code (docs/DATA.md §3.6).'],
      ['A lot draws but its detail card is empty', 'Upstream RULETYPE mislabel — known issue, decision recorded in docs/BACKLOG.md. Not a profile bug.'],
      ['A lot is listed in areaIds but never draws', 'It fails the layer baseWhere (e.g. USERCLASS is VISITOR on the permit app). Verify with an anonymous query.'],
      ['Changed profile.branding but the app looks the same', 'Branding colors are applied only inside ParkingApp (the internal Explorer), which the live app never renders. The live look comes from hardcoded defaults in src/styles/index.css. Retargeting needs that useEffect lifted into a shared hook.'],
      ['npm run lint fails with 5 errors', 'Pre-existing on main. Only worry about NEW errors your change introduces.'],
      ['Port 5173 in use', 'Vite auto-increments the port — check the terminal banner for the actual URL.'],
    ],
    [40, 60]
  )
);
children.push(spacer());
children.push(h2('Required reading, in order'));
children.push(
  ...numberedList([
    [mono('docs/PROJECT-CONTEXT.md'), plain(' — who the client is, content rules, and the dated "Current state" block')],
    [mono('docs/DATA.md'), plain(' — the data pipeline and every known data defect the app works around')],
    [mono('docs/BACKLOG.md'), plain(' — open items and who each is blocked on')],
    [mono('CLAUDE.md'), plain(' + '), mono('DEPLOY.md'), plain(' — condensed working notes and deploy runbook')],
  ])
);

// ---- assemble --------------------------------------------------------------
const doc = new Document({
  numbering: {
    config: [
      {
        reference: 'steps',
        levels: [
          {
            level: 0,
            format: LevelFormat.DECIMAL,
            text: '%1.',
            style: { paragraph: { indent: { left: convertInchesToTwip(0.35), hanging: convertInchesToTwip(0.25) } } },
          },
        ],
      },
    ],
  },
  styles: {
    default: {
      document: { run: { font: BODY_FONT, size: 21 } },
    },
  },
  features: { updateFields: true },
  sections: [
    {
      properties: {
        page: { margin: { top: 1080, bottom: 1080, left: 1240, right: 1240 } },
      },
      footers: {
        default: new Footer({
          children: [
            new Paragraph({
              alignment: AlignmentType.CENTER,
              children: [
                new TextRun({ text: 'MGP Inc. — La Grange Parking Apps (Developer Guide) | Page ', font: BODY_FONT, size: 17, color: GRAY }),
                new TextRun({ children: [PageNumber.CURRENT], font: BODY_FONT, size: 17, color: GRAY }),
              ],
            }),
          ],
        }),
      },
      children,
    },
  ],
});

const buf = await Packer.toBuffer(doc);
const out = new URL('../docs/LaGrange-Parking-Developer-Guide.docx', import.meta.url);
writeFileSync(out, buf);
console.log('Wrote', out.pathname);
