// Generates docs/LaGrange-Parking-Developer-Guide.docx.
// Structure and typography follow the MGP project-documentation template used by
// the GIS analyst ("La Grange Parking Permit Maps.docx"): Word Heading 1/2/3 styles,
// Aptos fonts, 1" margins, bulleted lists. Developer content is appended as its own
// section after the template's sections.
// Run: node scripts/generate-dev-guide.mjs [outputPath]
import {
  AlignmentType, BorderStyle, Document, ExternalHyperlink, Footer, HeadingLevel, ImageRun,
  LevelFormat, Packer, PageBreak, PageNumber, Paragraph, ShadingType, Table, TableCell,
  TableOfContents, TableRow, TextRun, VerticalAlign, WidthType, convertInchesToTwip,
} from 'docx';
import { readFileSync, writeFileSync } from 'node:fs';

// ---- typography (matches the template's theme: Aptos Display / Aptos) ----------
const HEAD_FONT = 'Aptos Display';
const BODY_FONT = 'Aptos';
const CODE_FONT = 'Consolas';
const BODY = 22; // 11 pt
const HEADING_COLOR = '0F4761'; // Word 365 default heading color

// ---- accent palette for visual elements ------------------------------------------
const INK = '2B2B2B';
const GRAY = '7F7F7F';
const CODE_FILL = 'F4F4F4';
const ZEBRA = 'F2F7FB';
const FRAME = 'C9C9C9';
const BLUE = '1F5C8B';
const TEAL = '0B7285';
const GREEN = '2F7D32';
const PURPLE = '5B4B9E';
const AMBER = 'B45309';
const SLATE = '475569';
const GOOD_FILL = 'E2EFDA', GOOD_DARK = '538135';
const BAD_FILL = 'FBE4E4', BAD_DARK = 'C00000';
const WARN_FILL = 'FFF3DC', WARN_DARK = 'B45309';
const INFO_FILL = 'EAF3FA', INFO_BORDER = '7FB2D9';

// ---- runs / paragraphs ------------------------------------------------------------
const plain = (text) => new TextRun({ text, font: BODY_FONT, size: BODY, color: INK });
const bold = (text) => new TextRun({ text, font: BODY_FONT, size: BODY, bold: true, color: INK });
const mono = (text) => new TextRun({ text, font: CODE_FONT, size: BODY - 2, color: INK });

const p = (runs, opts = {}) =>
  new Paragraph({ spacing: { after: 140, ...opts.spacing }, ...opts.para, children: Array.isArray(runs) ? runs : [plain(runs)] });

// Real Word heading styles (defined in the styles block below) — Navigation Pane + TOC work.
const h1 = (text) => new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun(text)] });
const h2 = (text) => new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun(text)] });
const h3 = (text) => new Paragraph({ heading: HeadingLevel.HEADING_3, children: [new TextRun(text)] });

const bullet = (runs) =>
  new Paragraph({ numbering: { reference: 'bullets', level: 0 }, spacing: { after: 80 }, children: Array.isArray(runs) ? runs : [plain(runs)] });

let numInstance = 0;
const steps = (items) => {
  numInstance += 1;
  return items.map((runs) =>
    new Paragraph({ numbering: { reference: 'steps', level: 0, instance: numInstance }, spacing: { after: 70 }, children: Array.isArray(runs) ? runs : [plain(runs)] })
  );
};

const code = (lines) =>
  (Array.isArray(lines) ? lines : [lines]).map((line, i, arr) =>
    new Paragraph({
      shading: { type: ShadingType.CLEAR, fill: CODE_FILL },
      spacing: { after: i === arr.length - 1 ? 140 : 0 },
      indent: { left: convertInchesToTwip(0.2) },
      children: [new TextRun({ text: line || ' ', font: CODE_FONT, size: BODY - 2 })],
    })
  );

const caption = (text) =>
  new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 200 }, children: [new TextRun({ text, font: BODY_FONT, size: 18, italics: true, color: GRAY })] });

const link = (text, url, size = BODY) =>
  new ExternalHyperlink({ link: url, children: [new TextRun({ text, font: BODY_FONT, size, color: '0563C1', underline: {} })] });

const noBorder = { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' };
const allNone = { top: noBorder, bottom: noBorder, left: noBorder, right: noBorder };
const thin = (color, size = 6) => ({ style: BorderStyle.SINGLE, size, color });
const boxAll = (color, size = 6) => ({ top: thin(color, size), bottom: thin(color, size), left: thin(color, size), right: thin(color, size) });
const spacer = (after = 120) => new Paragraph({ spacing: { after }, children: [] });
const pageBreak = () => new Paragraph({ children: [new PageBreak()] });

// ---- visual components ------------------------------------------------------------
const callout = (title, body, fill = INFO_FILL, border = INFO_BORDER, titleColor = BLUE, icon = 'ℹ') =>
  new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [new TableRow({ children: [new TableCell({
      shading: { type: ShadingType.CLEAR, fill },
      borders: { top: thin(border), bottom: thin(border), right: thin(border), left: thin(border, 24) },
      margins: { top: 140, bottom: 140, left: 240, right: 240 },
      children: [
        new Paragraph({ spacing: { after: 80 }, children: [new TextRun({ text: `${icon}  ${title}`, font: BODY_FONT, size: BODY, bold: true, color: titleColor })] }),
        ...body,
      ],
    })] })],
  });
const warnCallout = (t, b) => callout(t, b, WARN_FILL, WARN_DARK, WARN_DARK, '⚠');
const dangerCallout = (t, b) => callout(t, b, BAD_FILL, BAD_DARK, BAD_DARK, '⛔');

const infoTable = (rows, widths, accent = BLUE) =>
  new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: rows.map((cells, r) =>
      new TableRow({
        children: cells.map((cell, c) =>
          new TableCell({
            width: widths ? { size: widths[c], type: WidthType.PERCENTAGE } : undefined,
            shading: r === 0 ? { type: ShadingType.CLEAR, fill: accent } : r % 2 === 0 ? { type: ShadingType.CLEAR, fill: ZEBRA } : undefined,
            borders: boxAll('D9D9D9', 4),
            margins: { top: 80, bottom: 80, left: 120, right: 120 },
            children: [new Paragraph({
              children: r === 0
                ? [new TextRun({ text: String(cell), font: BODY_FONT, size: BODY - 2, bold: true, color: 'FFFFFF' })]
                : Array.isArray(cell) ? cell : cell instanceof TextRun ? [cell] : [new TextRun({ text: String(cell), font: BODY_FONT, size: BODY - 2, color: INK })],
            })],
          })
        ),
      })
    ),
  });

const fillTable = (headers, blankRows, widths, accent) =>
  infoTable([headers, ...Array.from({ length: blankRows }, () => headers.map(() => ' '))], widths, accent);

const cardGrid = (cards) => {
  const cell = (card) =>
    new TableCell({
      width: { size: 50, type: WidthType.PERCENTAGE },
      borders: boxAll(card.accent),
      margins: { top: 0, bottom: 120, left: 0, right: 0 },
      verticalAlign: VerticalAlign.TOP,
      children: [
        new Paragraph({ shading: { type: ShadingType.CLEAR, fill: card.accent }, spacing: { after: 90 }, indent: { left: 120 }, children: [new TextRun({ text: `${card.icon}  ${card.title}`, font: BODY_FONT, size: BODY, bold: true, color: 'FFFFFF' })] }),
        ...card.lines.map((l, i) => new Paragraph({ spacing: { after: i === card.lines.length - 1 ? 70 : 45 }, indent: { left: 140, right: 100 }, children: Array.isArray(l) ? l : [l] })),
      ],
    });
  const rows = [];
  for (let i = 0; i < cards.length; i += 2) rows.push(new TableRow({ children: [cell(cards[i]), cell(cards[i + 1])] }));
  return new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, borders: allNone, rows });
};

const statStrip = (stats) =>
  new Table({
    width: { size: 100, type: WidthType.PERCENTAGE }, borders: allNone,
    rows: [new TableRow({ children: stats.map((s, i) =>
      new TableCell({
        width: { size: 100 / stats.length, type: WidthType.PERCENTAGE },
        borders: { ...allNone, right: i < stats.length - 1 ? thin('E0E0E0', 4) : noBorder },
        margins: { top: 100, bottom: 100, left: 60, right: 60 },
        children: [
          new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 20 }, children: [new TextRun({ text: s.n, font: HEAD_FONT, size: 44, bold: true, color: s.color })] }),
          new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: s.label, font: BODY_FONT, size: 18, color: GRAY })] }),
        ],
      })
    ) })],
  });

const flow = (items) => {
  const cells = [];
  items.forEach((it, i) => {
    cells.push(new TableCell({
      shading: { type: ShadingType.CLEAR, fill: it.color }, borders: allNone, verticalAlign: VerticalAlign.CENTER,
      margins: { top: 110, bottom: 110, left: 60, right: 60 },
      children: [
        new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 10 }, children: [new TextRun({ text: it.step, font: BODY_FONT, size: BODY, bold: true, color: 'FFFFFF' })] }),
        new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: it.sub, font: it.monoSub ? CODE_FONT : BODY_FONT, size: 16, color: 'FFFFFF' })] }),
      ],
    }));
    if (i < items.length - 1) cells.push(new TableCell({
      width: { size: 4, type: WidthType.PERCENTAGE }, borders: allNone, verticalAlign: VerticalAlign.CENTER,
      children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: '→', font: BODY_FONT, size: 30, bold: true, color: GRAY })] })],
    }));
  });
  return new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, borders: allNone, rows: [new TableRow({ children: cells })] });
};

const archBox = (fill, title, sub, width) =>
  new TableCell({
    width: { size: width, type: WidthType.PERCENTAGE }, shading: { type: ShadingType.CLEAR, fill }, borders: allNone, verticalAlign: VerticalAlign.CENTER,
    margins: { top: 120, bottom: 120, left: 100, right: 100 },
    children: [
      new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 30 }, children: [new TextRun({ text: title, font: BODY_FONT, size: BODY, bold: true, color: 'FFFFFF' })] }),
      new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: sub, font: BODY_FONT, size: 16, color: 'FFFFFF' })] }),
    ],
  });
const archArrow = (glyph = '→', w = 5) =>
  new TableCell({ width: { size: w, type: WidthType.PERCENTAGE }, borders: allNone, verticalAlign: VerticalAlign.CENTER, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: glyph, font: BODY_FONT, size: 30, bold: true, color: GRAY })] })] });
const archEmpty = (w) => new TableCell({ width: { size: w, type: WidthType.PERCENTAGE }, borders: allNone, children: [new Paragraph({ children: [] })] });
const architecture = () =>
  new Table({
    width: { size: 100, type: WidthType.PERCENTAGE }, borders: allNone,
    rows: [
      new TableRow({ children: [
        archBox(PURPLE, 'Profiles (JSON)', 'public/profiles/* — ALL content: tabs, lots, text, colors', 30), archArrow(),
        archBox(TEAL, 'Two React apps', 'Guided Finder (permit) · Explorer (public) — static SPAs', 30), archArrow(),
        archBox(BLUE, 'ArcGIS Online', 'hosted feature services — anonymous, read-only', 30),
      ] }),
      new TableRow({ children: [archEmpty(30), archEmpty(5), archArrow('↓', 30), archEmpty(5), archEmpty(30)] }),
      new TableRow({ children: [archEmpty(30), archEmpty(5), archBox(SLATE, 'Azure Static Web Apps', 'Free plan · one resource per app · manual deploy', 30), archEmpty(5), archEmpty(30)] }),
    ],
  });

const screenshot = (file, captionText, widthIn = 6.0) => {
  const w = Math.round(widthIn * 96), h = Math.round(w * (800 / 1280));
  return [
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE }, borders: allNone,
      rows: [new TableRow({ children: [new TableCell({
        borders: boxAll(FRAME, 4), margins: { top: 60, bottom: 60, left: 60, right: 60 },
        children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new ImageRun({ type: 'png', data: readFileSync(new URL(`../docs/guide-assets/${file}`, import.meta.url)), transformation: { width: w, height: h } })] })],
      })] })],
    }),
    spacer(40),
    caption(captionText),
  ];
};

const recipe = (rows, accent = GREEN) =>
  new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: rows.map(([label, content], r) =>
      new TableRow({ children: [
        new TableCell({ width: { size: 14, type: WidthType.PERCENTAGE }, shading: { type: ShadingType.CLEAR, fill: accent }, borders: boxAll('D9D9D9', 4), margins: { top: 70, bottom: 70, left: 120, right: 120 }, children: [new Paragraph({ children: [new TextRun({ text: label, font: BODY_FONT, size: BODY - 3, bold: true, color: 'FFFFFF' })] })] }),
        new TableCell({ width: { size: 86, type: WidthType.PERCENTAGE }, shading: r % 2 === 1 ? { type: ShadingType.CLEAR, fill: ZEBRA } : undefined, borders: boxAll('D9D9D9', 4), margins: { top: 70, bottom: 70, left: 120, right: 120 }, children: [new Paragraph({ children: Array.isArray(content) ? content : [plain(content)] })] }),
      ] })
    ),
  });

const doDont = (dos, donts) => {
  const col = (title, items, fill, dark, mark) =>
    new TableCell({
      width: { size: 50, type: WidthType.PERCENTAGE },
      borders: { top: thin(dark, 24), bottom: thin(dark), left: thin(dark), right: thin(dark) },
      margins: { top: 100, bottom: 100, left: 160, right: 160 }, shading: { type: ShadingType.CLEAR, fill },
      children: [
        new Paragraph({ spacing: { after: 100 }, children: [new TextRun({ text: `${mark}  ${title}`, font: BODY_FONT, size: BODY + 1, bold: true, color: dark })] }),
        ...items.map((t) => new Paragraph({ spacing: { after: 70 }, children: [new TextRun({ text: `${mark} `, font: BODY_FONT, size: BODY - 2, bold: true, color: dark }), ...(Array.isArray(t) ? t : [new TextRun({ text: t, font: BODY_FONT, size: BODY - 2, color: INK })])] })),
      ],
    });
  return new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, borders: allNone, rows: [new TableRow({ children: [col('DO', dos, GOOD_FILL, GOOD_DARK, '\u2713'), col("DON'T", donts, BAD_FILL, BAD_DARK, '\u2717')] })] });
};

// ---- document ---------------------------------------------------------------------
const ch = [];

// Title (template uses Heading 1 for the document title)
ch.push(h1('La Grange Parking Permit Maps'));
ch.push(
  new Paragraph({ spacing: { after: 60 }, children: [new TextRun({ text: 'MGP Inc. — GIS & Web Applications  ·  Project documentation and developer guide', font: BODY_FONT, size: BODY - 2, color: GRAY })] }),
  new Paragraph({ spacing: { after: 240 }, children: [new TextRun({ text: 'Regenerated by scripts/generate-dev-guide.mjs  ·  September 2026', font: BODY_FONT, size: BODY - 4, italics: true, color: GRAY })] }),
  new TableOfContents('Table of Contents', { hyperlink: true, headingStyleRange: '2-3' }),
  new Paragraph({ spacing: { before: 120, after: 240 }, children: [new TextRun({ text: 'If page numbers are missing, right-click the table and choose "Update Field".', font: BODY_FONT, size: 16, italics: true, color: GRAY })] }),
);

// ================================================================ Project Overview
ch.push(h2('Project Overview'));
ch.push(h3('Client Outcome'));
ch.push(p('Village of La Grange stakeholders and the public have accurate, clear maps that show where each parking permit applies, who is eligible for it, and where visitors may park — supporting the Village\u2019s parking management revamp and its move from "decals" to "permits."'));
ch.push(h3('Deliverable Description'));
ch.push(p('Two public, mobile-friendly parking map applications, built from one React codebase and deployed as separate Azure Static Web Apps. Both read a single publicly shared ArcGIS Online feature service; neither requires a login.'));
ch.push(
  bullet([bold('Permit app — '), link('https://mango-cliff-087d26410.7.azurestaticapps.net', 'https://mango-cliff-087d26410.7.azurestaticapps.net'), plain(' — four permit-type pages: Resident Overnight Only, Resident Day/Night (24 hr.), Commuter & LTHS Students, Employees.')]),
  bullet([bold('Public app — '), link('https://ashy-mud-0b906db10.7.azurestaticapps.net', 'https://ashy-mud-0b906db10.7.azurestaticapps.net'), plain(' — visitor, shopper and diner parking colored by time limit. Contains no permit content.')]),
);
ch.push(p('Supporting GIS work: the Village\u2019s flat parking inventory restructured into a related area-and-rule model, published to the Village\u2019s ArcGIS Online organization along with the designated overnight-resident parking areas digitized from Village engineering drawings.'));
ch.push(p('Status as of 2026-08-05: both apps are live and in an iterate-on-feedback phase with the Village. Nothing is in flight. Every item from the 2026-07-28 stakeholder meeting is complete, including the designated overnight areas that went live 2026-07-29. Remaining open items are waiting on the Village — principally the real permit purchase URL (the apply button currently points at the Village homepage), a landing-page cover photo, and the missing engineering sheet for the Village Hall garage.'));
ch.push(...screenshot('permit-picker.png', 'The permit app — the visitor picks a permit type, then sees only that page\u2019s lots and rules.'));

// ================================================================ Stakeholders
ch.push(h2('Stakeholders'));
ch.push(
  bullet([bold('Charity Jones'), plain(' — Village of La Grange, Assistant Village Manager. Primary contact and reviewer; all design and content decisions route through her.')]),
  bullet([bold('Susan Mika'), plain(' — Village of La Grange, stakeholder.')]),
  bullet([bold('Esri'), plain(' — ArcGIS Pro, ArcGIS Online, ArcGIS Maps SDK for JavaScript.')]),
  bullet([bold('Passport'), plain(' — the Village\u2019s parking permit system; source of the eligibility list.')]),
  bullet([bold('Microsoft Azure'), plain(' — Static Web Apps hosting for both applications.')]),
);

// ================================================================ Resources
ch.push(h2('Resources'));
ch.push(h3('Data Sources'));
ch.push(
  bullet([bold('Source of record — '), mono('mgp-sql02 > GISC_PRODUCTION > DBO.Parking_Restriction_POLY'), plain(' (GEODBID \u2018024\u2019) — the Village\u2019s authoritative parking inventory and the origin of everything below. Edited in ArcGIS Pro.')]),
  bullet([bold('Working geodatabase — '), mono('X:\\GISC\\Community\\LaGrange\\Project\\20240829_ParkingPermitMaps\\APRX\\Parking_Permit_Restructure\\ParkingPermits.gdb'), plain(' — holds ParkingArea, ParkingRule, OvernightResidentSubzones, PermitEligibleAddress, StudyZone and the domains. Rebuilt from the LGDM by lagrange_build_fgdb.py.')]),
  bullet([bold('ArcGIS Pro project and maps — '), mono('X:\\GISC\\Community\\LaGrange\\Project\\20240829_ParkingPermitMaps\\APRX\\Parking_Permit_Restructure\\Parking_Permit_Restructure.aprx'), plain(' — the current ArcGIS Pro project and its maps (Permit Parking, Visitor Parking, Permit-Eligible Addresses). Used for editing and QA; the apps do not read it. The superseded original project is in the adjacent "Parking Decal Maps" folder.')]),
  bullet([bold('Live service the apps read — '), mono('LaGrange_Parking_Permits'), plain(' on https://lagrangeil.maps.arcgis.com, item f13e7fa3199141a2be6c2eea816de8d4. Sublayer /2 ParkingArea (144 polygons) and /3 ParkingRule (173 rows, related 1:many on AREAID) are what both apps query. Shared publicly.')]),
  bullet([bold('Designated overnight areas — '), mono('LaGrange_Overnight_Resident_Subzones'), plain(' — 8 polygons over Lots 2, 5, 11, 12 and 13, digitized from Heuer and Associates engineering drawings dated 12/30/2016. Deliberately its own service, not a sublayer of the above.')]),
  bullet([bold('Context layer — '), mono('LaGrangeImportantPlaces_ParkingContext_'), plain(' — 23 civic, park, landmark and Metra features curated from X:\\GISC\\Publish\\GeoDB\\GISC_PUBLISH_FGDB.gdb\\Base\\ImportantPlace_POLY. Map context only.')]),
  bullet([bold('Eligibility addresses — '), mono('X:\\GISC\\Community\\LaGrange\\Project\\20240829_ParkingPermitMaps\\Data\\'), plain(' — the Passport v2 permit-holder list ("Residential parking - address list for geocode.xlsx") and the geocode outputs derived from it. Geocoded against X:\\GISC\\Publish\\Geocoder with Esri\u2019s World geocoder as fallback.')]),
  bullet([bold('Village policy documents — '), mono('X:\\GISC\\Community\\LaGrange\\Project\\20240829_ParkingPermitMaps\\Village Policies and Documentation\\'), plain(' — the Village\u2019s permit policy PDFs, which supply the rule text absent from the GIS data. Finished exhibits are in the adjacent Deliverables folder.')]),
);
ch.push(h3('Other'));
ch.push(
  bullet([bold('Application repository — '), link('https://github.com/mgp-inc/lagrange-parking', 'https://github.com/mgp-inc/lagrange-parking'), plain(' — the application source, self-contained and portable. Its docs folder carries the app-side context, data notes and open-item backlog. Working copy on the project lead\u2019s machine at E:\\lagrange-parking.')]),
  bullet([bold('Running project log — '), mono('X:\\GISC\\Community\\LaGrange\\Project\\20240829_ParkingPermitMaps\\PROJECTDOCUMENTATION.md'), plain(' — the internal running log; full decision and progress history for the GIS side.')]),
  bullet([bold('Hosting — '), plain('Azure tenant Community-Essentials.com, resource group rg-lagrange-parking (centralus), two Static Web Apps on the Free plan. Deployment steps are in the repository\u2019s DEPLOY.md.')]),
  bullet([bold('Branding and basemap — '), plain('Village of La Grange Brand Guidelines (0719) — Dark Blue #00306C, La Grange Blue #126BB5, Green #43B749; Nunito Sans and Oswald. GISC Light Canvas is the basemap in both the apps and the ArcGIS Pro maps.')]),
);

// ================================================================ Timeline
ch.push(h2('Timeline'));
ch.push(p([bold('Due Date: '), plain('The Village\u2019s originally stated parking program go-live was the end of June 2026; MGP is following Charity Jones\u2019s lead on timing.')]));
ch.push(p([bold('MGP Hours: '), plain('TBD')]));

// ================================================================ Advanced Process Details
ch.push(h2('Advanced Process Details'));
ch.push(h3('Decisions that shaped the deliverable'));
ch.push(
  bullet([bold('Two apps, not StoryMaps. '), plain('Charity ended the single all-in-one map on 2026-06-18. The deliverable became two separate audience-targeted apps, and the ArcGIS StoryMaps in the original scope were dropped. The AGOL web maps built in June still exist but are QA aids only.')]),
  bullet([bold('The parking data was de-fragmented. '), plain('One physical lot arrived as several overlapping polygons, one per restriction type. These were dissolved into one area per lot carrying its rules in a related table, which is what makes the data answerable.')]),
  bullet([bold('Lot lists and content are the Village\u2019s, not inferred. '), plain('The lots shown on each permit page come from the Village\u2019s own verbatim list, not from a data-derived guess. Rates exist in the data but are never displayed, and the word "decal" does not appear in any public text.')]),
  bullet([bold('Designated overnight areas are drawn as GIS features. '), plain('Only the permitted areas inside each lot were drawn, not the prohibited remainder, so the apps must state the rule in words. Scanned drawings were rejected in favor of real map features.')]),
);
ch.push(h3('Changing the data, and the trap to avoid'));
ch.push(p('Data flows LGDM → file geodatabase → hosted service → apps.'));
ch.push(
  flow([
    { step: 'LGDM', sub: 'mgp-sql02 · Parking_Restriction_POLY', color: '095443', monoSub: true },
    { step: 'FILE GDB', sub: 'lagrange_build_fgdb.py', color: '0E7C66', monoSub: true },
    { step: 'HOSTED SERVICE', sub: 'LaGrange_Parking_Permits', color: BLUE, monoSub: true },
    { step: 'APPS', sub: 'permit + public', color: TEAL },
  ]),
  spacer(),
);
ch.push(p([plain('Editing the geodatabase alone is not durable: '), mono('lagrange_build_fgdb.py'), plain(' rebuilds ParkingArea and ParkingRule from the LGDM, so anything added only to the geodatabase is lost on the next rebuild. Lot 15 is in that state today. Real changes go into the LGDM first, then rebuild and republish.')]));
ch.push(p([plain('Known upstream data defects are catalogued in the repository\u2019s '), mono('docs/DATA.md'), plain(' — chiefly that RULETYPE is a heuristic label, which currently leaves three lots with an empty detail card.')]));
ch.push(
  dangerCallout('The one that will bite you', [
    p([plain('Republishing '), mono('LaGrange_Parking_Permits'), plain(' resets its sharing to organization-only, and both public apps immediately fail with "Token Required." Re-share it publicly and re-test anonymous access after every republish.')]),
  ]),
  spacer(80),
);
ch.push(
  bullet([bold('AREAID is the join key between the data and the apps. '), plain('It is the lot name uppercased with non-alphanumerics stripped, so "Lot 15" becomes "LOT15"; any other spelling silently drops the lot from its page.')]),
  bullet([bold('Verify against the live services rather than trusting the configuration: '), mono('node scripts/verify-permit-pages.mjs'), plain(' confirms every listed lot resolves and returns rules.')]),
);
ch.push(h3('Publish / republish log'));
ch.push(p('Complete one row every time the hosted service is overwritten or republished:'));
ch.push(fillTable(['Date', 'What changed', 'Republished by', 'Re-shared Public? (Y/N)', 'Anonymous query verified? (Y/N)'], 5, [12, 34, 18, 18, 18], '0E7C66'));
ch.push(pageBreak());

// ================================================================ Application Developer Guide
ch.push(h2('Application Developer Guide'));
ch.push(p('How the two apps are built, where every piece of content lives, and how to edit, verify and deploy safely. Keep a live site open next to your dev server — what is deployed is the reference for "how it should look".'));

ch.push(h3('Quick reference'));
ch.push(
  cardGrid([
    { icon: '▶', title: 'Run it locally', accent: TEAL, lines: [[mono('npm install')], [mono('npm run dev'), plain('   → permit app')], [mono('npm run dev:public'), plain('   → public app')], [plain('No .env needed — a fresh clone just runs.')]] },
    { icon: '✎', title: 'Edit content', accent: PURPLE, lines: [[plain('Nearly everything is JSON, not code:')], [mono('public/profiles/lagrange-permit.json')], [mono('public/profiles/lagrange-public.json')], [plain('Property reference: '), mono('src/config/types.ts')]] },
    { icon: '✓', title: 'Verify', accent: GREEN, lines: [[mono('node scripts/verify-permit-pages.mjs')], [mono('node scripts/verify-basemaps.mjs')], [plain('Then click through the pages you touched.')]] },
    { icon: '⇪', title: 'Deploy', accent: AMBER, lines: [[mono('npm run build')], [mono('git push origin master:main'), plain('  ← not plain push!')], [plain('SWA deploy — see "Build, publish & deploy".')]] },
  ]),
  spacer(),
);
ch.push(
  doDont(
    [
      [plain('Edit profiles ('), mono('*.json'), plain(') for content changes')],
      [plain('Keep '), bold('tab.areaIds'), plain(' exactly as the Village lists lots')],
      [plain('Read '), mono('docs/BACKLOG.md'), plain(' before "fixing" a bug')],
      'Run the verify scripts before showing the Village',
    ],
    [
      'Show pricing anywhere (RATE_TEXT exists — never surface it)',
      'Use the word "decal" in user-visible text',
      'Hardcode field names, lot ids, or copy in components',
      'Add a landing page / layout chooser (removed on purpose)',
    ]
  ),
);

ch.push(h3('Architecture'));
ch.push(
  statStrip([
    { n: '1', label: 'codebase', color: TEAL }, { n: '2', label: 'static apps', color: TEAL },
    { n: '4', label: 'permit pages', color: TEAL }, { n: '0', label: 'servers · logins · databases', color: TEAL },
  ]),
  spacer(60), architecture(), spacer(),
);
ch.push(
  infoTable([
    ['App', 'Who it serves', 'Runs with', 'Live site'],
    ['Permit', '4 permit-type pages', [mono('npm run dev')], [link('mango-cliff-087d26410…', 'https://mango-cliff-087d26410.7.azurestaticapps.net', BODY - 2)]],
    ['Public', 'Visitors — time-based parking', [mono('npm run dev:public')], [link('ashy-mud-0b906db10…', 'https://ashy-mud-0b906db10.7.azurestaticapps.net', BODY - 2)]],
  ], [12, 32, 26, 30], TEAL),
  spacer(),
);
ch.push(...screenshot('public-overview.png', 'The public app — legend categories, consolidated on-street row, and the lot list.'));
ch.push(
  bullet([bold('Stack: '), plain('React 19 · TypeScript · Vite 7 · ArcGIS JS SDK v5 — hooks only, no state library')]),
  bullet([bold('Hidden layouts: '), mono('#/explorer'), plain(' and '), mono('#/directory'), plain(' exist for internal comparison only — nothing links to them')]),
  bullet([bold('Stale copy: '), plain('the nested '), mono('lagrange-parking/'), plain(' folder is an old duplicate — never touch it')]),
);
ch.push(
  infoTable([
    ['Read this…', '…when you need'],
    [[mono('docs/PROJECT-CONTEXT.md')], 'Who the client is, content rules, dated "Current state" block'],
    [[mono('docs/DATA.md')], 'Data pipeline + every known data defect the app works around'],
    [[mono('docs/BACKLOG.md')], 'Open items — check before changing behaviour'],
    [[mono('CLAUDE.md'), plain('  ·  '), mono('DEPLOY.md')], 'Condensed working notes · deploy runbook'],
  ], [35, 65], TEAL),
);

ch.push(h3('Content rules — non-negotiable'));
ch.push(p('From the Village stakeholder (Charity). Easy to violate by accident — check every change against this table.'));
ch.push(
  doDont(
    ['Plain-language guidance: "where you may park"', [plain('Treat '), bold('tab.areaIds'), plain(' as the Village\u2019s verbatim, binding lot list')], 'Keep per-lot cards minimal — the sidebar "What you need to know" is the star', 'Get stakeholder sign-off before adding attribute rows back'],
    ['Pricing — RATE_TEXT / RATE_MONTHLY are populated but banned', '"Decal" — survives only as internal RULETYPE codes', 'Ordinance / legalese text', 'Data-derived lot lists replacing the Village\u2019s list']
  ),
  spacer(),
  warnCallout('Several "bugs" are decisions, not bugs', [p([plain('Lots with empty detail cards, 5 lint errors on main, odd RULETYPE values — all known, with decisions recorded in '), mono('docs/BACKLOG.md'), plain('. Read it before changing behaviour.')])]),
);

ch.push(h3('Common edits — recipes'));
ch.push(p([plain('Every recipe is a JSON edit — no component changes. Dev: save + hard-reload. Production: deploy. Property reference: '), mono('src/config/types.ts'), plain('.')]));
ch.push(p([bold('Change sidebar text on a permit page')]));
ch.push(
  recipe([
    ['File', [mono('lagrange-permit.json')]],
    ['Edit', [plain('Find the tab by '), mono('id'), plain(' → edit '), mono('guide.sections'), plain(' bullets (support nested '), mono('items'), plain(' + '), mono('links'), plain(')')]],
    ['Verify', 'Hard-reload, read the page'],
  ]),
  caption('Example: adding "Effective October 1st, …" to two resident bullets was a one-line edit each.'),
);
ch.push(p([bold('Add / remove a lot on a permit page')]));
ch.push(
  recipe([
    ['File', [mono('lagrange-permit.json'), plain('  →  the tab\u2019s '), mono('areaIds'), plain(' array')]],
    ['Also', 'Update guide text if it names lots ("valid anywhere within Lot 2 and Lot 4")'],
    ['Verify', [mono('node scripts/verify-permit-pages.mjs'), plain(' — every id must resolve')]],
  ]),
  spacer(60),
  warnCallout('The lot must also pass the layer baseWhere', [p([plain('Permit app filter: '), mono("USERCLASS = 'PERMIT'"), plain('. A VISITOR-class lot will be listed but never draw — check with an anonymous query first (see "Data & services").')])]),
  spacer(),
);
ch.push(p([bold('Rename a lot / add a note')]));
ch.push(
  recipe([
    ['Rename', [mono('profile.nameOverrides'), plain(' keyed by AREAID — e.g. '), mono('"VILLAGEHALLPARKINGSTRUCTURE": "VH Garage"')]],
    ['Note', [mono('tab.note'), plain(' (every card) · '), mono('tab.lotNotes'), plain(' (per lot) · '), mono('tab.lotSubzoneNotes'), plain(' (green callout style)')]],
  ]),
  spacer(),
);
ch.push(p([bold('Designated spaces inside a lot')]));
ch.push(p('Two mechanisms — the same lot can use either, per page:'));
ch.push(
  infoTable([
    ['Mechanism', 'What it draws', 'Turned on by'],
    [[bold('Subzones')], 'Resident overnight bands (hosted subzone layer)', [mono('tab.showSubzones: true')]],
    [[bold('Overlay layers')], 'Any filtered polygon (e.g. Lot 5 CBD employee rows)', [mono('overlayLayers[]'), plain(' + '), mono('showForAreaId'), plain(' + '), mono('showForTabIds')]],
  ], [20, 45, 35], GREEN),
  spacer(60),
);
ch.push(...screenshot('resident-lot5-subzones.png', 'Same lot, page 1: Resident Overnight — green subzone bands mark the only spaces valid overnight.'));
ch.push(...screenshot('employees-lot5-overlay.png', 'Same lot, page 2: Employees — the CBD rows overlay draws instead (showForTabIds: ["employees"]).'));
ch.push(
  warnCallout('Absence of green is ambiguous — and it fails quiet', [
    bullet('Only permitted areas were digitized: "no bands" can mean "not permitted" or "not drawn yet" (VH Garage, Lot 15)'),
    bullet('The "park only in the highlighted areas" sentence must stay gated by useSubzoneAreaIds — never show it unconditionally'),
    bullet('If the subzone service stops answering anonymously, every band and note silently disappears (docs/DATA.md §3.6)'),
  ]),
  spacer(),
);
ch.push(p([bold('Public map "Availability / Time limit" text')]));
ch.push(
  recipe([
    ['File', [mono('lagrange-public.json'), plain('  →  '), mono('areaInfo'), plain(' (per-AREAID overrides — NOT the GIS rules)')]],
    ['Edit', [plain('Change the '), mono('timeLimit'), plain(' / '), mono('availability'), plain(' strings')]],
    ['Flag', 'Check whether the hosted ParkingRule table needs the same change'],
  ]),
);
ch.push(...screenshot('public-vh-surface-lot.png', 'Village Hall Surface Lot — these two lines come from profile.areaInfo (e.g. the 3 hr → 4 hr fix, Sept 2026).'));

ch.push(h3('Data & services'));
ch.push(
  infoTable([
    ['Service (services2.arcgis.com/FwavjPsU0K1YB1vX)', 'Contains'],
    [[mono('LaGrange_Parking_Permits/FeatureServer/2')], 'ParkingArea polygons — AREAID, AREANAME, USERCLASS, HAS* flags'],
    [[mono('LaGrange_Parking_Permits/FeatureServer/3')], 'ParkingRule table — RULETYPE, ENFORCE_TEXT, MAXDURATION'],
    [[mono('LaGrange_Overnight_Resident_Subzones/…/0')], 'Designated overnight bands (YES-only digitization)'],
    [[mono('LaGrangeImportantPlaces_ParkingContext_/…/0')], 'Reference polygons — parks, civic, Metra'],
  ], [50, 50], PURPLE),
  spacer(),
);
ch.push(p('Check the data before you edit a profile — any REST query works anonymously:'));
ch.push(...code([
  "node -e 'fetch(\"https://services2.arcgis.com/FwavjPsU0K1YB1vX/arcgis/rest/services/\" +",
  "  \"LaGrange_Parking_Permits/FeatureServer/2/query?where=AREAID=%27LOT4%27\" +",
  "  \"&outFields=AREAID,USERCLASS,HASCBD&returnGeometry=false&f=json\")",
  "  .then(r=>r.json()).then(j=>console.log(JSON.stringify(j.features)))'",
]));
ch.push(p([plain('Anonymous-access check after any republish — must return a count, not an error: '), mono('…/FeatureServer/2/query?where=1=1&returnCountOnly=true&f=json')]));

ch.push(h3('Verify before you show anyone'));
ch.push(
  infoTable([
    ['Command', 'Proves'],
    [[mono('node scripts/verify-permit-pages.mjs')], 'Every lot on every permit page resolves + returns rules (NO RULES warnings = known upstream mislabels)'],
    [[mono('node scripts/verify-basemaps.mjs')], 'Each basemap serves a real tile over La Grange (metadata alone lies)'],
    [[mono('node scripts/inspect-service.mjs')], 'Schema + value distributions'],
    [[mono('npm run lint')], 'Only NEW errors matter — 5 are pre-existing on main'],
  ], [42, 58], AMBER),
  spacer(),
);
ch.push(p([bold('2-minute browser pass')]));
ch.push(...steps([
  'Permit app — open all four pages, click one lot on each',
  'Lot 5 twice: Resident Overnight → green bands · Employees → CBD rows overlay',
  'Public app — click 2–3 lots, sanity-check Availability / Time limit',
]));
ch.push(callout('Expected noise — ignore', [
  bullet('Esri console deprecation warnings (Home/Locate widgets, Polygon.centroid)'),
  bullet('NO RULES on Lot 13 (commuter) and Lot 2 / VH Garage (employees) — upstream; those pages hide rules anyway'),
]));

ch.push(h3('Build, publish & deploy'));
ch.push(
  flow([
    { step: '1 · BUILD', sub: 'npm run build', color: TEAL, monoSub: true },
    { step: '2 · PUSH', sub: 'git push origin master:main', color: PURPLE, monoSub: true },
    { step: '3 · DEPLOY', sub: 'SWA CLI × 2', color: BLUE, monoSub: true },
    { step: '4 · SMOKE TEST', sub: 'live profiles + click-through', color: GREEN },
  ]),
  spacer(),
  warnCallout('Branch gotcha', [p([plain('Local branch is '), mono('master'), plain('; GitHub default is '), mono('main'), plain('. A plain '), mono('git push'), plain(' creates a stray remote branch — always push '), mono('master:main'), plain('.')])]),
  spacer(),
);
ch.push(p([bold('Deploy both SWAs'), plain(' (PowerShell, verified 2026-09-01):')]));
ch.push(...code([
  '$TOKEN = az staticwebapp secrets list -n lagrange-parking-permit -g rg-lagrange-parking `',
  '           --query "properties.apiKey" -o tsv',
  'npx -y "@azure/static-web-apps-cli" deploy ./dist/permit --deployment-token $TOKEN --env production',
  '',
  '$TOKEN = az staticwebapp secrets list -n lagrange-parking-public -g rg-lagrange-parking `',
  '           --query "properties.apiKey" -o tsv',
  'npx -y "@azure/static-web-apps-cli" deploy ./dist/public --deployment-token $TOKEN --env production',
]));
ch.push(...steps([
  [plain('Smoke test: fetch each site\u2019s '), mono('/profiles/*.json'), plain(' and confirm your edits are live')],
  'Click through one permit page and one public lot card',
]));
ch.push(p([plain('Azure: tenant '), bold('Spark by MGP'), plain(' (Community-Essentials.com) · subscription '), bold('Microsoft Azure Sponsorship'), plain(' · resource group '), mono('rg-lagrange-parking'), plain('. Recreate-from-scratch: '), mono('DEPLOY.md'), plain('. CI builds but does not deploy.')]));

ch.push(h3('When something looks broken'));
ch.push(
  infoTable([
    ['Symptom', 'Cause → fix'],
    ['No parking data, console shows {"code":499}', 'Service was republished; sharing reset → re-share Public in AGOL'],
    ['Basemap / aerial blank', [mono('verify-basemaps.mjs'), plain('. GISC_IMAGERY_* 404s over La Grange — use COUNTY_IMAGERY_COOK_2025_Project')]],
    ['All green bands + notes vanished', 'Subzone service stopped answering anonymously — fails quiet (DATA.md §3.6)'],
    ['Lot draws, card is empty', 'Upstream RULETYPE mislabel — known, see BACKLOG.md'],
    ['Lot in areaIds never draws', [plain('Fails '), mono('baseWhere'), plain(' (e.g. USERCLASS=VISITOR on permit app) — query it')]],
    ['profile.branding change does nothing', 'Branding applies only inside the internal Explorer; live look = hardcoded CSS defaults'],
    ['5 lint errors', 'Pre-existing — only chase NEW ones'],
  ], [38, 62], SLATE),
);

// ---- assemble -----------------------------------------------------------------------
const headingStyle = (id, name, size, opts = {}) => ({
  id, name, basedOn: 'Normal', next: 'Normal', quickFormat: true,
  run: { font: HEAD_FONT, size, bold: opts.bold ?? true, color: HEADING_COLOR },
  paragraph: { spacing: { before: opts.before ?? 360, after: 120 }, outlineLevel: opts.level, keepNext: true },
});

const doc = new Document({
  styles: {
    default: { document: { run: { font: BODY_FONT, size: BODY, color: INK } } },
    paragraphStyles: [
      headingStyle('Heading1', 'Heading 1', 40, { level: 0, before: 240 }),
      headingStyle('Heading2', 'Heading 2', 32, { level: 1, before: 480 }),
      headingStyle('Heading3', 'Heading 3', 28, { level: 2, before: 320, bold: false }),
    ],
  },
  numbering: {
    config: [
      { reference: 'bullets', levels: [{ level: 0, format: LevelFormat.BULLET, text: '\u2022', alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: convertInchesToTwip(0.5), hanging: convertInchesToTwip(0.25) } } } }] },
      { reference: 'steps', levels: [{ level: 0, format: LevelFormat.DECIMAL, text: '%1.', alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: convertInchesToTwip(0.5), hanging: convertInchesToTwip(0.25) } } } }] },
    ],
  },
  features: { updateFields: true },
  sections: [{
    // Template page setup: Letter, 1" margins
    properties: { page: { margin: { top: 1440, bottom: 1440, left: 1440, right: 1440, header: 720, footer: 720 } } },
    footers: {
      default: new Footer({ children: [new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [
          new TextRun({ text: 'MGP Inc. — La Grange Parking Permit Maps  |  Page ', font: BODY_FONT, size: 16, color: GRAY }),
          new TextRun({ children: [PageNumber.CURRENT], font: BODY_FONT, size: 16, color: GRAY }),
        ],
      })] }),
    },
    children: ch,
  }],
});

const buf = await Packer.toBuffer(doc);
const target = process.argv[2] ?? new URL('../docs/LaGrange-Parking-Developer-Guide.docx', import.meta.url);
writeFileSync(target, buf);
console.log('Wrote', typeof target === 'string' ? target : target.pathname);
