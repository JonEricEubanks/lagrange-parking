// Generates docs/LaGrange-Parking-Developer-Guide.docx — a visual, color-coded
// Word developer guide styled after (and elevating) the MGP "Standard Intranet" doc.
// Run: node scripts/generate-dev-guide.mjs
import {
  AlignmentType, BorderStyle, Document, ExternalHyperlink, Footer, HeadingLevel, ImageRun,
  LevelFormat, Packer, PageBreak, PageNumber, Paragraph, ShadingType, Table, TableCell,
  TableOfContents, TableRow, TextRun, VerticalAlign, WidthType, convertInchesToTwip,
} from 'docx';
import { readFileSync, writeFileSync } from 'node:fs';

// ---- design system ----------------------------------------------------------
const BODY_FONT = 'Arial';
const CODE_FONT = 'Consolas';

const INK = '2B2B2B';
const GRAY = '808080';
const TITLE_BLUE = '1F4E79';
const HEADING_BLUE = '2E74B5';
const CODE_FILL = 'F4F4F4';
const ZEBRA = 'F2F7FB';
const FRAME = 'C9C9C9';

const GOOD_FILL = 'E2EFDA', GOOD_DARK = '538135';
const BAD_FILL = 'FBE4E4', BAD_DARK = 'C00000';
const WARN_FILL = 'FFF3DC', WARN_DARK = 'B45309';
const INFO_FILL = 'EAF3FA', INFO_BORDER = '7FB2D9';

// One accent per chapter — banner tab, heading color, and table headers follow it.
const CH = {
  qr:    { num: '★', title: 'Quick Reference — 90% of the job on one page', accent: '1F5C8B', dark: '143E5E' },
  apps:  { num: '1', title: 'The Two Apps',                                 accent: '0B7285', dark: '074E5B' },
  rules: { num: '2', title: 'Content Rules — Non-Negotiable',               accent: 'A62639', dark: '731A27' },
  edits: { num: '3', title: 'Common Edits — Recipes',                       accent: '2F7D32', dark: '1F5421' },
  data:  { num: '4', title: 'The Data',                                     accent: '5B4B9E', dark: '3E3370' },
  verify:{ num: '5', title: 'Verify Before You Show Anyone',                accent: 'B45309', dark: '7C3A06' },
  ship:  { num: '6', title: 'Ship It',                                      accent: '1F5C8B', dark: '143E5E' },
  fix:   { num: '7', title: 'When Something Looks Broken',                  accent: '475569', dark: '2F3A47' },
  gis:   { num: '8', title: 'GIS Analyst Documentation',                    accent: '0E7C66', dark: '095443' },
};

// ---- low-level helpers -------------------------------------------------------
const plain = (text) => new TextRun({ text, font: BODY_FONT, size: 21, color: INK });
const bold = (text) => new TextRun({ text, font: BODY_FONT, size: 21, bold: true, color: INK });
const mono = (text) => new TextRun({ text, font: CODE_FONT, size: 19, color: INK });

const p = (runs, opts = {}) =>
  new Paragraph({
    spacing: { after: 120, ...opts.spacing },
    ...opts.para,
    children: Array.isArray(runs) ? runs : [plain(runs)],
  });

const h1 = (text, color = HEADING_BLUE) =>
  new Paragraph({ heading: HeadingLevel.HEADING_1, spacing: { before: 200, after: 120 }, children: [new TextRun({ text, font: BODY_FONT, size: 26, bold: true, color })] });
const h2 = (text, color = HEADING_BLUE) =>
  new Paragraph({ heading: HeadingLevel.HEADING_2, spacing: { before: 280, after: 100 }, children: [new TextRun({ text, font: BODY_FONT, size: 23, bold: true, color })] });

const bullet = (runs) =>
  new Paragraph({ bullet: { level: 0 }, spacing: { after: 60 }, children: Array.isArray(runs) ? runs : [plain(runs)] });

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
    spacing: { after: 180 },
    children: [new TextRun({ text, font: BODY_FONT, size: 18, italics: true, color: GRAY })],
  });

const link = (text, url, size = 21) =>
  new ExternalHyperlink({
    link: url,
    children: [new TextRun({ text, font: BODY_FONT, size, color: HEADING_BLUE, underline: {} })],
  });

const noBorder = { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' };
const allNone = { top: noBorder, bottom: noBorder, left: noBorder, right: noBorder };
const thin = (color, size = 6) => ({ style: BorderStyle.SINGLE, size, color });
const boxAll = (color, size = 6) => ({ top: thin(color, size), bottom: thin(color, size), left: thin(color, size), right: thin(color, size) });

const spacer = (after = 120) => new Paragraph({ spacing: { after }, children: [] });
const pageBreak = () => new Paragraph({ children: [new PageBreak()] });

// ---- signature components ----------------------------------------------------
// Chapter banner: dark number tab + accent title bar
const banner = (ch) =>
  new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({
        children: [
          new TableCell({
            width: { size: 9, type: WidthType.PERCENTAGE },
            shading: { type: ShadingType.CLEAR, fill: ch.dark },
            borders: allNone,
            verticalAlign: VerticalAlign.CENTER,
            margins: { top: 120, bottom: 120, left: 60, right: 60 },
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [new TextRun({ text: ch.num, font: BODY_FONT, size: 40, bold: true, color: 'FFFFFF' })],
              }),
            ],
          }),
          new TableCell({
            width: { size: 91, type: WidthType.PERCENTAGE },
            shading: { type: ShadingType.CLEAR, fill: ch.accent },
            borders: allNone,
            verticalAlign: VerticalAlign.CENTER,
            margins: { top: 160, bottom: 160, left: 240, right: 240 },
            children: [new Paragraph({ children: [new TextRun({ text: ch.title, font: BODY_FONT, size: 28, bold: true, color: 'FFFFFF' })] })],
          }),
        ],
      }),
    ],
  });

// Callout box (info by default; pass warn/danger palettes)
const callout = (title, bodyChildren, fill = INFO_FILL, border = INFO_BORDER, titleColor = HEADING_BLUE, icon = 'ℹ') =>
  new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({
        children: [
          new TableCell({
            shading: { type: ShadingType.CLEAR, fill },
            borders: { top: thin(border), bottom: thin(border), right: thin(border), left: thin(border, 24) },
            margins: { top: 140, bottom: 140, left: 240, right: 240 },
            children: [
              new Paragraph({
                spacing: { after: 80 },
                children: [new TextRun({ text: `${icon}  ${title}`, font: BODY_FONT, size: 21, bold: true, color: titleColor })],
              }),
              ...bodyChildren,
            ],
          }),
        ],
      }),
    ],
  });
const warnCallout = (title, body) => callout(title, body, WARN_FILL, WARN_DARK, WARN_DARK, '⚠');
const dangerCallout = (title, body) => callout(title, body, BAD_FILL, BAD_DARK, BAD_DARK, '⛔');

// Zebra info table with accent header row
const infoTable = (rows, widths, accent = HEADING_BLUE) =>
  new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: rows.map(
      (cells, r) =>
        new TableRow({
          children: cells.map(
            (cell, c) =>
              new TableCell({
                width: widths ? { size: widths[c], type: WidthType.PERCENTAGE } : undefined,
                shading:
                  r === 0
                    ? { type: ShadingType.CLEAR, fill: accent }
                    : r % 2 === 0
                      ? { type: ShadingType.CLEAR, fill: ZEBRA }
                      : undefined,
                borders: boxAll('D9D9D9', 4),
                margins: { top: 80, bottom: 80, left: 120, right: 120 },
                children: [
                  new Paragraph({
                    children:
                      r === 0
                        ? [new TextRun({ text: String(cell), font: BODY_FONT, size: 20, bold: true, color: 'FFFFFF' })]
                        : Array.isArray(cell)
                          ? cell
                          : cell instanceof TextRun
                            ? [cell]
                            : [new TextRun({ text: String(cell), font: BODY_FONT, size: 20, color: INK })],
                  }),
                ],
              })
          ),
        })
    ),
  });

// 2x2 quick-reference card grid, each card with its own accent
const cardGrid = (cards) => {
  const cardCell = (card) =>
    new TableCell({
      width: { size: 50, type: WidthType.PERCENTAGE },
      borders: boxAll(card.accent),
      margins: { top: 0, bottom: 120, left: 0, right: 0 },
      verticalAlign: VerticalAlign.TOP,
      children: [
        new Paragraph({
          shading: { type: ShadingType.CLEAR, fill: card.accent },
          spacing: { after: 90 },
          indent: { left: 120 },
          children: [new TextRun({ text: `${card.icon}  ${card.title}`, font: BODY_FONT, size: 22, bold: true, color: 'FFFFFF' })],
        }),
        ...card.lines.map(
          (l, i) =>
            new Paragraph({
              spacing: { after: i === card.lines.length - 1 ? 70 : 45 },
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

// Stat strip — big colored numbers over small gray labels
const statStrip = (stats) =>
  new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: allNone,
    rows: [
      new TableRow({
        children: stats.map(
          (s) =>
            new TableCell({
              width: { size: 100 / stats.length, type: WidthType.PERCENTAGE },
              borders: { ...allNone, right: stats.indexOf(s) < stats.length - 1 ? thin('E0E0E0', 4) : noBorder },
              margins: { top: 100, bottom: 100, left: 60, right: 60 },
              children: [
                new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 20 }, children: [new TextRun({ text: s.n, font: BODY_FONT, size: 44, bold: true, color: s.color })] }),
                new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: s.label, font: BODY_FONT, size: 18, color: GRAY })] }),
              ],
            })
        ),
      }),
    ],
  });

// Horizontal pipeline flow: colored step chips joined by arrows
const flow = (items) => {
  const cells = [];
  items.forEach((it, i) => {
    cells.push(
      new TableCell({
        shading: { type: ShadingType.CLEAR, fill: it.color },
        borders: allNone,
        verticalAlign: VerticalAlign.CENTER,
        margins: { top: 110, bottom: 110, left: 60, right: 60 },
        children: [
          new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 10 }, children: [new TextRun({ text: it.step, font: BODY_FONT, size: 22, bold: true, color: 'FFFFFF' })] }),
          new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: it.sub, font: it.monoSub ? CODE_FONT : BODY_FONT, size: 16, color: 'FFFFFF' })] }),
        ],
      })
    );
    if (i < items.length - 1) {
      cells.push(
        new TableCell({
          width: { size: 4, type: WidthType.PERCENTAGE },
          borders: allNone,
          verticalAlign: VerticalAlign.CENTER,
          children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: '→', font: BODY_FONT, size: 30, bold: true, color: GRAY })] })],
        })
      );
    }
  });
  return new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, borders: allNone, rows: [new TableRow({ children: cells })] });
};

// Architecture diagram built from shaded boxes and arrows
const archBox = (fill, title, sub, width) =>
  new TableCell({
    width: { size: width, type: WidthType.PERCENTAGE },
    shading: { type: ShadingType.CLEAR, fill },
    borders: allNone,
    verticalAlign: VerticalAlign.CENTER,
    margins: { top: 120, bottom: 120, left: 100, right: 100 },
    children: [
      new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 30 }, children: [new TextRun({ text: title, font: BODY_FONT, size: 22, bold: true, color: 'FFFFFF' })] }),
      new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: sub, font: BODY_FONT, size: 16, color: 'FFFFFF' })] }),
    ],
  });
const archArrow = (glyph = '→', w = 5) =>
  new TableCell({
    width: { size: w, type: WidthType.PERCENTAGE },
    borders: allNone,
    verticalAlign: VerticalAlign.CENTER,
    children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: glyph, font: BODY_FONT, size: 30, bold: true, color: GRAY })] })],
  });
const archEmpty = (w) => new TableCell({ width: { size: w, type: WidthType.PERCENTAGE }, borders: allNone, children: [new Paragraph({ children: [] })] });

const architecture = () =>
  new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: allNone,
    rows: [
      new TableRow({
        children: [
          archBox('5B4B9E', 'Profiles (JSON)', 'public/profiles/* — ALL content: tabs, lots, text, colors', 30),
          archArrow(),
          archBox('0B7285', 'Two React apps', 'Guided Finder (permit) · Explorer (public) — static SPAs', 30),
          archArrow(),
          archBox('1F5C8B', 'ArcGIS Online', 'hosted feature services — anonymous, read-only', 30),
        ],
      }),
      new TableRow({
        children: [
          archEmpty(30),
          archEmpty(5),
          archArrow('↓', 30),
          archEmpty(5),
          archEmpty(30),
        ],
      }),
      new TableRow({
        children: [
          archEmpty(30),
          archEmpty(5),
          archBox('475569', 'Azure Static Web Apps', 'Free plan · one resource per app · manual deploy', 30),
          archEmpty(5),
          archEmpty(30),
        ],
      }),
    ],
  });

// Framed screenshot (thin border) + caption
const screenshot = (file, captionText, widthIn = 6.1) => {
  const w = Math.round(widthIn * 96);
  const h = Math.round(w * (800 / 1280));
  return [
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      alignment: AlignmentType.CENTER,
      borders: allNone,
      rows: [
        new TableRow({
          children: [
            new TableCell({
              borders: boxAll(FRAME, 4),
              margins: { top: 60, bottom: 60, left: 60, right: 60 },
              children: [
                new Paragraph({
                  alignment: AlignmentType.CENTER,
                  children: [
                    new ImageRun({
                      type: 'png',
                      data: readFileSync(new URL(`../docs/guide-assets/${file}`, import.meta.url)),
                      transformation: { width: w, height: h },
                    }),
                  ],
                }),
              ],
            }),
          ],
        }),
      ],
    }),
    spacer(40),
    caption(captionText),
  ];
};

// Recipe strip — accent label column
const recipe = (rows, accent = '2F7D32') =>
  new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: rows.map(
      ([label, content], r) =>
        new TableRow({
          children: [
            new TableCell({
              width: { size: 14, type: WidthType.PERCENTAGE },
              shading: { type: ShadingType.CLEAR, fill: accent },
              borders: boxAll('D9D9D9', 4),
              margins: { top: 70, bottom: 70, left: 120, right: 120 },
              children: [new Paragraph({ children: [new TextRun({ text: label, font: BODY_FONT, size: 19, bold: true, color: 'FFFFFF' })] })],
            }),
            new TableCell({
              width: { size: 86, type: WidthType.PERCENTAGE },
              shading: r % 2 === 1 ? { type: ShadingType.CLEAR, fill: ZEBRA } : undefined,
              borders: boxAll('D9D9D9', 4),
              margins: { top: 70, bottom: 70, left: 120, right: 120 },
              children: [new Paragraph({ children: Array.isArray(content) ? content : [plain(content)] })],
            }),
          ],
        })
    ),
  });

// Do / Don't
const doDont = (dos, donts) => {
  const col = (title, items, fill, dark, mark) =>
    new TableCell({
      width: { size: 50, type: WidthType.PERCENTAGE },
      borders: { top: thin(dark, 24), bottom: thin(dark), left: thin(dark), right: thin(dark) },
      margins: { top: 100, bottom: 100, left: 160, right: 160 },
      shading: { type: ShadingType.CLEAR, fill },
      children: [
        new Paragraph({ spacing: { after: 100 }, children: [new TextRun({ text: `${mark}  ${title}`, font: BODY_FONT, size: 23, bold: true, color: dark })] }),
        ...items.map((t) =>
          new Paragraph({
            spacing: { after: 70 },
            children: [new TextRun({ text: `${mark} `, font: BODY_FONT, size: 20, bold: true, color: dark }), ...(Array.isArray(t) ? t : [new TextRun({ text: t, font: BODY_FONT, size: 20, color: INK })])],
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

// Full-width accent bar (cover)
const accentBar = (fill, height = 60) =>
  new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: allNone,
    rows: [
      new TableRow({
        children: [
          new TableCell({
            shading: { type: ShadingType.CLEAR, fill },
            borders: allNone,
            margins: { top: height, bottom: height, left: 0, right: 0 },
            children: [new Paragraph({ children: [] })],
          }),
        ],
      }),
    ],
  });

// Fill-in table: header row + n blank rows for the GIS analyst to complete
const fillTable = (headers, blankRows, widths, accent) =>
  infoTable(
    [headers, ...Array.from({ length: blankRows }, () => headers.map(() => ' '))],
    widths,
    accent
  );

// ---- document ---------------------------------------------------------------
const children = [];

// Cover
children.push(
  accentBar('1F5C8B', 40),
  spacer(20),
  accentBar('0B7285', 14),
  new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 1400, after: 160 },
    children: [new TextRun({ text: 'MGP Inc. — GIS & Web Applications', font: BODY_FONT, size: 24, bold: true, color: '404040' })],
  }),
  new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: 140 },
    children: [new TextRun({ text: 'La Grange Parking Apps', font: BODY_FONT, size: 56, bold: true, color: TITLE_BLUE })],
  }),
  new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: 320 },
    children: [new TextRun({ text: 'DEVELOPER GUIDE', font: BODY_FONT, size: 26, bold: true, color: '0B7285', characterSpacing: 60 })],
  }),
  ...screenshot('permit-picker.png', '', 5.4).slice(0, 1),
  spacer(160),
  new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: 220 },
    children: [new TextRun({ text: 'What the two parking maps are, where every piece of content lives, and how to edit, verify, and deploy safely.', font: BODY_FONT, size: 21, color: '404040' })],
  }),
  new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 70 }, children: [link('Permit app — mango-cliff-087d26410.7.azurestaticapps.net', 'https://mango-cliff-087d26410.7.azurestaticapps.net', 20)] }),
  new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 220 }, children: [link('Public app — ashy-mud-0b906db10.7.azurestaticapps.net', 'https://ashy-mud-0b906db10.7.azurestaticapps.net', 20)] }),
  new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'September 2026 · regenerated by scripts/generate-dev-guide.mjs', font: BODY_FONT, size: 17, italics: true, color: GRAY })] }),
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
children.push(banner(CH.qr), spacer());
children.push(h1('Quick Reference', CH.qr.accent));
children.push(
  cardGrid([
    {
      icon: '▶', title: 'Run it locally', accent: '0B7285',
      lines: [
        [mono('npm install')],
        [mono('npm run dev'), plain('   → permit app')],
        [mono('npm run dev:public'), plain('   → public app')],
        [plain('No .env needed — a fresh clone just runs.')],
      ],
    },
    {
      icon: '✎', title: 'Edit content', accent: '5B4B9E',
      lines: [
        [plain('Nearly everything is JSON, not code:')],
        [mono('public/profiles/lagrange-permit.json')],
        [mono('public/profiles/lagrange-public.json')],
        [plain('Property reference: '), mono('src/config/types.ts')],
      ],
    },
    {
      icon: '✓', title: 'Verify', accent: '2F7D32',
      lines: [
        [mono('node scripts/verify-permit-pages.mjs')],
        [mono('node scripts/verify-basemaps.mjs')],
        [plain('Then click through the pages you touched.')],
      ],
    },
    {
      icon: '⇪', title: 'Deploy', accent: 'B45309',
      lines: [
        [mono('npm run build')],
        [mono('git push origin master:main'), plain('  ← not plain push!')],
        [plain('SWA deploy — see Chapter 6.')],
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
children.push(banner(CH.apps), spacer());
children.push(h1('1. The Two Apps', CH.apps.accent));
children.push(
  statStrip([
    { n: '1', label: 'codebase', color: CH.apps.accent },
    { n: '2', label: 'static apps', color: CH.apps.accent },
    { n: '4', label: 'permit pages', color: CH.apps.accent },
    { n: '0', label: 'servers · logins · databases', color: CH.apps.accent },
  ]),
  spacer(60)
);
children.push(architecture(), spacer());
children.push(p('What is deployed is the reference for "how it should look" — keep a live site open next to your dev server.'));
children.push(
  infoTable(
    [
      ['App', 'Who it serves', 'Runs with', 'Live site'],
      ['Permit', '4 permit-type pages', [mono('npm run dev')], [link('mango-cliff-087d26410…', 'https://mango-cliff-087d26410.7.azurestaticapps.net', 20)]],
      ['Public', 'Visitors — time-based parking', [mono('npm run dev:public')], [link('ashy-mud-0b906db10…', 'https://ashy-mud-0b906db10.7.azurestaticapps.net', 20)]],
    ],
    [12, 32, 26, 30],
    CH.apps.accent
  ),
  spacer()
);
children.push(...screenshot('permit-picker.png', 'The permit app — the visitor picks a permit type, then sees only that page\u2019s lots and rules (the "Guided Finder").'));
children.push(...screenshot('public-overview.png', 'The public app — legend categories, consolidated on-street row, and the lot list.'));
children.push(
  bullet([bold('Stack: '), plain('React 19 · TypeScript · Vite 7 · ArcGIS JS SDK v5 — hooks only, no state library')]),
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
    [35, 65],
    CH.apps.accent
  )
);
children.push(pageBreak());

// ---------------------------------------------------------------- Chapter 2
children.push(banner(CH.rules), spacer());
children.push(h1('2. Content Rules — Non-Negotiable', CH.rules.accent));
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
children.push(warnCallout('Several "bugs" are decisions, not bugs', [
  p([plain('Lots with empty detail cards, 5 lint errors on main, odd RULETYPE values — all known, with decisions recorded in '), mono('docs/BACKLOG.md'), plain('. Read it before changing behaviour.')]),
]));
children.push(pageBreak());

// ---------------------------------------------------------------- Chapter 3
children.push(banner(CH.edits), spacer());
children.push(h1('3. Common Edits — Recipes', CH.edits.accent));
children.push(p([plain('Every recipe is a JSON edit — no component changes. Dev: save + hard-reload. Production: deploy (Chapter 6). Property reference: '), mono('src/config/types.ts'), plain('.')]));

children.push(h2('3.1 — Change sidebar text on a permit page', CH.edits.accent));
children.push(
  recipe([
    ['File', [mono('lagrange-permit.json')]],
    ['Edit', [plain('Find the tab by '), mono('id'), plain(' → edit '), mono('guide.sections'), plain(' bullets (support nested '), mono('items'), plain(' + '), mono('links'), plain(')')]],
    ['Verify', 'Hard-reload, read the page'],
  ]),
  caption('Example: adding "Effective October 1st, …" to two resident bullets was a one-line edit each.')
);

children.push(h2('3.2 — Add / remove a lot on a permit page', CH.edits.accent));
children.push(
  recipe([
    ['File', [mono('lagrange-permit.json'), plain('  →  the tab\u2019s '), mono('areaIds'), plain(' array')]],
    ['Also', 'Update guide text if it names lots ("valid anywhere within Lot 2 and Lot 4")'],
    ['Verify', [mono('node scripts/verify-permit-pages.mjs'), plain(' — every id must resolve')]],
  ]),
  spacer(60),
  warnCallout('The lot must also pass the layer baseWhere', [
    p([plain('Permit app filter: '), mono("USERCLASS = 'PERMIT'"), plain('. A VISITOR-class lot will be listed but never draw — check with an anonymous query first (Chapter 4).')]),
  ]),
  spacer()
);

children.push(h2('3.3 — Rename a lot / add a note', CH.edits.accent));
children.push(
  recipe([
    ['Rename', [mono('profile.nameOverrides'), plain(' keyed by AREAID — e.g. '), mono('"VILLAGEHALLPARKINGSTRUCTURE": "VH Garage"')]],
    ['Note', [mono('tab.note'), plain(' (every card) · '), mono('tab.lotNotes'), plain(' (per lot) · '), mono('tab.lotSubzoneNotes'), plain(' (green callout style)')]],
  ])
);

children.push(h2('3.4 — Designated spaces inside a lot', CH.edits.accent));
children.push(p('Two mechanisms — the same lot can use either, per page:'));
children.push(
  infoTable(
    [
      ['Mechanism', 'What it draws', 'Turned on by'],
      [[bold('Subzones')], 'Resident overnight bands (hosted subzone layer)', [mono('tab.showSubzones: true')]],
      [[bold('Overlay layers')], 'Any filtered polygon (e.g. Lot 5 CBD employee rows)', [mono('overlayLayers[]'), plain(' + '), mono('showForAreaId'), plain(' + '), mono('showForTabIds')]],
    ],
    [20, 45, 35],
    CH.edits.accent
  ),
  spacer(60)
);
children.push(...screenshot('resident-lot5-subzones.png', 'Same lot, page 1: Resident Overnight — green subzone bands mark the only spaces valid overnight.'));
children.push(...screenshot('employees-lot5-overlay.png', 'Same lot, page 2: Employees — the CBD rows overlay draws instead (showForTabIds: ["employees"]).'));
children.push(
  warnCallout('Absence of green is ambiguous — and it fails quiet', [
    bullet('Only permitted areas were digitized: "no bands" can mean "not permitted" or "not drawn yet" (VH Garage, Lot 15)'),
    bullet('The "park only in the highlighted areas" sentence must stay gated by useSubzoneAreaIds — never show it unconditionally'),
    bullet('If the subzone service stops answering anonymously, every band and note silently disappears (docs/DATA.md §3.6)'),
  ])
);
children.push(spacer());

children.push(h2('3.5 — Public map "Availability / Time limit" text', CH.edits.accent));
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
children.push(banner(CH.data), spacer());
children.push(h1('4. The Data', CH.data.accent));
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
    [50, 50],
    CH.data.accent
  ),
  spacer()
);
children.push(
  dangerCallout('Republishing the service breaks both apps — every time', [
    p('Republishing resets AGOL sharing to org-only → both apps fail with {"code":499, "Token Required"}. After ANY republish: re-share Public, then confirm an untokened query returns a count:'),
    ...code(['…/FeatureServer/2/query?where=1=1&returnCountOnly=true&f=json']),
  ])
);
children.push(spacer());
children.push(h2('Check the data before you edit a profile', CH.data.accent));
children.push(...code([
  "node -e 'fetch(\"https://services2.arcgis.com/FwavjPsU0K1YB1vX/arcgis/rest/services/\" +",
  "  \"LaGrange_Parking_Permits/FeatureServer/2/query?where=AREAID=%27LOT4%27\" +",
  "  \"&outFields=AREAID,USERCLASS,HASCBD&returnGeometry=false&f=json\")",
  "  .then(r=>r.json()).then(j=>console.log(JSON.stringify(j.features)))'",
]));
children.push(pageBreak());

// ---------------------------------------------------------------- Chapter 5
children.push(banner(CH.verify), spacer());
children.push(h1('5. Verify Before You Show Anyone', CH.verify.accent));
children.push(
  infoTable(
    [
      ['Command', 'Proves'],
      [[mono('node scripts/verify-permit-pages.mjs')], 'Every lot on every permit page resolves + returns rules (NO RULES warnings = known upstream mislabels)'],
      [[mono('node scripts/verify-basemaps.mjs')], 'Each basemap serves a real tile over La Grange (metadata alone lies)'],
      [[mono('node scripts/inspect-service.mjs')], 'Schema + value distributions'],
      [[mono('npm run lint')], 'Only NEW errors matter — 5 are pre-existing on main'],
    ],
    [42, 58],
    CH.verify.accent
  ),
  spacer()
);
children.push(h2('2-minute browser pass', CH.verify.accent));
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
children.push(banner(CH.ship), spacer());
children.push(h1('6. Ship It', CH.ship.accent));
children.push(
  flow([
    { step: '1 · BUILD', sub: 'npm run build', color: '0B7285', monoSub: true },
    { step: '2 · PUSH', sub: 'git push origin master:main', color: '5B4B9E', monoSub: true },
    { step: '3 · DEPLOY', sub: 'SWA CLI × 2', color: '1F5C8B', monoSub: true },
    { step: '4 · SMOKE TEST', sub: 'live profiles + click-through', color: '2F7D32' },
  ]),
  spacer()
);
children.push(
  warnCallout('Branch gotcha', [
    p([plain('Local branch is '), mono('master'), plain('; GitHub default is '), mono('main'), plain('. A plain '), mono('git push'), plain(' creates a stray remote branch — always push '), mono('master:main'), plain('.')]),
  ]),
  spacer()
);
children.push(h2('Deploy both SWAs (PowerShell, verified 2026-09-01)', CH.ship.accent));
children.push(...code([
  '$TOKEN = az staticwebapp secrets list -n lagrange-parking-permit -g rg-lagrange-parking `',
  '           --query "properties.apiKey" -o tsv',
  'npx -y "@azure/static-web-apps-cli" deploy ./dist/permit --deployment-token $TOKEN --env production',
  '',
  '$TOKEN = az staticwebapp secrets list -n lagrange-parking-public -g rg-lagrange-parking `',
  '           --query "properties.apiKey" -o tsv',
  'npx -y "@azure/static-web-apps-cli" deploy ./dist/public --deployment-token $TOKEN --env production',
]));
children.push(h2('Smoke test', CH.ship.accent));
children.push(
  ...steps([
    [plain('Fetch each site\u2019s '), mono('/profiles/*.json'), plain(' and confirm your edits are live')],
    'Click through one permit page and one public lot card',
  ])
);
children.push(p([plain('Azure: tenant '), bold('Spark by MGP'), plain(' · subscription '), bold('Microsoft Azure Sponsorship'), plain(' · resource group '), mono('rg-lagrange-parking'), plain('. Recreate-from-scratch: '), mono('DEPLOY.md'), plain('. CI builds but does not deploy.')]));
children.push(pageBreak());

// ---------------------------------------------------------------- Chapter 7
children.push(banner(CH.fix), spacer());
children.push(h1('7. When Something Looks Broken', CH.fix.accent));
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
    [38, 62],
    CH.fix.accent
  )
);
children.push(pageBreak());

// ---------------------------------------------------------------- Chapter 8
children.push(banner(CH.gis), spacer());
children.push(h1('8. GIS Analyst Documentation', CH.gis.accent));
children.push(p([plain('The GIS side of the project — who is involved, where every source lives, how data flows to the apps, and the decisions that shaped the deliverable. Maintained by the GIS analyst; the running log is '), mono('PROJECTDOCUMENTATION.md'), plain(' on the X: drive.')]));

children.push(h2('8.1 — Client outcome', CH.gis.accent));
children.push(
  callout('What the Village gets', [
    p('Village of La Grange stakeholders and the public have accurate, clear maps that show where each parking permit applies, who is eligible for it, and where visitors may park — supporting the Village\u2019s parking management revamp and its move from "decals" to "permits."'),
  ], INFO_FILL, CH.gis.accent, CH.gis.accent, '◎'),
  spacer()
);
children.push(p([bold('Deliverable: '), plain('two public, mobile-friendly parking maps from one React codebase, deployed as separate Azure Static Web Apps, both reading one publicly shared ArcGIS Online feature service — no login. Supporting GIS work: the Village\u2019s flat parking inventory restructured into a related area-and-rule model, published to the Village\u2019s AGOL organization with the designated overnight-resident areas digitized from engineering drawings.')]));
children.push(p([bold('Status (2026-08-05): '), plain('both apps live, in an iterate-on-feedback phase. Every item from the 2026-07-28 stakeholder meeting is complete. Open items wait on the Village — the real permit purchase URL, a landing-page cover photo, and the missing engineering sheet for the Village Hall garage.')]));
children.push(p([bold('Timeline: '), plain('Village\u2019s stated program go-live was end of June 2026; MGP follows Charity Jones\u2019s lead on timing. MGP hours: TBD.')]));

children.push(h2('8.2 — Stakeholders', CH.gis.accent));
children.push(
  infoTable(
    [
      ['Who', 'Role'],
      [[bold('Charity Jones')], 'Village of La Grange, Assistant Village Manager — primary contact and reviewer; all design and content decisions route through her'],
      [[bold('Susan Mika')], 'Village of La Grange — stakeholder'],
      [[bold('Esri')], 'ArcGIS Pro · ArcGIS Online · ArcGIS Maps SDK for JavaScript'],
      [[bold('Passport')], 'The Village\u2019s parking permit system — source of the eligibility list'],
      [[bold('Microsoft Azure')], 'Static Web Apps hosting for both applications'],
    ],
    [22, 78],
    CH.gis.accent
  )
);
children.push(pageBreak());

children.push(h2('8.3 — Data lineage', CH.gis.accent));
children.push(
  flow([
    { step: 'LGDM', sub: 'mgp-sql02 · Parking_Restriction_POLY', color: '095443', monoSub: true },
    { step: 'FILE GDB', sub: 'lagrange_build_fgdb.py', color: '0E7C66', monoSub: true },
    { step: 'AGOL SERVICE', sub: 'LaGrange_Parking_Permits', color: '1F5C8B', monoSub: true },
    { step: 'APPS', sub: 'permit + public', color: '0B7285' },
  ]),
  spacer()
);
children.push(
  dangerCallout('The trap — edit the LGDM, not the geodatabase', [
    p([plain('Editing the file geodatabase alone is '), bold('not durable'), plain(': '), mono('lagrange_build_fgdb.py'), plain(' rebuilds ParkingArea and ParkingRule from the LGDM, so anything added only to the geodatabase is lost on the next rebuild. '), bold('Lot 15 is in that state today.'), plain(' Real changes go into the LGDM first, then rebuild and republish.')]),
  ]),
  spacer()
);
children.push(
  infoTable(
    [
      ['Layer / resource', 'Where', 'Notes'],
      [[bold('Source of record')], [mono('mgp-sql02 › GISC_PRODUCTION › DBO.Parking_Restriction_POLY')], 'GEODBID \u2018024\u2019. The Village\u2019s authoritative parking inventory and the origin of everything below. Edited in ArcGIS Pro.'],
      [[bold('Working geodatabase')], [mono('X:\\GISC\\Community\\LaGrange\\Project\\20240829_ParkingPermitMaps\\APRX\\Parking_Permit_Restructure\\ParkingPermits.gdb')], 'ParkingArea, ParkingRule, OvernightResidentSubzones, PermitEligibleAddress, StudyZone + domains. Rebuilt from the LGDM by lagrange_build_fgdb.py.'],
      [[bold('ArcGIS Pro project')], [mono('…\\Parking_Permit_Restructure\\Parking_Permit_Restructure.aprx')], 'Maps: Permit Parking, Visitor Parking, Permit-Eligible Addresses. Editing + QA only — the apps do not read it. Superseded original is in the adjacent "Parking Decal Maps" folder.'],
      [[bold('Live service (apps read this)')], [mono('LaGrange_Parking_Permits'), plain(' on lagrangeil.maps.arcgis.com · item '), mono('f13e7fa3199141a2be6c2eea816de8d4')], 'Sublayer /2 ParkingArea (144 polygons) · /3 ParkingRule (173 rows, 1:many on AREAID). Shared publicly.'],
      [[bold('Designated overnight areas')], [mono('LaGrange_Overnight_Resident_Subzones')], '8 polygons over Lots 2, 5, 11, 12, 13 — digitized from Heuer and Associates engineering drawings dated 12/30/2016. Deliberately its own service.'],
      [[bold('Context layer')], [mono('LaGrangeImportantPlaces_ParkingContext_')], '23 civic, park, landmark and Metra features curated from GISC_PUBLISH_FGDB.gdb\\Base\\ImportantPlace_POLY. Map context only.'],
      [[bold('Eligibility addresses')], [mono('…\\20240829_ParkingPermitMaps\\Data\\')], 'Passport v2 permit-holder list ("Residential parking - address list for geocode.xlsx") + geocode outputs. Geocoded against X:\\GISC\\Publish\\Geocoder, Esri World geocoder as fallback.'],
      [[bold('Village policy documents')], [mono('…\\Village Policies and Documentation\\')], 'Permit policy PDFs — supply the rule text absent from the GIS data. Finished exhibits in the adjacent Deliverables folder.'],
    ],
    [20, 40, 40],
    CH.gis.accent
  )
);
children.push(pageBreak());

children.push(h2('8.4 — Other resources', CH.gis.accent));
children.push(
  infoTable(
    [
      ['Resource', 'Location / detail'],
      [[bold('Application repository')], [link('github.com/mgp-inc/lagrange-parking', 'https://github.com/mgp-inc/lagrange-parking', 20), plain(' — self-contained and portable; docs/ carries app-side context, data notes, backlog. Working copy: '), mono('E:\\lagrange-parking')]],
      [[bold('Running project log')], [mono('X:\\GISC\\Community\\LaGrange\\Project\\20240829_ParkingPermitMaps\\PROJECTDOCUMENTATION.md'), plain(' — full decision and progress history for the GIS side')]],
      [[bold('Hosting')], [plain('Azure tenant '), mono('Community-Essentials.com'), plain(' · resource group '), mono('rg-lagrange-parking'), plain(' (centralus) · two Static Web Apps, Free plan · steps in '), mono('DEPLOY.md')]],
      [[bold('Branding')], 'Village of La Grange Brand Guidelines (0719) — Dark Blue #00306C · La Grange Blue #126BB5 · Green #43B749 · Nunito Sans + Oswald'],
      [[bold('Basemap')], 'GISC Light Canvas — in both the apps and the ArcGIS Pro maps'],
    ],
    [24, 76],
    CH.gis.accent
  ),
  spacer()
);

children.push(h2('8.5 — Decisions that shaped the deliverable', CH.gis.accent));
children.push(
  infoTable(
    [
      ['Decision', 'Why it matters'],
      [[bold('Two apps, not StoryMaps')], 'Charity ended the single all-in-one map on 2026-06-18. Two audience-targeted apps replaced it; the StoryMaps in the original scope were dropped. The June AGOL web maps still exist but are QA aids only.'],
      [[bold('The parking data was de-fragmented')], 'One physical lot arrived as several overlapping polygons, one per restriction type. Dissolved into one area per lot with its rules in a related table — this is what makes the data answerable.'],
      [[bold('Lot lists and content are the Village\u2019s')], 'Lots on each permit page come from the Village\u2019s verbatim list, not a data-derived guess. Rates exist in the data but are never displayed; "decal" appears in no public text.'],
      [[bold('Designated overnight areas are GIS features')], 'Only the permitted areas inside each lot were drawn, not the prohibited remainder — so the apps must state the rule in words. Scanned drawings were rejected in favor of real map features.'],
    ],
    [30, 70],
    CH.gis.accent
  ),
  spacer()
);
children.push(
  dangerCallout('The one that will bite you', [
    p([plain('Republishing '), mono('LaGrange_Parking_Permits'), plain(' resets its sharing to organization-only, and both public apps immediately fail with "Token Required." Re-share it publicly and re-test anonymous access after '), bold('every'), plain(' republish.')]),
  ]),
  spacer(60),
  warnCallout('AREAID is the join key — spelling is everything', [
    p([plain('AREAID is the lot name uppercased with non-alphanumerics stripped: "Lot 15" → '), mono('LOT15'), plain('. Any other spelling silently drops the lot from its page. Verify against the live services rather than trusting the configuration: '), mono('node scripts/verify-permit-pages.mjs'), plain(' confirms every listed lot resolves and returns rules.')]),
  ]),
  spacer()
);
children.push(p([plain('Known upstream data defects are catalogued in '), mono('docs/DATA.md'), plain(' — chiefly that RULETYPE is a heuristic label, which currently leaves three lots with an empty detail card.')]));

children.push(h2('8.6 — Publish / republish log', CH.gis.accent));
children.push(p('Complete one row every time the hosted service is overwritten or republished:'));
children.push(
  fillTable(['Date', 'What changed', 'Republished by', 'Re-shared Public? (Y/N)', 'Anonymous query verified? (Y/N)'], 5, [12, 34, 18, 18, 18], CH.gis.accent)
);

// ---- assemble ----------------------------------------------------------------
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
// Allow an alternate output path (e.g. when the default is locked open in Word)
const target = process.argv[2] ?? new URL('../docs/LaGrange-Parking-Developer-Guide.docx', import.meta.url);
writeFileSync(target, buf);
console.log('Wrote', typeof target === 'string' ? target : target.pathname);
