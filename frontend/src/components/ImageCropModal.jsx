import { useEffect, useRef, useState } from "react";
import { ZoomIn, ZoomOut, RotateCw, RotateCcw, Check, X, Move, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Modal, Spinner } from "@/components/ui/misc";
import { cn } from "@/lib/utils";

const VIEWPORT_SIZE = 280;
const RADIUS = 130;
const OUTPUT_SIZE = 512;

export default function ImageCropModal({ open, imageSrc, onClose, onConfirm, busy }) {
  const [img, setImg] = useState(null);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [rotation, setRotation] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [previewUrl, setPreviewUrl] = useState("");

  const startPointerRef = useRef({ x: 0, y: 0 });
  const startOffsetRef = useRef({ x: 0, y: 0 });
  const previewCanvasRef = useRef(null);

  // Load image when source changes
  useEffect(() => {
    if (!imageSrc) {
      setImg(null);
      return;
    }
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.onload = () => {
      setImg(image);
      setZoom(1);
      setOffset({ x: 0, y: 0 });
      setRotation(0);
    };
    image.src = imageSrc;
  }, [imageSrc]);

  // Compute base fit scale
  const fitScale = img
    ? Math.max(VIEWPORT_SIZE / img.naturalWidth, VIEWPORT_SIZE / img.naturalHeight)
    : 1;

  // Live mini-preview updater
  useEffect(() => {
    if (!img) return;
    const canvas = previewCanvasRef.current || document.createElement("canvas");
    canvas.width = 120;
    canvas.height = 120;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, 120, 120);

    const R = 120 / VIEWPORT_SIZE;
    ctx.save();
    ctx.beginPath();
    ctx.arc(60, 60, 60, 0, Math.PI * 2);
    ctx.clip();

    ctx.translate(60 + offset.x * R, 60 + offset.y * R);
    ctx.rotate((rotation * Math.PI) / 180);
    ctx.scale(zoom * fitScale * R, zoom * fitScale * R);
    ctx.drawImage(img, -img.naturalWidth / 2, -img.naturalHeight / 2);
    ctx.restore();

    setPreviewUrl(canvas.toDataURL("image/jpeg", 0.85));
  }, [img, zoom, offset, rotation, fitScale]);

  // Pointer drag events
  const onPointerDown = (e) => {
    if (!img || busy) return;
    setDragging(true);
    startPointerRef.current = { x: e.clientX, y: e.clientY };
    startOffsetRef.current = { ...offset };
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e) => {
    if (!dragging || !img) return;
    const dx = e.clientX - startPointerRef.current.x;
    const dy = e.clientY - startPointerRef.current.y;
    setOffset({
      x: startOffsetRef.current.x + dx,
      y: startOffsetRef.current.y + dy,
    });
  };

  const onPointerUp = (e) => {
    if (dragging) {
      setDragging(false);
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {}
    }
  };

  // Wheel zoom
  const onWheel = (e) => {
    e.preventDefault();
    const delta = -e.deltaY * 0.0015;
    setZoom((z) => Math.min(3.5, Math.max(1, parseFloat((z + delta).toFixed(3)))));
  };

  const handleRotate = () => {
    setRotation((r) => (r + 90) % 360);
  };

  const handleReset = () => {
    setZoom(1);
    setOffset({ x: 0, y: 0 });
    setRotation(0);
  };

  const handleApply = () => {
    if (!img || busy) return;
    const canvas = document.createElement("canvas");
    canvas.width = OUTPUT_SIZE;
    canvas.height = OUTPUT_SIZE;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";

    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, OUTPUT_SIZE, OUTPUT_SIZE);

    const R = OUTPUT_SIZE / VIEWPORT_SIZE;
    ctx.translate(OUTPUT_SIZE / 2 + offset.x * R, OUTPUT_SIZE / 2 + offset.y * R);
    ctx.rotate((rotation * Math.PI) / 180);
    ctx.scale(zoom * fitScale * R, zoom * fitScale * R);
    ctx.drawImage(img, -img.naturalWidth / 2, -img.naturalHeight / 2);

    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        const dataUrl = canvas.toDataURL("image/jpeg", 0.92);
        onConfirm(blob, dataUrl);
      },
      "image/jpeg",
      0.92
    );
  };

  if (!open) return null;

  return (
    <Modal open={open} onClose={busy ? undefined : onClose} title="Adjust & Slice Profile Photo">
      <div className="space-y-4">
        <p className="text-xs text-grey">
          Drag to reposition your photo inside the circular slice frame. Use the slider or scroll to zoom.
        </p>

        {/* Viewport & Slice Mask */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-5">
          <div
            className="relative flex items-center justify-center overflow-hidden rounded-2xl bg-charcoal/90 touch-none select-none cursor-grab active:cursor-grabbing border border-line shadow-inner"
            style={{ width: VIEWPORT_SIZE, height: VIEWPORT_SIZE }}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
            onWheel={onWheel}
          >
            {img ? (
              <img
                src={img.src}
                alt="Slice preview"
                draggable={false}
                className="max-w-none pointer-events-none transition-transform duration-75"
                style={{
                  width: `${img.naturalWidth * fitScale}px`,
                  height: `${img.naturalHeight * fitScale}px`,
                  transform: `translate(${offset.x}px, ${offset.y}px) rotate(${rotation}deg) scale(${zoom})`,
                  transformOrigin: "center center",
                }}
              />
            ) : (
              <Spinner className="text-white" />
            )}

            {/* SVG Circular Slice Overlay */}
            <svg
              className="absolute inset-0 h-full w-full pointer-events-none"
              viewBox={`0 0 ${VIEWPORT_SIZE} ${VIEWPORT_SIZE}`}
            >
              <defs>
                <mask id="avatar-crop-mask">
                  <rect width={VIEWPORT_SIZE} height={VIEWPORT_SIZE} fill="white" />
                  <circle cx={VIEWPORT_SIZE / 2} cy={VIEWPORT_SIZE / 2} r={RADIUS} fill="black" />
                </mask>
              </defs>
              {/* Darkened area outside the crop circle */}
              <rect
                width={VIEWPORT_SIZE}
                height={VIEWPORT_SIZE}
                fill="rgba(24, 38, 33, 0.72)"
                mask="url(#avatar-crop-mask)"
              />
              {/* Clean ring border around aperture */}
              <circle
                cx={VIEWPORT_SIZE / 2}
                cy={VIEWPORT_SIZE / 2}
                r={RADIUS}
                fill="none"
                stroke="rgba(255, 255, 255, 0.85)"
                strokeWidth="2"
                strokeDasharray={dragging ? "6 3" : "none"}
              />

              {/* Rule of thirds alignment grid when dragging */}
              {dragging && (
                <g stroke="rgba(255, 255, 255, 0.25)" strokeWidth="1">
                  <line
                    x1={VIEWPORT_SIZE / 2 - RADIUS / 3}
                    y1={VIEWPORT_SIZE / 2 - RADIUS + 10}
                    x2={VIEWPORT_SIZE / 2 - RADIUS / 3}
                    y2={VIEWPORT_SIZE / 2 + RADIUS - 10}
                  />
                  <line
                    x1={VIEWPORT_SIZE / 2 + RADIUS / 3}
                    y1={VIEWPORT_SIZE / 2 - RADIUS + 10}
                    x2={VIEWPORT_SIZE / 2 + RADIUS / 3}
                    y2={VIEWPORT_SIZE / 2 + RADIUS - 10}
                  />
                  <line
                    x1={VIEWPORT_SIZE / 2 - RADIUS + 10}
                    y1={VIEWPORT_SIZE / 2 - RADIUS / 3}
                    x2={VIEWPORT_SIZE / 2 + RADIUS - 10}
                    y2={VIEWPORT_SIZE / 2 - RADIUS / 3}
                  />
                  <line
                    x1={VIEWPORT_SIZE / 2 - RADIUS + 10}
                    y1={VIEWPORT_SIZE / 2 + RADIUS / 3}
                    x2={VIEWPORT_SIZE / 2 + RADIUS - 10}
                    y2={VIEWPORT_SIZE / 2 + RADIUS / 3}
                  />
                </g>
              )}
            </svg>

            <span className="absolute bottom-2 left-2 flex items-center gap-1 rounded-md bg-black/60 px-2 py-0.5 text-[10px] font-semibold text-white/90 backdrop-blur pointer-events-none">
              <Move size={10} /> Drag to adjust
            </span>
          </div>

          {/* Real-time Preview Pill */}
          <div className="flex flex-row sm:flex-col items-center gap-3 rounded-2xl border border-line bg-ivory/60 p-4">
            <p className="text-xs font-bold text-forest">Slice Result</p>
            <div className="h-20 w-20 overflow-hidden rounded-full ring-4 ring-forest/20 shadow-md bg-white">
              {previewUrl && (
                <img src={previewUrl} alt="Avatar slice preview" className="h-full w-full object-cover" />
              )}
            </div>
            <p className="text-[11px] text-grey text-center max-w-[100px]">How it appears on your profile</p>
          </div>
        </div>

        {/* Controls: Zoom & Tools */}
        <div className="rounded-2xl border border-line bg-ivory/40 p-3 space-y-3">
          {/* Zoom Slider */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setZoom((z) => Math.max(1, parseFloat((z - 0.2).toFixed(2))))}
              className="rounded-lg p-1 text-grey hover:bg-black/5 hover:text-forest"
              aria-label="Zoom out"
              disabled={zoom <= 1}
            >
              <ZoomOut size={18} />
            </button>
            <input
              type="range"
              min="1"
              max="3"
              step="0.02"
              value={zoom}
              onChange={(e) => setZoom(parseFloat(e.target.value))}
              className="flex-1 accent-[#28765a] cursor-pointer"
              aria-label="Zoom slice slider"
            />
            <button
              type="button"
              onClick={() => setZoom((z) => Math.min(3, parseFloat((z + 0.2).toFixed(2))))}
              className="rounded-lg p-1 text-grey hover:bg-black/5 hover:text-forest"
              aria-label="Zoom in"
              disabled={zoom >= 3}
            >
              <ZoomIn size={18} />
            </button>
            <span className="w-12 text-right text-xs font-mono font-bold text-forest">
              {Math.round(zoom * 100)}%
            </span>
          </div>

          {/* Quick Buttons */}
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line/60 pt-2 text-xs">
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={handleRotate}
                className="inline-flex items-center gap-1 rounded-lg border border-line bg-white px-2.5 py-1.5 font-semibold text-forest hover:bg-ivory"
              >
                <RotateCw size={13} /> Rotate 90°
              </button>
              <button
                type="button"
                onClick={handleReset}
                className="inline-flex items-center gap-1 rounded-lg border border-line bg-white px-2.5 py-1.5 font-semibold text-grey hover:text-forest hover:bg-ivory"
              >
                <RotateCcw size={13} /> Reset
              </button>
            </div>
            <span className="text-[11px] text-grey">Scroll wheel also zooms</span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex justify-end gap-2 pt-2 border-t border-line">
          <Button type="button" variant="outline" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button type="button" onClick={handleApply} disabled={busy || !img} className="gap-1.5">
            {busy ? (
              <>
                <Spinner className="text-white !h-4 !w-4" /> Saving...
              </>
            ) : (
              <>
                <Check size={16} /> Save & Apply Slice
              </>
            )}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
