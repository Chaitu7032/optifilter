import React, { useState, useRef, useEffect, MouseEvent } from 'react';
import {
  ZoomIn,
  ZoomOut,
  Maximize2,
  Columns,
  Layers,
  Crosshair,
  RotateCcw,
  Upload,
} from 'lucide-react';

interface ImageViewerProps {
  primaryImage?: string;
  overlayImage?: string;
  splitImage?: string;
  imageDimensions?: { width: number; height: number };
  title?: string;
  className?: string;
  onUpload?: (file: File) => void;
}

export const ImageViewer: React.FC<ImageViewerProps> = ({
  primaryImage,
  overlayImage,
  splitImage,
  imageDimensions,
  title = 'Retinal Canvas',
  className = '',
  onUpload,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  
  // Coordinate readout
  const [hoverCoord, setHoverCoord] = useState<{ x: number; y: number } | null>(null);

  // Overlay opacity (0 to 100)
  const [overlayOpacity, setOverlayOpacity] = useState(85);

  // Split View Mode (Single vs Side-by-Side)
  const [splitMode, setSplitMode] = useState(false);

  // Reset viewport to center and fit
  const handleResetZoom = () => {
    setScale(1);
    setPosition({ x: 0, y: 0 });
  };

  const handleZoom = (delta: number) => {
    setScale((prev) => Math.min(Math.max(0.2, prev + delta), 6.0));
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
      // Relative position inside container
      const mouseX = e.clientX - rect.left - rect.width / 2 - position.x;
      const mouseY = e.clientY - rect.top - rect.height / 2 - position.y;

      // Image natural bounds scaled
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

  return (
    <div className={`flex flex-col bg-white border border-[#DFE4DF] rounded-lg overflow-hidden shadow-2xs ${className}`}>
      {/* Top Toolbar */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-[#DFE4DF] bg-[#F5F6F4]/80 text-xs">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-[#202824]">{title}</span>
          {imageDimensions && (
            <span className="font-mono text-[11px] text-[#69736D] bg-white px-1.5 py-0.5 rounded border border-[#DFE4DF]">
              {imageDimensions.width} × {imageDimensions.height} px
            </span>
          )}
        </div>

        {/* View Controls */}
        <div className="flex items-center gap-1.5">
          {/* Coordinate Readout */}
          <div className="hidden sm:flex items-center gap-1 text-[11px] font-mono text-[#69736D] mr-2 bg-white px-2 py-0.5 rounded border border-[#DFE4DF]">
            <Crosshair className="w-3 h-3 text-[#286B56]" />
            <span>
              {hoverCoord ? `X:${hoverCoord.x} Y:${hoverCoord.y}` : 'X:— Y:—'}
            </span>
          </div>

          {/* Opacity slider when overlay image is active */}
          {overlayImage && !splitMode && (
            <div className="flex items-center gap-1.5 mr-2 bg-white px-2 py-0.5 rounded border border-[#DFE4DF]">
              <Layers className="w-3 h-3 text-[#69736D]" />
              <input
                type="range"
                min="0"
                max="100"
                value={overlayOpacity}
                onChange={(e) => setOverlayOpacity(Number(e.target.value))}
                className="w-16 h-1.5 accent-[#286B56] cursor-pointer"
                title={`Overlay opacity: ${overlayOpacity}%`}
              />
              <span className="font-mono text-[10px] text-[#69736D] w-6 text-right">
                {overlayOpacity}%
              </span>
            </div>
          )}

          {/* Split View Toggle */}
          {splitImage && (
            <button
              onClick={() => setSplitMode(!splitMode)}
              className={`p-1 rounded cursor-pointer transition-colors border ${
                splitMode
                  ? 'bg-[#286B56] text-white border-[#286B56]'
                  : 'bg-white text-[#69736D] hover:text-[#202824] border-[#DFE4DF]'
              }`}
              title="Toggle Side-by-Side Comparison"
            >
              <Columns className="w-3.5 h-3.5" />
            </button>
          )}

          {/* Zoom Controls */}
          <button
            onClick={() => handleZoom(-0.2)}
            className="p-1 bg-white hover:bg-[#F5F6F4] text-[#69736D] hover:text-[#202824] rounded border border-[#DFE4DF] cursor-pointer"
            title="Zoom Out"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>
          <span className="font-mono text-[11px] text-[#69736D] w-10 text-center select-none">
            {Math.round(scale * 100)}%
          </span>
          <button
            onClick={() => handleZoom(0.2)}
            className="p-1 bg-white hover:bg-[#F5F6F4] text-[#69736D] hover:text-[#202824] rounded border border-[#DFE4DF] cursor-pointer"
            title="Zoom In"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={handleResetZoom}
            className="p-1 bg-white hover:bg-[#F5F6F4] text-[#69736D] hover:text-[#202824] rounded border border-[#DFE4DF] cursor-pointer"
            title="Reset Zoom & Center"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Main Interactive Viewport */}
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
        className={`relative flex-1 w-full min-h-[440px] bg-[#121614] flex items-center justify-center overflow-hidden select-none cursor-${
          isDragging ? 'grabbing' : 'grab'
        }`}
      >
        {!primaryImage ? (
          <div className="flex flex-col items-center justify-center text-center p-6 max-w-sm">
            <div className="w-12 h-12 rounded-full bg-[#1c221f] border border-[#2b3530] flex items-center justify-center mb-3 text-[#286B56]">
              <Upload className="w-5 h-5" />
            </div>
            <p className="font-semibold text-sm text-[#DFE4DF]">No Retinal Scan Loaded</p>
            <p className="text-[11px] text-[#A6B4A8] mt-1 leading-relaxed">
              Upload a digital fundus photograph (PNG, JPG, TIFF) to begin deterministic DIP processing.
            </p>
            {onUpload && (
              <label className="mt-4 inline-flex items-center gap-1.5 text-xs font-medium bg-[#286B56] hover:bg-[#205746] text-white px-3.5 py-1.5 rounded-md shadow-xs cursor-pointer transition-colors">
                <Upload className="w-3.5 h-3.5" />
                <span>Upload Fundus Scan</span>
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
        ) : splitMode && splitImage ? (
          /* Side-by-Side Comparison Mode */
          <div
            className="flex items-center gap-2"
            style={{
              transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`,
              transition: isDragging ? 'none' : 'transform 0.05s ease-out',
            }}
          >
            {/* Left: Original Fundus */}
            <div className="relative border border-[#303833] rounded overflow-hidden">
              <img
                src={primaryImage}
                alt="Original Fundus"
                className="max-h-[500px] object-contain pointer-events-none"
                style={{ imageRendering: 'auto' }}
              />
              <span className="absolute top-2 left-2 bg-black/70 backdrop-blur-xs text-white text-[10px] font-mono px-1.5 py-0.5 rounded">
                Original Fundus
              </span>
            </div>

            {/* Right: Processed Segmented Overlay */}
            <div className="relative border border-[#303833] rounded overflow-hidden">
              <img
                src={splitImage}
                alt="Processed Overlay"
                className="max-h-[500px] object-contain pointer-events-none"
                style={{ imageRendering: 'auto' }}
              />
              <span className="absolute top-2 left-2 bg-[#286B56]/90 backdrop-blur-xs text-white text-[10px] font-mono px-1.5 py-0.5 rounded">
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
              src={primaryImage}
              alt="Primary Retinal Layer"
              className="max-h-[520px] object-contain pointer-events-none"
              style={{ imageRendering: 'auto' }}
            />

            {/* Optional Blended Overlay */}
            {overlayImage && (
              <img
                src={overlayImage}
                alt="Segmentation Overlay Layer"
                className="absolute inset-0 w-full h-full object-contain pointer-events-none"
                style={{
                  opacity: overlayOpacity / 100,
                  imageRendering: 'auto',
                }}
              />
            )}
          </div>
        )}

        {/* Legend / Info Pill */}
        {primaryImage && (
          <div className="absolute bottom-2 left-2 bg-black/60 backdrop-blur-xs text-[10px] font-mono text-[#DFE4DF] px-2 py-1 rounded border border-white/10 flex items-center gap-2 pointer-events-none">
            <span>Scroll: Zoom</span>
            <span>•</span>
            <span>Drag: Pan</span>
          </div>
        )}
      </div>
    </div>
  );
};
