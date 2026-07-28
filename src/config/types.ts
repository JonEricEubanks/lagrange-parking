export interface FieldDef {
  field: string;
  label: string;
  format?: 'integer' | 'boolean';
  /** Which section of the detail card this field belongs in. Defaults to 'main'. */
  section?: 'main' | 'detail';
  /**
   * Hide the row when the value is zero. Capacity fields carry 0 for areas that
   * were never inventoried (every on-street permit zone), where "0" reads as
   * "no spaces here" rather than "not counted".
   */
  hideZero?: boolean;
}

export interface SymbologyEntry {
  value: string;
  label: string;
  color: [number, number, number, number];
  tooltip?: string;
}

export interface EffectEntry {
  scale: number;
  value: string;
}

export interface Sublayer {
  id: number;
  title: string;
  visible: boolean;
  /** Service map-layer id to draw from, when it differs from `id`. Lets two
   *  sublayers render the same source layer at different scales/filters (e.g.
   *  collector vs local street labels, both from layer 19). Defaults to `id`. */
  mapLayerId?: number;
  /** Optional server-side filter for this dynamic sublayer (e.g. limit a boundary
   *  layer to one community, or street labels to a road class). */
  definitionExpression?: string;
  /** Hide when zoomed out beyond this scale. Use to reveal local-street labels
   *  only once zoomed in (Google-Maps-style road-class tiering). */
  minScale?: number;
  /** Hide when zoomed in past this scale. */
  maxScale?: number;
}

export interface TabDef {
  id: string;
  label: string;
  enabled: boolean;
  tooltip?: string;
  extent?: {
    xmin: number;
    ymin: number;
    xmax: number;
    ymax: number;
    spatialReference: { wkid: number };
  };
  /** Definition expression applied to the parking-area layer for this audience/tab. */
  where?: string;
  /**
   * Exact list of area ids this page shows, authored by the Village rather than
   * derived from the data. When present it wins over `where` and over the
   * rules-derived audience lookup — "map should only show the following lots"
   * is a policy statement, not something to infer from RULETYPE/PERMITZONE.
   */
  areaIds?: string[];
  /**
   * This permit is only valid in specific spaces inside a lot, so every lot on
   * the page should show a designated-space diagram. Lots without one fall back
   * to `profile.exhibitPlaceholder`.
   */
  expectsDesignatedSpaces?: boolean;
  /**
   * Definition expression applied to the related ParkingRule table when a lot is
   * selected on this tab — so each audience sees only its own rules.
   */
  ruleWhere?: string;
  /** Audience codes this tab represents (e.g. ["COMMUTER","STUDENT"]) — used by the
   *  alternative templates to group/badge lots. See src/config/audience.ts. */
  audience?: string[];
  /** Guidance shown in the left rail for this audience/section. */
  guide?: AudienceGuideContent;
}

export interface ApplyLink {
  label: string;
  url: string;
}

/** One bullet of permit-wide guidance, optionally with nested sub-bullets. */
export interface GuideBullet {
  text: string;
  items?: string[];
}

/** A labelled group of bullets ("Where you can park", "Who's eligible", …). */
export interface GuideSection {
  title: string;
  bullets: GuideBullet[];
}

export interface AudienceGuideContent {
  /** Plain-language "who can park here" for this group. */
  who?: string;
  /** Optional extra note (e.g. train pass required). */
  note?: string;
  /** Per-audience apply link; falls back to the profile-level `apply`. */
  apply?: ApplyLink;
  /**
   * Permit-wide information that applies to every lot on this page, grouped into
   * short labelled sections. Shown in the side panel instead of per-lot detail,
   * which is what permit holders actually need to read.
   */
  sections?: GuideSection[];
  /** Pointer to a sibling permit page (e.g. 24-hr → the overnight designated areas). */
  seeAlso?: { tabId: string; label: string; text?: string };
  /**
   * Parking the Village has approved but that is not in the GIS data yet, so it
   * cannot be drawn. Surfaced as a callout instead of silently missing.
   */
  pending?: { title: string; body: string; image?: string };
}

export type WalkTimeStep = 'set-start' | 'set-end' | 'solving' | 'result' | 'error';

export interface WalkTimeRouteInfo {
  totalMinutes: number;
  totalMiles: number;
}

export interface OverlayLayer {
  url: string;
  title: string;
  color: [number, number, number, number];
  outlineWidth: number;
  fillColor?: [number, number, number, number];
}

/** One category of a reference layer's polygon renderer (alpha 0–1). */
export interface ReferenceCategory {
  value: string;
  fill: [number, number, number, number];
  outline: [number, number, number, number];
}

/**
 * A contextual polygon layer drawn under the parking polygons (e.g. Important
 * Places — parks, civic buildings, the Metra station). Categorized by a field,
 * with optional name labels. Always visible (unlike the scale-limited GISC
 * dynamic sublayers), matching the AGOL web map.
 */
export interface ReferenceLayer {
  url: string;
  title: string;
  opacity?: number;
  /** Field the renderer categorizes on (e.g. category). */
  categoryField: string;
  categories: ReferenceCategory[];
  /** Field used for labels (e.g. name). Omit to draw no labels. */
  labelField?: string;
  labelColor?: [number, number, number, number];
  labelHaloColor?: [number, number, number, number];
  labelSize?: number;
  labelItalic?: boolean;
  /** Hide when zoomed out beyond this scale (omit = always visible). */
  minScale?: number;
  /** Draw labels only once zoomed in past this scale. Keeps place names from
   *  sprawling far outside their polygon at village-wide zooms. */
  labelMinScale?: number;
  /** Truncate labels longer than this many characters (with an ellipsis). */
  labelMaxLength?: number;
}

/** Configuration for the related ParkingRule table (1:many off the parking-area key). */
export interface RelatedRulesConfig {
  url: string;
  /** Field on the related table that joins to the area (e.g. AREAID). */
  keyField: string;
  /** Field used to pick a friendly rule label from `ruleSymbology` (e.g. RULETYPE). */
  labelField: string;
  /** Fields shown for each rule row. */
  display: FieldDef[];
  /** Optional field holding a "buy / apply" URL rendered as a button. */
  purchaseUrlField?: string;
  orderByFields?: string[];
}

/** Field-name mapping so components stay generic across communities. */
export interface LayerFields {
  nameField: string;
  rendererField: string;
  idField?: string;
  spacesField?: string;
  /** Display-name overrides keyed by area id (see ParkingProfile.nameOverrides). */
  nameOverrides?: Record<string, string>;
}

/** A scanned/engineered diagram of the designated spaces inside one lot. */
export interface AreaExhibit {
  image: string;
  caption?: string;
  credit?: string;
}

export interface ParkingProfile {
  id: string;
  title: string;
  community: string;
  lastUpdated?: string;
  /** Whether to expose the walk-time routing feature (needs an ArcGIS API key). */
  enableWalkTime?: boolean;
  /** Heading + body shown in the detail panel before a lot is selected. */
  welcome?: { heading: string; body: string; hint?: string };
  /** Title shown above the legend. */
  legendTitle?: string;
  /** Profile-level "how to apply" link (a tab guide may override it). */
  apply?: ApplyLink;
  /** Heading + sub-heading for the guided-finder audience picker. */
  picker?: {
    heading: string;
    sub?: string;
    /** Overrides the header title on the picker only (inner pages keep `community`). */
    brandTitle?: string;
    /**
     * Hero photo above the choices. Set `src` to show a real image; set only
     * `placeholder` to reserve the space with a labelled box until the Village
     * supplies one.
     */
    image?: { src?: string; alt?: string; placeholder?: string };
  };
  /**
   * Display names the Village wants shown in place of the source AREANAME,
   * keyed by area id (e.g. VILLAGEHALLPARKINGSTRUCTURE → "VH Garage"). Applied
   * to map labels, lists and detail cards so no hosted-data edit is needed.
   */
  nameOverrides?: Record<string, string>;
  /** Designated-space diagrams keyed by area id, shown with that lot's detail. */
  areaExhibits?: Record<string, AreaExhibit>;

  /**
   * Shown in place of an `areaExhibits` entry on pages that opt in via
   * `tab.expectsDesignatedSpaces`, so a lot whose diagram has not arrived yet
   * still reserves the spot rather than silently showing nothing.
   */
  exhibitPlaceholder?: { title: string; text: string };

  layer: {
    url: string;
    itemId: string;
    /** Field holding the display name of each area (e.g. AREANAME). */
    nameField: string;
    /** Field the renderer / legend categorizes on (e.g. PRIMARYRULE). */
    rendererField: string;
    /** Stable id field used to join related rules (e.g. AREAID). */
    idField?: string;
    /** Optional capacity field shown in the list (e.g. MAXSPACES). */
    spacesField?: string;
    /** Always-applied filter for this experience (e.g. USERCLASS = 'PERMIT'). */
    baseWhere?: string;
    opacity: number;
    /** Opacity used while the aerial basemap is on — the imagery has to read
     *  through the polygons for people to orient themselves. */
    imageryOpacity?: number;
    outlineColor: [number, number, number, number];
    outlineWidth: number;
  };

  fields: {
    display: FieldDef[];
  };

  relatedRules?: RelatedRulesConfig;

  symbology: SymbologyEntry[];
  /** Friendly labels for related-rule values (RULETYPE codes → text). */
  ruleSymbology?: SymbologyEntry[];
  effects: EffectEntry[];
  overlayLayers?: OverlayLayer[];
  /** Contextual polygon layers (e.g. Important Places) drawn under the parking polygons. */
  referenceLayers?: ReferenceLayer[];

  basemap: {
    tileUrl: string;
    dynamicUrl: string;
    sublayers: Sublayer[];
    /** Aerial tile service. Present = the map shows a Map/Aerial toggle. */
    imageryUrl?: string;
    /** Label for the aerial option (e.g. "Aerial (2026)"). */
    imageryLabel?: string;
    /** Which basemap the map opens with. Defaults to 'canvas'. */
    default?: 'canvas' | 'imagery';
  };

  extent: {
    xmin: number;
    ymin: number;
    xmax: number;
    ymax: number;
    spatialReference: { wkid: number };
  };

  tabs: TabDef[];

  branding: {
    midnight: string;
    primary: string;
    secondary: string;
    greenGray: string;
    lightGray: string;
    white: string;
    fontHeader: string;
    fontBody: string;
    logo: string;
    mgpLogo: string;
  };

  portal: {
    url: string;
  };
}
