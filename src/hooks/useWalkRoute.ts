import { useCallback, useEffect, useRef, useState } from 'react';
import GraphicsLayer from '@arcgis/core/layers/GraphicsLayer.js';
import Graphic from '@arcgis/core/Graphic.js';
import Point from '@arcgis/core/geometry/Point.js';
import SimpleMarkerSymbol from '@arcgis/core/symbols/SimpleMarkerSymbol.js';
import SimpleLineSymbol from '@arcgis/core/symbols/SimpleLineSymbol.js';
import * as route from '@arcgis/core/rest/route.js';
import RouteParameters from '@arcgis/core/rest/support/RouteParameters.js';
import FeatureSet from '@arcgis/core/rest/support/FeatureSet.js';
import TravelMode from '@arcgis/core/rest/support/TravelMode.js';
import * as networkService from '@arcgis/core/rest/networkService.js';
import type MapView from '@arcgis/core/views/MapView.js';
import type { WalkTimeStep, WalkTimeRouteInfo } from '../config/types';

const ROUTE_URL =
  'https://route-api.arcgis.com/arcgis/rest/services/World/Route/NAServer/Route_World';

const startSymbol = new SimpleMarkerSymbol({
  color: [34, 139, 34],
  size: 14,
  outline: { color: [255, 255, 255], width: 2 },
});

const endSymbol = new SimpleMarkerSymbol({
  color: [200, 40, 40],
  size: 14,
  outline: { color: [255, 255, 255], width: 2 },
});

const routeLineSymbol = new SimpleLineSymbol({
  color: [0, 100, 200, 0.8],
  width: 4,
});

export interface WalkRouteState {
  step: WalkTimeStep;
  routeInfo: WalkTimeRouteInfo | null;
  errorMessage: string | null;
  handleMapClick: (mapPoint: Point) => void;
  reset: () => void;
  setDestination: (point: Point) => void;
}

export function useWalkRoute(view: MapView | null, active: boolean): WalkRouteState {
  const [step, setStep] = useState<WalkTimeStep>('set-start');
  const [routeInfo, setRouteInfo] = useState<WalkTimeRouteInfo | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const graphicsLayerRef = useRef<GraphicsLayer | null>(null);
  const startPointRef = useRef<Point | null>(null);
  const presetEndRef = useRef<Point | null>(null);
  const walkTravelModeRef = useRef<TravelMode | null>(null);

  // Create/attach graphics layer after view is ready
  useEffect(() => {
    if (!view) return;
    let removed = false;

    view.when().then(() => {
      if (removed) return;
      if (!graphicsLayerRef.current) {
        graphicsLayerRef.current = new GraphicsLayer({ title: 'Walk Route' });
      }
      const gl = graphicsLayerRef.current;
      if (view.map && !view.map.layers.includes(gl)) {
        view.map.add(gl);
      }
    });

    return () => {
      removed = true;
      const gl = graphicsLayerRef.current;
      if (gl && view.map && view.map.layers.includes(gl)) {
        view.map.remove(gl);
      }
    };
  }, [view]);

  // Toggle visibility with active state
  useEffect(() => {
    if (graphicsLayerRef.current) {
      graphicsLayerRef.current.visible = active;
    }
  }, [active]);

  const walkModeFailedRef = useRef(false);

  // Fetch walking travel mode once
  useEffect(() => {
    if (walkTravelModeRef.current) return;

    networkService.fetchServiceDescription(ROUTE_URL).then((desc) => {
      const modes = desc.supportedTravelModes;
      if (!modes) {
        walkModeFailedRef.current = true;
        return;
      }
      const walkMode = modes.find((m) => m.name === 'Walking Time');
      if (walkMode) {
        walkTravelModeRef.current = walkMode;
        walkModeFailedRef.current = false;
      } else {
        walkModeFailedRef.current = true;
      }
    }).catch(() => {
      walkModeFailedRef.current = true;
    });
  }, []);

  const solveRoute = useCallback((startPt: Point, endPt: Point) => {
    if (!graphicsLayerRef.current) return;
    const gl = graphicsLayerRef.current;

    if (walkModeFailedRef.current && !walkTravelModeRef.current) {
      setErrorMessage('Walking directions are temporarily unavailable. Please try again later.');
      setStep('error');
      return;
    }

    setStep('solving');

    const stops = new FeatureSet({
      features: [
        new Graphic({ geometry: startPt }),
        new Graphic({ geometry: endPt }),
      ],
    });

    const params = new RouteParameters({
      stops,
      returnDirections: false,
      returnRoutes: true,
      ...(walkTravelModeRef.current
        ? { travelMode: walkTravelModeRef.current }
        : {}),
    });

    route
      .solve(ROUTE_URL, params)
      .then((result) => {
        const routeResult = result.routeResults[0]?.route;
        if (routeResult) {
          const routeGraphic = new Graphic({
            geometry: routeResult.geometry,
            symbol: routeLineSymbol,
          });
          // Insert route line below markers
          gl.graphics.splice(0, 0, routeGraphic);

          const attrs = routeResult.attributes as Record<string, number | undefined>;
          const minutes = attrs.Total_WalkTime
            ?? attrs.Total_TravelTime
            ?? 0;
          const miles = attrs.Total_Miles
            ?? (attrs.Total_Kilometers != null ? attrs.Total_Kilometers * 0.621371 : 0);

          setRouteInfo({
            totalMinutes: Math.round(minutes * 10) / 10,
            totalMiles: Math.round(miles * 100) / 100,
          });
          setStep('result');
        } else {
          setErrorMessage('No route found between those points.');
          setStep('error');
        }
      })
      .catch((err) => {
        setErrorMessage(err.message || 'Route calculation failed.');
        setStep('error');
      });
  }, []);

  const reset = useCallback(() => {
    startPointRef.current = null;
    presetEndRef.current = null;
    setStep('set-start');
    setRouteInfo(null);
    setErrorMessage(null);
    if (graphicsLayerRef.current) {
      graphicsLayerRef.current.removeAll();
    }
  }, []);

  // Reset state when deactivated
  useEffect(() => {
    if (!active) {
      startPointRef.current = null;
      presetEndRef.current = null;
      setStep('set-start');
      setRouteInfo(null);
      setErrorMessage(null);
      if (graphicsLayerRef.current) {
        graphicsLayerRef.current.removeAll();
      }
    }
  }, [active]);

  const setDestination = useCallback((point: Point) => {
    if (!graphicsLayerRef.current) return;
    const gl = graphicsLayerRef.current;

    // Reset state
    gl.removeAll();
    setRouteInfo(null);
    setErrorMessage(null);
    startPointRef.current = null;

    // Store preset destination and add end marker
    presetEndRef.current = point;
    const endGraphic = new Graphic({
      geometry: point,
      symbol: endSymbol,
    });
    gl.add(endGraphic);
    setStep('set-start');
  }, []);

  const handleMapClick = useCallback(
    (mapPoint: Point) => {
      if (!graphicsLayerRef.current) return;
      const gl = graphicsLayerRef.current;

      if (step === 'set-start') {
        // If there's no preset end, clear everything; otherwise keep end marker
        if (!presetEndRef.current) {
          gl.removeAll();
        }
        setRouteInfo(null);
        setErrorMessage(null);

        const startGraphic = new Graphic({
          geometry: mapPoint,
          symbol: startSymbol,
        });
        gl.add(startGraphic);
        startPointRef.current = mapPoint;

        // If destination was pre-set, skip to solving immediately
        if (presetEndRef.current) {
          solveRoute(mapPoint, presetEndRef.current);
        } else {
          setStep('set-end');
        }
      } else if (step === 'set-end') {
        if (!startPointRef.current) { reset(); return; }
        const endGraphic = new Graphic({
          geometry: mapPoint,
          symbol: endSymbol,
        });
        gl.add(endGraphic);

        solveRoute(startPointRef.current, mapPoint);
      } else if (step === 'result' || step === 'error') {
        // Clicking again after result/error resets and starts new route
        reset();
      }
    },
    [step, reset, solveRoute]
  );

  return { step, routeInfo, errorMessage, handleMapClick, reset, setDestination };
}
