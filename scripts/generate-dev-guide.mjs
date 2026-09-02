// Generates docs/LaGrange-Parking-Developer-Guide.docx — a visual, scannable
// Word developer guide styled after the MGP "Standard Intranet" document.
// Run: node scripts/generate-dev-guide.mjs   (regenerates the doc + keep
// screenshots in docs/guide-assets/ fresh with Playwright when the apps change)
import {
  AlignmentType, BorderStyle, Document, ExternalHyperlink, Footer, HeadingLevel, ImageRun,
  LevelFormat, Packer, PageBreak, PageNumber, Paragraph, ShadingType, Table, TableCell,
  TableOfContents, TableRow, TextRun, VerticalAlign, WidthType, convertInchesToTwip,
} from 'docx';
import { readFileSync, writeFileSync } from 'node:fs';

// ---- palette (matched to the reference document) ---------------------------
const BANNER_BLUE = '1F5C8B';
const HEADING_BLUE = '2E74B5';
const TITLE_BLUE = '1F4E79';
const CALLOUT_FILL = 'EAF3FA';
const CALLOUT_BORDER = '7FB2D9';
const CARD_HEADER = '2E74B5';
const CODE_FILL = 'F2F2F2';
const GRAY = '808080';
const GOOD_FILL = 'E2EFDA';
const GOOD_DARK = '538135';
const BAD_FILL = 'FBE4E4';
const BAD_DARK = 'C00000';

const BODY_FONT = 'Arial';
const CODE_FONT = 'Consolas';

// ---- run/paragraph helpers -------------------------------------------------
const plain = (text) => new TextRun({ text, font: BODY_FONT, size: 21 });
const bold = (text) => new TextRun({ text, font: BODY_FONT, size: 21, bold: true });
const mono = (text) => new TextRun({ text, font: CODE_FONT, size: 19 });

const p = (runs, opts = {}) =>
  new Paragraph({
    spacing: { after: 120, ...opts.spacing },
    ...opts.para,
    children: Array.isArray(runs) ? runs : [plain(runs)],
  });

const h1 = (text) => new Paragraph({ heading: HeadingLevel.HEADING_1, spacing: { before: 240, after: 120 }, children: [new TextRun({ text, font: BODY_FONT, size: 26, bold: true, color: HEADING_BLUE })] });
const h2 = (text) => new Paragraph({ heading: HeadingLevel.HEADING_2, spacing: { before: 260, after: 100 }, children: [new TextRun({ text, font: BODY_FONT, size: 23, bold: true, color: HEADING_BLUE })] });

const bullet = (runs, level = 0) =>
  new Paragraph({ bullet: { level }, spacing: { after: 60 }, children: Array.isArray(runs) ? runs : [plain(runs)] });

let numInstance = 0;
const steps = (items) => {
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
        indent: { left: convertInchesToTwip(0.2) },
        children: [new TextRun({ text: line || ' ', font: CODE_FONT, size: 19 })],
      })
  );

const caption = (text) =>
  new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: 160 },
    children: [new TextRun({ text, font: BODY_FONT, size: 18, italics: true, color: GRAY })],
  });

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
const allNone = { top: noBorder, bottom: noBorder, left: noBorder, right: noBorder };
const thin = (color) => ({ style: BorderStyle.SINGLE, size: 6, color });
const boxAll = (color) => ({ top: thin(color), bottom: thin(color), left: thin(color), right: thin(color) });

// Dark-blue chapter banner
const banner = (text) =>
  new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({
        children: [
          new TableCell({
            shading: { type: ShadingType.CLEAR, fill: BANNER_BLUE },
            borders: allNone,
            margins: { top: 160, bottom: 160, left: 240, right: 240 },
            children: [new Paragraph({ children: [new TextRun({ text, font: BODY_FONT, size: 28, bold: true, color: 'FFFFFF' })] })],
          }),
        ],
      }),
    ],
  });

// Light-blue callout box
const callout = (title, bodyChildren, fill = CALLOUT_FILL, border = CALLOUT_BORDER, titleColor = HEADING_BLUE) =>
  new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({
        children: [
          new TableCell({
            shading: { type: ShadingType.CLEAR, fill },
            borders: boxAll(border),
            margins: { top: 140, bottom: 140, left: 240, right: 240 },
            children: [
              new Paragraph({
                spacing: { after: 80 },
                children: [new TextRun({ text: title, font: BODY_FONT, size: 21, bold: true, color: titleColor })],
              }),
              ...bodyChildren,
            ],
          }),
        ],
      }),
    ],
  });

const spacer = (after = 120) => new Paragraph({ spacing: { after }, children: [] });
const pageBreak = () => new Paragraph({ children: [new PageBreak()] });

// Bordered info table; first row is the shaded header
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
                margins: { top: 70, bottom: 70, left: 120, right: 120 },
                children: [
                  new Paragraph({
                    children:
                      r === 0
                        ? [new TextRun({ text: String(cell), font: BODY_FONT, size: 20, bold: true })]
                        : Array.isArray(cell)
                          ? cell
                          : cell instanceof TextRun
                            ? [cell]
                            : [new TextRun({ text: String(cell), font: BODY_FONT, size: 20 })],
                  }),
                ],
              })
          ),
        })
    ),
  });

// 2x2 card grid — each card: colored title bar + a few short lines
const cardGrid = (cards) => {
  const cardCell = (card) =>
    new TableCell({
      width: { size: 50, type: WidthType.PERCENTAGE },
      borders: boxAll('BFBFBF'),
      margins: { top: 0, bottom: 120, left: 0, right: 0 },
      verticalAlign: VerticalAlign.TOP,
      children: [
        new Paragraph({
          shading: { type: ShadingType.CLEAR, fill: CARD_HEADER },
          spacing: { after: 80 },
          indent: { left: 120 },
          children: [new TextRun({ text: card.title, font: BODY_FONT, size: 22, bold: true, color: 'FFFFFF' })],
        }),
        ...card.lines.map(
          (l, i) =>
            new Paragraph({
              spacing: { after: i === card.lines.length - 1 ? 60 : 40 },
              indent: { left: 140, right: 100 },
              children: Array.isArray(l) ? l : [l],
            })
        ),
      ],
    });
  const rows = [];
  for (let i = 0; i < cards.length; i += 2) {
    rows.push(new TableRow({ children: [cardCell(cards[i]), cardCell(cards[i + 1])] }));
  }
  return new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, borders: allNone, rows });
};

// Recipe strip for Common Edits — File / Edit / Verify rows, shaded label column
const recipe = (rows) =>
  new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: rows.map(
      ([label, content]) =>
        new TableRow({
          children: [
            new TableCell({
              width: { size: 14, type: WidthType.PERCENTAGE },
              shading: { type: ShadingType.CLEAR, fill: 'DEEAF6' },
              margins: { top: 60, bottom: 60, left: 120, right: 120 },
              children: [new Paragraph({ children: [new TextRun({ text: label, font: BODY_FONT, size: 19, bold: true, color: TITLE_BLUE })] })],
            }),
            new TableCell({
              width: { size: 86, type: WidthType.PERCENTAGE },
              margins: { top: 60, bottom: 60, left: 120, right: 120 },
              children: [new Paragraph({ children: Array.isArray(content) ? content : [plain(content)] })],
            }),
          ],
        })
    ),
  });

// Do / Don't two-column table
const doDont = (dos, donts) => {
  const col = (title, items, fill, dark, mark) =>
    new TableCell({
      width: { size: 50, type: WidthType.PERCENTAGE },
      borders: boxAll(dark),
      margins: { top: 100, bottom: 100, left: 160, right: 160 },
      shading: { type: ShadingType.CLEAR, fill },
      children: [
        new Paragraph({
          spacing: { after: 100 },
          children: [new TextRun({ text: `${mark}  ${title}`, font: BODY_FONT, size: 23, bold: true, color: dark })],
        }),
        ...items.map((t) =>
          new Paragraph({
            spacing: { after: 70 },
            children: [new TextRun({ text: `${mark} `, font: BODY_FONT, size: 20, bold: true, color: dark }), ...(Array.isArray(t) ? t : [new TextRun({ text: t, font: BODY_FONT, size: 20 })])],
          })
        ),
      ],
    });
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: allNone,
    rows: [new TableRow({ children: [col('DO', dos, GOOD_FILL, GOOD_DARK, '\u2713'), col("DON'T", donts, BAD_FILL, BAD_DARK, '\u2717')] })],
  });
};

// ---- document --------------------------------------------------------------
const children = [];

// Cover
children.push(
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
    children: [new TextRun({ text: 'What the two parking maps are, where every piece of content lives, and how to edit, verify, and deploy safely.', font: BODY_FONT, size: 21, color: '404040' })],
  }),
  new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 80 }, children: [link('Permit app — mango-cliff-087d26410.7.azurestaticapps.net', 'https://mango-cliff-087d26410.7.azurestaticapps.net')] }),
  new Paragraph({ alignment: AlignmentType.CENTER, children: [link('Public app — ashy-mud-0b906db10.7.azurestaticapps.net', 'https://ashy-mud-0b906db10.7.azurestaticapps.net')] }),
  pageBreak()
);

// TOC
children.push(
  new Paragraph({ spacing: { after: 120 }, children: [new TextRun({ text: 'Table of Contents', font: BODY_FONT, size: 26, bold: true, color: HEADING_BLUE })] }),
  new TableOfContents('Table of Contents', { hyperlink: true, headingStyleRange: '1-2' }),
  new Paragraph({ spacing: { before: 200 }, children: [new TextRun({ text: 'If page numbers are missing, right-click the table and choose "Update Field".', font: BODY_FONT, size: 18, italics: true, color: GRAY })] }),
  pageBreak()
);

// ------------------------------------------------------------ Quick Reference
children.push(banner('Quick Reference — 90% of the job on one page'), spacer());
children.push(h1('Quick Reference'));
children.push(
  cardGrid([
    {
      title: '▶  Run it locally',
      lines: [
        [mono('npm install')],
        [mono('npm run dev'), plain('   → permit app')],
        [mono('npm run dev:public'), plain('   → public app')],
        [plain('No .env needed — a fresh clone just runs.')],
      ],
    },
    {
      title: '✎  Edit content',
      lines: [
        [plain('Nearly everything is JSON, not code:')],
        [mono('public/profiles/lagrange-permit.json')],
        [mono('public/profiles/lagrange-public.json')],
        [plain('Property reference: '), mono('src/config/types.ts')],
      ],
    },
    {
      title: '✓  Verify',
      lines: [
        [mono('node scripts/verify-permit-pages.mjs')],
        [mono('node scripts/verify-basemaps.mjs')],
        [plain('Then click through the pages you touched.')],
      ],
    },
    {
      title: '⇪  Deploy',
      lines: [
        [mono('npm run build')],
        [mono('git push origin master:main'), plain('  ← not plain push!')],
        [plain('SWA deploy — see Chapter 7.')],
      ],
    },
  ]),
  spacer()
);
children.push(
  doDont(
    [
      [plain('Edit profiles ('), mono('*.json'), plain(') for content changes')],
      [plain('Keep '), bold('tab.areaIds'), plain(' exactly as the Village lists lots')],
      [plain('Read '), mono('docs/BACKLOG.md'), plain(' before "fixing" a bug')],
      [plain('Run the verify scripts before showing the Village')],
    ],
    [
      'Show pricing anywhere (RATE_TEXT exists — never surface it)',
      'Use the word "decal" in user-visible text',
      'Hardcode field names, lot ids, or copy in components',
      'Add a landing page / layout chooser (removed on purpose)',
    ]
  )
);
children.push(pageBreak());

// ---------------------------------------------------------------- Chapter 1
children.push(banner('1. The Two Apps'), spacer());
children.push(h1('1. The Two Apps'));
children.push(p('One codebase, two static apps — no server, no login. What is deployed is the reference for "how it should look": keep a live site open next to your dev server.'));
children.push(
  infoTable(
    [
      ['App', 'Who it serves', 'Runs with', 'Live site'],
      ['Permit', '4 permit-type pages', [mono('npm run dev')], [link('mango-cliff-087d26410…', 'https://mango-cliff-087d26410.7.azurestaticapps.net')]],
      ['Public', 'Visitors — time-based parking', [mono('npm run dev:public')], [link('ashy-mud-0b906db10…', 'https://ashy-mud-0b906db10.7.azurestaticapps.net')]],
    ],
    [12, 32, 26, 30]
  ),
  spacer()
);
children.push(...screenshot('permit-picker.png', 'The permit app — the visitor picks a permit type, then sees only that page\u2019s lots and rules (the "Guided Finder").'));
children.push(...screenshot('public-overview.png', 'The public app — legend categories, consolidated on-street row, and the lot list.'));
children.push(
  bullet([bold('Stack: '), plain('React 19 · TypeScript · Vite 7 · ArcGIS JS SDK v5 — hooks only, no state library')]),
  bullet([bold('Everything is profile-driven: '), plain('layer URLs, tabs, lots, rules, all sidebar text, colors — in '), mono('public/profiles/'), plain(' JSON')]),
  bullet([bold('Hidden layouts: '), mono('#/explorer'), plain(' and '), mono('#/directory'), plain(' exist for internal comparison only — nothing links to them')]),
  bullet([bold('Stale copy: '), plain('the nested '), mono('lagrange-parking/'), plain(' folder is an old duplicate — never touch it')])
);
children.push(spacer(60));
children.push(
  infoTable(
    [
      ['Read this…', '…when you need'],
      [[mono('docs/PROJECT-CONTEXT.md')], 'Who the client is, content rules, dated "Current state" block'],
      [[mono('docs/DATA.md')], 'Data pipeline + every known data defect the app works around'],
      [[mono('docs/BACKLOG.md')], 'Open items — check before changing behaviour'],
      [[mono('CLAUDE.md'), plain('  ·  '), mono('DEPLOY.md')], 'Condensed working notes · deploy runbook'],
    ],
    [35, 65]
  )
);
children.push(pageBreak());

// ---------------------------------------------------------------- Chapter 2
children.push(banner('2. Content Rules — Non-Negotiable'), spacer());
children.push(h1('2. Content Rules — Non-Negotiable'));
children.push(p('From the Village stakeholder (Charity). Easy to violate by accident — check every change against this table.'));
children.push(
  doDont(
    [
      'Plain-language guidance: "where you may park"',
      [plain('Treat '), bold('tab.areaIds'), plain(' as the Village\u2019s verbatim, binding lot list')],
      'Keep per-lot cards minimal — the sidebar "What you need to know" is the star',
      'Get stakeholder sign-off before adding attribute rows back',
    ],
    [
      'Pricing — RATE_TEXT / RATE_MONTHLY are populated but banned',
      '"Decal" — survives only as internal RULETYPE codes',
      'Ordinance / legalese text',
      'Data-derived lot lists replacing the Village\u2019s list',
    ]
  ),
  spacer()
);
children.push(callout('Several "bugs" are decisions, not bugs', [
  p([plain('Lots with empty detail cards, 5 lint errors on main, odd RULETYPE values — all known, with decisions recorded in '), mono('docs/BACKLOG.md'), plain('. Read it before changing behaviour.')]),
]));
children.push(pageBreak());

// ---------------------------------------------------------------- Chapter 3
children.push(banner('3. Common Edits — Recipes'), spacer());
children.push(h1('3. Common Edits — Recipes'));
children.push(p([plain('Every recipe is a JSON edit — no component changes. Dev: save + hard-reload. Production: deploy (Chapter 7). Property reference: '), mono('src/config/types.ts'), plain('.')]));

children.push(h2('3.1 — Change sidebar text on a permit page'));
children.push(
  recipe([
    ['File', [mono('lagrange-permit.json')]],
    ['Edit', [plain('Find the tab by '), mono('id'), plain(' → edit '), mono('guide.sections'), plain(' bullets (support nested '), mono('items'), plain(' + '), mono('links'), plain(')')]],
    ['Verify', 'Hard-reload, read the page'],
  ]),
  caption('Example: adding "Effective October 1st, …" to two resident bullets was a one-line edit each.')
);

children.push(h2('3.2 — Add / remove a lot on a permit page'));
children.push(
  recipe([
    ['File', [mono('lagrange-permit.json'), plain('  →  the tab\u2019s '), mono('areaIds'), plain(' array')]],
    ['Also', 'Update guide text if it names lots ("valid anywhere within Lot 2 and Lot 4")'],
    ['Verify', [mono('node scripts/verify-permit-pages.mjs'), plain(' — every id must resolve')]],
  ]),
  spacer(60),
  callout('The lot must also pass the layer baseWhere', [
    p([plain('Permit app filter: '), mono("USERCLASS = 'PERMIT'"), plain('. A VISITOR-class lot will be listed but never draw — check with an anonymous query first (Chapter 4).')]),
  ]),
  spacer()
);

children.push(h2('3.3 — Rename a lot / add a note'));
children.push(
  recipe([
    ['Rename', [mono('profile.nameOverrides'), plain(' keyed by AREAID — e.g. '), mono('"VILLAGEHALLPARKINGSTRUCTURE": "VH Garage"')]],
    ['Note', [mono('tab.note'), plain(' (every card) · '), mono('tab.lotNotes'), plain(' (per lot) · '), mono('tab.lotSubzoneNotes'), plain(' (green callout style)')]],
  ])
);

children.push(h2('3.4 — Designated spaces inside a lot'));
children.push(p('Two mechanisms — same lot can use either, per page:'));
children.push(
  infoTable(
    [
      ['Mechanism', 'What it draws', 'Turned on by'],
      [[bold('Subzones')], 'Resident overnight bands (hosted subzone layer)', [mono('tab.showSubzones: true')]],
      [[bold('Overlay layers')], 'Any filtered polygon (e.g. Lot 5 CBD employee rows)', [mono('overlayLayers[]'), plain(' + '), mono('showForAreaId'), plain(' + '), mono('showForTabIds')]],
    ],
    [20, 45, 35]
  ),
  spacer(60)
);
children.push(...screenshot('resident-lot5-subzones.png', 'Same lot, page 1: Resident Overnight — green subzone bands mark the only spaces valid overnight.'));
children.push(...screenshot('employees-lot5-overlay.png', 'Same lot, page 2: Employees — the CBD rows overlay draws instead (showForTabIds: ["employees"]).'));
children.push(
  callout('Absence of green is ambiguous — and it fails quiet', [
    bullet('Only permitted areas were digitized: "no bands" can mean "not permitted" or "not drawn yet" (VH Garage, Lot 15)'),
    bullet('The "park only in the highlighted areas" sentence must stay gated by useSubzoneAreaIds — never show it unconditionally'),
    bullet('If the subzone service stops answering anonymously, every band and note silently disappears (docs/DATA.md §3.6)'),
  ])
);
children.push(spacer());

children.push(h2('3.5 — Public map "Availability / Time limit" text'));
children.push(
  recipe([
    ['File', [mono('lagrange-public.json'), plain('  →  '), mono('areaInfo'), plain(' (per-AREAID overrides — NOT the GIS rules)')]],
    ['Edit', [plain('Change the '), mono('timeLimit'), plain(' / '), mono('availability'), plain(' strings')]],
    ['Flag', 'Check whether the hosted ParkingRule table needs the same change'],
  ])
);
children.push(...screenshot('public-vh-surface-lot.png', 'Village Hall Surface Lot — these two lines come from profile.areaInfo (e.g. the 3 hr → 4 hr fix, Sept 2026).'));
children.push(pageBreak());

// ---------------------------------------------------------------- Chapter 4
children.push(banner('4. The Data'), spacer());
children.push(h1('4. The Data'));
children.push(p('Both apps read public ArcGIS Online services anonymously. Full model + defects: docs/DATA.md.'));
children.push(
  infoTable(
    [
      ['Service (services2.arcgis.com/FwavjPsU0K1YB1vX)', 'Contains'],
      [[mono('LaGrange_Parking_Permits/FeatureServer/2')], 'ParkingArea polygons — AREAID, AREANAME, USERCLASS, HAS* flags'],
      [[mono('LaGrange_Parking_Permits/FeatureServer/3')], 'ParkingRule table — RULETYPE, ENFORCE_TEXT, MAXDURATION'],
      [[mono('LaGrange_Overnight_Resident_Subzones/…/0')], 'Designated overnight bands (YES-only digitization)'],
      [[mono('LaGrangeImportantPlaces_ParkingContext_/…/0')], 'Reference polygons — parks, civic, Metra'],
    ],
    [50, 50]
  ),
  spacer()
);
children.push(
  callout('⚠ Republishing the service breaks both apps — every time', [
    p('Republishing resets AGOL sharing to org-only → both apps fail with {"code":499, "Token Required"}. After ANY republish: re-share Public, then confirm an untokened query returns a count:'),
    ...code(['…/FeatureServer/2/query?where=1=1&returnCountOnly=true&f=json']),
  ], 'FBE4E4', BAD_DARK, BAD_DARK)
);
children.push(spacer());
children.push(h2('Check the data before you edit a profile'));
children.push(...code([
  "node -e 'fetch(\"https://services2.arcgis.com/FwavjPsU0K1YB1vX/arcgis/rest/services/\" +",
  "  \"LaGrange_Parking_Permits/FeatureServer/2/query?where=AREAID=%27LOT4%27\" +",
  "  \"&outFields=AREAID,USERCLASS,HASCBD&returnGeometry=false&f=json\")",
  "  .then(r=>r.json()).then(j=>console.log(JSON.stringify(j.features)))'",
]));
children.push(pageBreak());

// ---------------------------------------------------------------- Chapter 5
children.push(banner('5. Verify Before You Show Anyone'), spacer());
children.push(h1('5. Verify Before You Show Anyone'));
children.push(
  infoTable(
    [
      ['Command', 'Proves'],
      [[mono('node scripts/verify-permit-pages.mjs')], 'Every lot on every permit page resolves + returns rules (NO RULES warnings = known upstream mislabels)'],
      [[mono('node scripts/verify-basemaps.mjs')], 'Each basemap serves a real tile over La Grange (metadata alone lies)'],
      [[mono('node scripts/inspect-service.mjs')], 'Schema + value distributions'],
      [[mono('npm run lint')], 'Only NEW errors matter — 5 are pre-existing on main'],
    ],
    [42, 58]
  ),
  spacer()
);
children.push(h2('2-minute browser pass'));
children.push(
  ...steps([
    'Permit app — open all four pages, click one lot on each',
    'Lot 5 twice: Resident Overnight → green bands · Employees → CBD rows overlay',
    'Public app — click 2–3 lots, sanity-check Availability / Time limit',
  ])
);
children.push(
  callout('Expected noise — ignore', [
    bullet('Esri console deprecation warnings (Home/Locate widgets, Polygon.centroid)'),
    bullet('NO RULES on Lot 13 (commuter) and Lot 2 / VH Garage (employees) — upstream; those pages hide rules anyway'),
  ])
);
children.push(pageBreak());

// ---------------------------------------------------------------- Chapter 6
children.push(banner('6. Ship It'), spacer());
children.push(h1('6. Ship It'));
children.push(
  ...steps([
    [bold('Build:  '), mono('npm run build'), plain('   → dist/permit + dist/public')],
    [bold('Push:  '), mono('git push origin master:main')],
    [bold('Deploy both SWAs'), plain(' (PowerShell, verified 2026-09-01):')],
  ])
);
children.push(...code([
  '$TOKEN = az staticwebapp secrets list -n lagrange-parking-permit -g rg-lagrange-parking `',
  '           --query "properties.apiKey" -o tsv',
  'npx -y "@azure/static-web-apps-cli" deploy ./dist/permit --deployment-token $TOKEN --env production',
  '',
  '$TOKEN = az staticwebapp secrets list -n lagrange-parking-public -g rg-lagrange-parking `',
  '           --query "properties.apiKey" -o tsv',
  'npx -y "@azure/static-web-apps-cli" deploy ./dist/public --deployment-token $TOKEN --env production',
]));
children.push(
  ...steps([
    [bold('Smoke test:  '), plain('fetch each site\u2019s '), mono('/profiles/*.json'), plain(' and confirm your edits are live, then click through once')],
  ])
);
children.push(
  callout('Branch gotcha', [
    p([plain('Local branch is '), mono('master'), plain('; GitHub default is '), mono('main'), plain('. A plain '), mono('git push'), plain(' creates a stray remote branch — always '), mono('master:main'), plain('.')]),
  ]),
  spacer(60)
);
children.push(p([plain('Azure: tenant '), bold('Spark by MGP'), plain(' · subscription '), bold('Microsoft Azure Sponsorship'), plain(' · resource group '), mono('rg-lagrange-parking'), plain('. Recreate-from-scratch commands: '), mono('DEPLOY.md'), plain('. CI builds but does not deploy.')]));
children.push(pageBreak());

// ---------------------------------------------------------------- Chapter 7
children.push(banner('7. When Something Looks Broken'), spacer());
children.push(h1('7. When Something Looks Broken'));
children.push(
  infoTable(
    [
      ['Symptom', 'Cause → fix'],
      ['No parking data, console shows {"code":499}', 'Service was republished; sharing reset → re-share Public in AGOL (Ch. 4)'],
      ['Basemap / aerial blank', [mono('verify-basemaps.mjs'), plain('. GISC_IMAGERY_* 404s over La Grange — use COUNTY_IMAGERY_COOK_2025_Project')]],
      ['All green bands + notes vanished', 'Subzone service stopped answering anonymously — fails quiet (DATA.md §3.6)'],
      ['Lot draws, card is empty', 'Upstream RULETYPE mislabel — known, see BACKLOG.md'],
      ['Lot in areaIds never draws', [plain('Fails '), mono('baseWhere'), plain(' (e.g. USERCLASS=VISITOR on permit app) — query it')]],
      ['profile.branding change does nothing', 'Branding applies only inside the internal Explorer; live look = hardcoded CSS defaults'],
      ['5 lint errors', 'Pre-existing — only chase NEW ones'],
    ],
    [38, 62]
  )
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
  styles: { default: { document: { run: { font: BODY_FONT, size: 21 } } } },
  features: { updateFields: true },
  sections: [
    {
      properties: { page: { margin: { top: 1080, bottom: 1080, left: 1240, right: 1240 } } },
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
