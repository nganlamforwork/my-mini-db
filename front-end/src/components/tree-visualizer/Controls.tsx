/**
 * Controls Component
 *
 * @description
 * UI component providing zoom and download controls for the tree visualization.
 * Displays as a floating control panel in the top-right corner of the canvas.
 *
 * Features:
 * - Zoom in/out buttons
 * - Reset view button (fits tree to viewport)
 * - Download menu (JPG, PNG, SVG formats)
 * - Current zoom level display
 *
 * @usage
 * ```tsx
 * import { Controls } from './Controls';
 *
 * <Controls
 *   camera={{ x: 0, y: 0, zoom: 1.0 }}
 *   onZoomIn={() => setZoom(prev => prev * 1.2)}
 *   onZoomOut={() => setZoom(prev => prev / 1.2)}
 *   onResetView={() => resetCamera()}
 *   onDownloadImage={(format) => handleDownload(format)}
 * />
 * ```
 *
 * @props
 * - camera: Current camera state (position and zoom)
 * - onZoomIn: Callback for zoom in action
 * - onZoomOut: Callback for zoom out action
 * - onResetView: Callback to reset camera to fit tree
 * - onDownloadImage: Callback with format ('jpg' | 'png' | 'svg')
 *
 * @note
 * This is a presentational component. All logic should be handled by parent
 * component (typically TreeCanvas).
 */

import React from "react";
import {
  ZoomIn,
  ZoomOut,
  Download,
  RotateCcw,
  FileImage,
  FileType,
  Image as ImageIcon,
} from "lucide-react";
import { Button } from "../ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";

export interface ControlsProps {
  camera: { x: number; y: number; zoom: number };
  onZoomIn: () => void;
  onZoomOut: () => void;
  onResetView: () => void;
  onDownloadImage: (format: "jpg" | "png" | "svg") => void;
}

export const Controls: React.FC<ControlsProps> = ({
  camera,
  onZoomIn,
  onZoomOut,
  onResetView,
  onDownloadImage,
}) => {
  return (
    <div className="absolute top-6 right-6 flex flex-col items-center gap-2 border border-border p-2 rounded-lg backdrop-blur-md shadow-lg">
      <Button
        variant="ghost"
        size="icon"
        onClick={onZoomIn}
        className="h-8 w-8"
        title="Zoom In"
      >
        <ZoomIn className="h-4 w-4" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        onClick={onZoomOut}
        className="h-8 w-8"
        title="Zoom Out"
      >
        <ZoomOut className="h-4 w-4" />
      </Button>
      <div className="w-full h-px bg-border my-1" />
      <Button
        variant="ghost"
        size="icon"
        onClick={onResetView}
        className="h-8 w-8"
        title="Reset View"
      >
        <RotateCcw className="h-4 w-4" />
      </Button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            title="Download Image"
          >
            <Download className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => onDownloadImage("jpg")}>
            <ImageIcon className="mr-2 h-4 w-4" />
            <span>JPG (with background)</span>
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => onDownloadImage("png")}>
            <FileImage className="mr-2 h-4 w-4" />
            <span>PNG (transparent)</span>
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => onDownloadImage("svg")}>
            <FileType className="mr-2 h-4 w-4" />
            <span>SVG (vector)</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <div className="w-full h-px bg-border my-1" />
      <div className="text-[10px] text-muted-foreground text-center px-2 py-1">
        {Math.round(camera.zoom * 100)}%
      </div>
    </div>
  );
};
