import React, { useState, useRef, useEffect, MouseEvent } from 'react';
import {
  ZoomIn,
  ZoomOut,
  Maximize2,
  Minimize2,
  Layers,
  Crosshair,
  RotateCcw,
  Upload,
  Eye,
} from 'lucide-react';

interface ImageViewerProps {
  primaryImage?: string;
  overlayImage?: string;
  maskImage?: string;
  splitImage?: string;
  imageDimensions?: { width: number; height: number };
  title?: string;
  className?: string;
  trackType?: 'vessels' | 'disc_cup' | 'general';
  onUpload?: (file: File) => void;
}

export const ImageViewer: React.FC<ImageViewerProps> = ({
  primaryImage,
  overlayImage,
  maskImage,
  splitImage,
  imageDimensions,
  title = 'Retinal Canvas',
  className = '',
  trackType = 'general',
  onUpload,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [isFullscreen, setIsFullscreen] = useState(false);
  
  // Coordinate readout
  const [hoverCoord, setHoverCoord] = useState<{ x: number; y: number } | null>(null);

  // Overlay opacity (0 to 100)
  const [overlayOpacity, setOverlayOpacity] = useState(85);

  // View modes: 'overlay' | 'original' | 'mask' | 'split'
  const [viewMode, setViewMode] = useState<'overlay' | 'original' | 'mask' | 'split'>('overlay');

  // Drag over state for dropzone
  const [isDragOver, setIsDragOver] = useState(false);

  // Reset viewport to center and 100%
  const handleResetZoom = () => {
    setScale(1);
    setPosition({ x: 0, y: 0 });
  };

  // Fit to container view
  const handleFitToView = () => {
    if (containerRef.current && imageDimensions && imageDimensions.width > 0) {
      const containerWidth = containerRef.current.clientWidth;
      const containerHeight = containerRef.current.clientHeight;
      const scaleX = (containerWidth - 48) / imageDimensions.width;
      const scaleY = (containerHeight - 48) / imageDimensions.height;
      const bestScale = Math.min(scaleX, scaleY, 1.0);
      setScale(Math.max(0.2, bestScale));
      setPosition({ x: 0, y: 0 });
    } else {
      setScale(0.85);
      setPosition({ x: 0, y: 0 });
    }
  };

  const handleZoom = (delta: number) => {
    setScale((prev) => Math.min(Math.max(0.15, prev + delta), 7.0));
  };

  const handleMouseDown = (e: MouseEvent) => {
    if (e.button !== 0) return; // Left mouse click only
    setIsDragging(true);
    setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y });
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (isDragging) {
      setPosition({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y,
      });
    }

    // Calculate image coordinate readout
    const rect = e.currentTarget.getBoundingClientRect();
    if (imageDimensions && imageDimensions.width > 0) {
      const mouseX = e.clientX - rect.left - rect.width / 2 - position.x;
      const mouseY = e.clientY - rect.top - rect.height / 2 - position.y;

      const imgW = imageDimensions.width * scale;
      const imgH = imageDimensions.height * scale;

      const pxX = Math.round(((mouseX + imgW / 2) / imgW) * imageDimensions.width);
      const pxY = Math.round(((mouseY + imgH / 2) / imgH) * imageDimensions.height);

      if (pxX >= 0 && pxX < imageDimensions.width && pxY >= 0 && pxY < imageDimensions.height) {
        setHoverCoord({ x: pxX, y: pxY });
      } else {
        setHoverCoord(null);
      }
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const zoomFactor = e.deltaY < 0 ? 0.15 : -0.15;
    handleZoom(zoomFactor);
  };

  // Fullscreen toggle
  const toggleFullscreen = () => {
    if (!wrapperRef.current) return;
    if (!document.fullscreenElement) {
      wrapperRef.current.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => {});
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => {});
    }
  };

  useEffect(() => {
    const onFsChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener('fullscreenchange', onFsChange);
    return () => document.removeEventListener('fullscreenchange', onFsChange);
  }, []);

  const activePrimary = viewMode === 'mask' && maskImage ? maskImage : primaryImage;
  const isSplitActive = viewMode === 'split' && (splitImage || overlayImage);
  const showOverlayLayer = viewMode === 'overlay' && overlayImage;

  return (
    <div
      ref={wrapperRef}
      className={`flex flex-col bg-white border border-[#E2E8F0] rounded-xl overflow-hidden shadow-sm transition-all ${className}`}
    >
      {/* Top Scientific Viewport Toolbar */}
      <div className="flex flex-wrap items-center justify-between px-3.5 py-2.5 border-b border-[#E2E8F0] bg-white gap-2 text-xs">
        {/* Title & Dimension Badge */}
        <div className="flex items-center gap-2.5">
          <div className="flex items-center gap-1.5 font-semibold text-[#0F172A]">
            <Eye className="w-4 h-4 text-[#059669]" />
            <span>{title}</span>
          </div>
          {imageDimensions && imageDimensions.width > 0 && (
            <span className="font-mono text-[11px] text-[#475569] bg-[#F8FAFC] px-2 py-0.5 rounded border border-[#E2E8F0]">
              {imageDimensions.width} × {imageDimensions.height} px
            </span>
          )}
        </div>

        {/* Display Mode Segmented Buttons */}
        {primaryImage && (
          <div className="flex items-center bg-[#F1F5F9] p-0.5 rounded-lg border border-[#E2E8F0] text-[11px]">
            <button
              onClick={() => setViewMode('original')}
              className={`px-2.5 py-1 rounded-md font-medium cursor-pointer transition-all ${
                viewMode === 'original'
                  ? 'bg-white text-[#0F172A] shadow-xs font-semibold'
                  : 'text-[#64748B] hover:text-[#0F172A]'
              }`}
            >
              Base Fundus
            </button>
            {maskImage && (
              <button
                onClick={() => setViewMode('mask')}
                className={`px-2.5 py-1 rounded-md font-medium cursor-pointer transition-all ${
                  viewMode === 'mask'
                    ? 'bg-white text-[#0F172A] shadow-xs font-semibold'
                    : 'text-[#64748B] hover:text-[#0F172A]'
                }`}
              >
                Mask
              </button>
            )}
            {overlayImage && (
              <button
                onClick={() => setViewMode('overlay')}
                className={`px-2.5 py-1 rounded-md font-medium cursor-pointer transition-all ${
                  viewMode === 'overlay'
                    ? 'bg-white text-[#059669] border border-[#10B981]/30 shadow-xs font-semibold'
                    : 'text-[#64748B] hover:text-[#0F172A]'
                }`}
              >
                Overlay
              </button>
            )}
            {(splitImage || overlayImage) && (
              <button
                onClick={() => setViewMode('split')}
                className={`px-2.5 py-1 rounded-md font-medium cursor-pointer transition-all ${
                  viewMode === 'split'
                    ? 'bg-white text-[#0284C7] border border-[#0EA5E9]/30 shadow-xs font-semibold'
                    : 'text-[#64748B] hover:text-[#0F172A]'
                }`}
              >
                Side-by-Side
              </button>
            )}
          </div>
        )}

        {/* View Controls & Coordinate HUD */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {/* Real-time Coordinate Readout */}
          <div className="hidden sm:flex items-center gap-1.5 text-[11px] font-mono text-[#475569] mr-1 bg-[#F8FAFC] px-2.5 py-1 rounded-lg border border-[#E2E8F0]">
            <Crosshair className="w-3.5 h-3.5 text-[#059669]" />
            <span>
              {hoverCoord ? `X:${hoverCoord.x}  Y:${hoverCoord.y}` : 'X:—  Y:—'}
            </span>
          </div>

          {/* Opacity slider when overlay is active */}
          {showOverlayLayer && (
            <div className="flex items-center gap-1.5 mr-1 bg-[#F8FAFC] px-2.5 py-1 rounded-lg border border-[#E2E8F0]">
              <Layers className="w-3 h-3 text-[#64748B]" />
              <input
                type="range"
                min="0"
                max="100"
                value={overlayOpacity}
                onChange={(e) => setOverlayOpacity(Number(e.target.value))}
                className="w-16 h-1 accent-[#059669] cursor-pointer"
                title={`Overlay opacity: ${overlayOpacity}%`}
              />
              <span className="font-mono text-[10px] text-[#475569] w-7 text-right">
                {overlayOpacity}%
              </span>
            </div>
          )}

          {/* Zoom In/Out & Reset Controls */}
          <button
            onClick={() => handleZoom(-0.2)}
            className="p-1 bg-[#F8FAFC] hover:bg-white text-[#64748B] hover:text-[#0F172A] rounded-lg border border-[#E2E8F0] cursor-pointer"
            title="Zoom Out (Wheel Down)"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>

          <span className="font-mono text-[11px] text-[#475569] w-12 text-center select-none bg-[#F8FAFC] py-0.5 rounded-lg border border-[#E2E8F0]">
            {Math.round(scale * 100)}%
          </span>

          <button
            onClick={() => handleZoom(0.2)}
            className="p-1 bg-[#F8FAFC] hover:bg-white text-[#64748B] hover:text-[#0F172A] rounded-lg border border-[#E2E8F0] cursor-pointer"
            title="Zoom In (Wheel Up)"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={handleFitToView}
            className="px-2 py-1 bg-[#F8FAFC] hover:bg-white text-[#64748B] hover:text-[#0F172A] rounded-lg border border-[#E2E8F0] text-[11px] cursor-pointer font-medium"
            title="Fit to Viewport"
          >
            Fit
          </button>

          <button
            onClick={handleResetZoom}
            className="p-1 bg-[#F8FAFC] hover:bg-white text-[#64748B] hover:text-[#0F172A] rounded-lg border border-[#E2E8F0] cursor-pointer"
            title="Reset Zoom & Center (100%)"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={toggleFullscreen}
            className="p-1 bg-[#F8FAFC] hover:bg-white text-[#64748B] hover:text-[#0F172A] rounded-lg border border-[#E2E8F0] cursor-pointer"
            title={isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen'}
          >
            {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* Main Interactive Viewport Canvas */}
      <div
        ref={containerRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={() => {
          setIsDragging(false);
          setHoverCoord(null);
        }}
        onWheel={handleWheel}
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragOver(true);
        }}
        onDragLeave={() => setIsDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setIsDragOver(false);
          if (e.dataTransfer.files && e.dataTransfer.files[0] && onUpload) {
            onUpload(e.dataTransfer.files[0]);
          }
        }}
        className={`relative flex-1 w-full min-h-[440px] lg:min-h-[500px] retinal-canvas-grid flex items-center justify-center overflow-hidden select-none border-b border-[#E2E8F0] transition-all cursor-${
          isDragging ? 'grabbing' : 'grab'
        } ${isDragOver ? 'ring-2 ring-inset ring-[#059669]' : ''}`}
      >
        {!primaryImage ? (
          /* Scientific Empty State */
          <div className="flex flex-col items-center justify-center text-center p-8 max-w-md animate-in fade-in duration-200">
            <div className="w-16 h-16 rounded-2xl bg-white/10 backdrop-blur-xs border border-white/20 flex items-center justify-center mb-4 text-[#34D399] shadow-lg">
              <Upload className="w-7 h-7" />
            </div>
            <h3 className="font-semibold text-sm text-white">Retinal Fundus Canvas Awaiting Input</h3>
            <p className="text-xs text-slate-300 mt-1.5 leading-relaxed">
              Drag &amp; drop a fundus photograph (PNG, JPG, TIFF) here, or select an installed research dataset scan to begin deterministic computer vision analysis.
            </p>
            {onUpload && (
              <label className="mt-5 inline-flex items-center gap-2 text-xs font-semibold bg-[#059669] hover:bg-[#047857] text-white px-4 py-2 rounded-lg shadow-md cursor-pointer transition-all hover:scale-[1.02]">
                <Upload className="w-4 h-4" />
                <span>Select Local Fundus File</span>
                <input
                  type="file"
                  accept=".png,.jpg,.jpeg,.tif,.tiff,.bmp"
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      onUpload(e.target.files[0]);
                    }
                  }}
                  className="hidden"
                />
              </label>
            )}
          </div>
        ) : isSplitActive ? (
          /* Side-by-Side Comparison Mode */
          <div
            className="flex items-center gap-4 p-4"
            style={{
              transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`,
              transition: isDragging ? 'none' : 'transform 0.05s ease-out',
            }}
          >
            {/* Left: Original Fundus */}
            <div className="relative border border-white/10 rounded-lg overflow-hidden bg-black shadow-xl">
              <img
                src={primaryImage}
                alt="Original Fundus"
                className="max-h-[500px] object-contain pointer-events-none"
                style={{ imageRendering: 'auto' }}
              />
              <span className="absolute top-2.5 left-2.5 bg-black/80 backdrop-blur-xs text-white text-[10px] font-mono px-2 py-0.5 rounded border border-white/10">
                Original Fundus
              </span>
            </div>

            {/* Right: Processed Segmented Overlay */}
            <div className="relative border border-white/10 rounded-lg overflow-hidden bg-black shadow-xl">
              <img
                src={splitImage || overlayImage}
                alt="Processed Overlay"
                className="max-h-[500px] object-contain pointer-events-none"
                style={{ imageRendering: 'auto' }}
              />
              <span className="absolute top-2.5 left-2.5 bg-[#059669]/90 backdrop-blur-xs text-white text-[10px] font-mono px-2 py-0.5 rounded border border-white/20">
                DIP Segmentation
              </span>
            </div>
          </div>
        ) : (
          /* Single Layer / Opacity Overlay Mode */
          <div
            className="relative"
            style={{
              transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`,
              transition: isDragging ? 'none' : 'transform 0.05s ease-out',
            }}
          >
            {/* Primary Base Image */}
            <img
              src={activePrimary}
              alt="Primary Retinal Layer"
              className="max-h-[520px] object-contain pointer-events-none rounded shadow-2xl"
              style={{ imageRendering: 'auto' }}
            />

            {/* Optional Blended Overlay */}
            {showOverlayLayer && (
              <img
                src={overlayImage}
                alt="Segmentation Overlay Layer"
                className="absolute inset-0 w-full h-full object-contain pointer-events-none rounded"
                style={{
                  opacity: overlayOpacity / 100,
                  imageRendering: 'auto',
                }}
              />
            )}
          </div>
        )}

        {/* Legend Overlay for Track A or Track B */}
        {primaryImage && (
          <div className="absolute top-3 left-3 bg-white/95 backdrop-blur-sm text-[11px] font-mono text-[#0F172A] p-2.5 rounded-lg border border-[#E2E8F0] shadow-sm pointer-events-none flex flex-col gap-1.5">
            {trackType === 'disc_cup' ? (
              <>
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#0284C7] ring-1 ring-sky-300"></span>
                  <span className="font-semibold text-[#0F172A]">Optic Disc (Outer)</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#D97706] ring-1 ring-amber-300"></span>
                  <span className="font-semibold text-[#0F172A]">Optic Cup (Interior)</span>
                </div>
              </>
            ) : trackType === 'vessels' ? (
              <>
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#059669] ring-1 ring-emerald-300"></span>
                  <span className="font-semibold text-[#0F172A]">Segmented Vessels</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#94A3B8]"></span>
                  <span className="text-[#64748B]">Retinal Background</span>
                </div>
              </>
            ) : (
              <div className="text-[#64748B]">Retinal Canvas Active</div>
            )}
          </div>
        )}

        {/* Viewport Nav Controls Legend / Info Pill */}
        {primaryImage && (
          <div className="absolute bottom-3 left-3 bg-white/95 backdrop-blur-sm text-[10px] font-mono text-[#475569] px-2.5 py-1 rounded-md border border-[#E2E8F0] shadow-xs flex items-center gap-2 pointer-events-none">
            <span>Scroll: Zoom</span>
            <span className="text-[#CBD5E1]">•</span>
            <span>Drag: Pan Canvas</span>
          </div>
        )}
      </div>
    </div>
  );
};
