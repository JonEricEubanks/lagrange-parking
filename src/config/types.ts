export interface FieldDef {
  field: string;
  label: string;
  format?: 'integer' | 'boolean';
  /** Which section of the detail card this field belongs in. Defaults to 'main'. */
  section?: 'main' | 'detail';
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

export interface AudienceGuideContent {
  /** Plain-language "who can park here" for this group. */
  who?: string;
  /** Optional extra note (e.g. train pass required). */
  note?: string;
  /** Per-audience apply link; falls back to the profile-level `apply`. */
  apply?: ApplyLink;
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

  basemap: {
    tileUrl: string;
    dynamicUrl: string;
    sublayers: Sublayer[];
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
