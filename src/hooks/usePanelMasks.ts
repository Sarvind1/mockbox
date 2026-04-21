"use client";

import { useEffect, useRef, useMemo, useCallback } from "react";
import * as THREE from "three";

interface PanelMaskConfig {
  modelName: string;
  zones: string[];
  canvasSize?: number;
}

interface ZoneState {
  color: string | null;
  imageUrl: string | null;
}

interface HighlightState {
  activeZone: string | null;
  selectedZones: string[];
  dropHoverZone: string | null;
}

export function usePanelMasks(config: PanelMaskConfig) {
  const { modelName, zones, canvasSize = 2048 } = config;

  const maskImagesRef = useRef<Map<string, HTMLImageElement>>(new Map());
  // Per-zone mask pixel data for fast UV lookups (getZoneAtUV)
  const maskDataRef = useRef<Map<string, ImageData>>(new Map());
  const artworkCacheRef = useRef<Map<string, HTMLImageElement>>(new Map());
  const loadedCountRef = useRef(0);
  const readyRef = useRef(false);

  // Create canvas + texture once (guarded for SSR)
  const { canvas, texture } = useMemo(() => {
    if (typeof document === "undefined") {
      return { canvas: null as unknown as HTMLCanvasElement, texture: new THREE.CanvasTexture(new ImageData(1, 1) as unknown as HTMLCanvasElement) };
    }
    const c = document.createElement("canvas");
    c.width = canvasSize;
    c.height = canvasSize;
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.wrapS = THREE.ClampToEdgeWrapping;
    tex.wrapT = THREE.ClampToEdgeWrapping;
    tex.minFilter = THREE.LinearMipmapLinearFilter;
    tex.magFilter = THREE.LinearFilter;
    return { canvas: c, texture: tex };
  }, [canvasSize]);

  // Preload all mask PNGs + rasterize to ImageData for UV lookups
  useEffect(() => {
    const maskMap = maskImagesRef.current;
    const dataMap = maskDataRef.current;
    maskMap.clear();
    dataMap.clear();
    loadedCountRef.current = 0;
    readyRef.current = false;

    if (typeof document === "undefined") return;

    const totalMasks = zones.length;
    if (totalMasks === 0) {
      readyRef.current = true;
      return;
    }

    // Scratch canvas for rasterizing mask images to pixel data
    const scratchCanvas = document.createElement("canvas");
    scratchCanvas.width = canvasSize;
    scratchCanvas.height = canvasSize;
    const scratchCtx = scratchCanvas.getContext("2d")!;

    for (const zone of zones) {
      const img = new Image();
      img.crossOrigin = "anonymous";

      const onDone = () => {
        loadedCountRef.current += 1;
        if (loadedCountRef.current >= totalMasks) {
          readyRef.current = true;
          console.log(`[usePanelMasks] All ${totalMasks} masks loaded for ${modelName}`);
        }
      };

      img.onload = () => {
        maskMap.set(zone, img);
        // Rasterize to ImageData for fast alpha sampling in getZoneAtUV
        scratchCtx.clearRect(0, 0, canvasSize, canvasSize);
        scratchCtx.drawImage(img, 0, 0, canvasSize, canvasSize);
        dataMap.set(zone, scratchCtx.getImageData(0, 0, canvasSize, canvasSize));
        onDone();
      };
      img.onerror = () => {
        console.warn(`[usePanelMasks] Failed to load mask: /masks/${modelName}/${zone}.png`);
        onDone();
      };
      img.src = `/masks/${modelName}/${zone}.png`;
    }

    return () => {
      maskMap.clear();
      dataMap.clear();
      loadedCountRef.current = 0;
      readyRef.current = false;
    };
  }, [modelName, zones, canvasSize]);

  const preloadArtwork = useCallback((imageUrl: string): Promise<HTMLImageElement> => {
    const cache = artworkCacheRef.current;
    const cached = cache.get(imageUrl);
    if (cached && cached.complete && cached.naturalWidth > 0) {
      return Promise.resolve(cached);
    }
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        cache.set(imageUrl, img);
        resolve(img);
      };
      img.onerror = () => reject(new Error(`Failed to load artwork: ${imageUrl}`));
      img.src = imageUrl;
    });
  }, []);

  // ── UV-space zone lookup ──
  // Given UV coords from a raycast intersection, sample each zone's mask
  // alpha channel to determine which zone the point falls in.
  const getZoneAtUV = useCallback(
    (u: number, v: number): string | null => {
      if (!readyRef.current) return null;
      const dataMap = maskDataRef.current;

      // UV → pixel coords (same convention as mask generation: Y=0 at top)
      const px = Math.floor(u * (canvasSize - 1));
      const py = Math.floor((1.0 - v) * (canvasSize - 1));

      if (px < 0 || px >= canvasSize || py < 0 || py >= canvasSize) return null;

      const pixelIndex = (py * canvasSize + px) * 4 + 3; // alpha channel

      // Check zones in order — first hit wins.
      // "body_misc" is checked last as a catch-all.
      for (const zone of zones) {
        if (zone === "body_misc") continue;
        const imgData = dataMap.get(zone);
        if (!imgData) continue;
        if (imgData.data[pixelIndex] > 128) return zone;
      }

      // Fallback to body_misc if no specific zone matched
      const miscData = dataMap.get("body_misc");
      if (miscData && miscData.data[pixelIndex] > 128) return "body_misc";

      return null;
    },
    [zones, canvasSize]
  );

  // ── Redraw the shared canvas ──
  // Now also draws selection/active highlights directly into the texture,
  // since there's only one mesh and per-mesh emissive doesn't work.
  const redraw = useCallback(
    async (
      baseColor: string,
      zoneStates: Record<string, ZoneState>,
      highlights?: HighlightState
    ) => {
      if (!readyRef.current || !canvas) return;

      const ctx = canvas.getContext("2d")!;
      const W = canvas.width;
      const H = canvas.height;
      const maskMap = maskImagesRef.current;
      const tex = texture;

      // 1. Fill entire canvas with base body color
      ctx.globalCompositeOperation = "source-over";
      ctx.fillStyle = baseColor;
      ctx.fillRect(0, 0, W, H);

      // 2. For each zone, apply zone-specific color or artwork
      for (const zone of zones) {
        const mask = maskMap.get(zone);
        if (!mask) continue;

        const state = zoneStates[zone];
        if (!state) continue;

        const zoneColor = state.color;
        const artworkUrl = state.imageUrl;

        if (zoneColor && zoneColor !== baseColor) {
          const tmpCanvas = document.createElement("canvas");
          tmpCanvas.width = W;
          tmpCanvas.height = H;
          const tmpCtx = tmpCanvas.getContext("2d")!;
          tmpCtx.drawImage(mask, 0, 0, W, H);
          tmpCtx.globalCompositeOperation = "source-in";
          tmpCtx.fillStyle = zoneColor;
          tmpCtx.fillRect(0, 0, W, H);
          ctx.globalCompositeOperation = "source-over";
          ctx.drawImage(tmpCanvas, 0, 0);
        }

        if (artworkUrl) {
          try {
            const artImg = await preloadArtwork(artworkUrl);
            const tmpCanvas = document.createElement("canvas");
            tmpCanvas.width = W;
            tmpCanvas.height = H;
            const tmpCtx = tmpCanvas.getContext("2d")!;
            tmpCtx.drawImage(mask, 0, 0, W, H);
            tmpCtx.globalCompositeOperation = "source-in";
            tmpCtx.drawImage(artImg, 0, 0, W, H);
            ctx.globalCompositeOperation = "source-over";
            ctx.drawImage(tmpCanvas, 0, 0);
          } catch (err) {
            console.warn(`[usePanelMasks] Failed to load artwork for zone "${zone}":`, err);
          }
        }
      }

      // 3. Draw selection/active highlights into the texture
      if (highlights) {
        const { activeZone, selectedZones, dropHoverZone } = highlights;

        for (const zone of zones) {
          const mask = maskMap.get(zone);
          if (!mask) continue;

          let highlightColor: string | null = null;
          let opacity = 0;

          if (dropHoverZone === zone) {
            highlightColor = "#0066ff";
            opacity = 0.35;
          } else if (activeZone === zone) {
            highlightColor = "#ff3300";
            opacity = 0.30;
          } else if (selectedZones.includes(zone)) {
            highlightColor = "#ff4400";
            opacity = 0.20;
          }

          if (highlightColor && opacity > 0) {
            const tmpCanvas = document.createElement("canvas");
            tmpCanvas.width = W;
            tmpCanvas.height = H;
            const tmpCtx = tmpCanvas.getContext("2d")!;
            tmpCtx.drawImage(mask, 0, 0, W, H);
            tmpCtx.globalCompositeOperation = "source-in";
            tmpCtx.fillStyle = highlightColor;
            tmpCtx.fillRect(0, 0, W, H);
            ctx.globalCompositeOperation = "source-over";
            ctx.globalAlpha = opacity;
            ctx.drawImage(tmpCanvas, 0, 0);
            ctx.globalAlpha = 1;
          }
        }
      }

      ctx.globalCompositeOperation = "source-over";
      // eslint-disable-next-line react-hooks/immutability
      tex.needsUpdate = true;
    },
    [canvas, texture, zones, preloadArtwork]
  );

  return { texture, redraw, ready: readyRef, getZoneAtUV };
}
