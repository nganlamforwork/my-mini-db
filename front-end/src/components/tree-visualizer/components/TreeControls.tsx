import React from 'react';
import { 
  ZoomIn, 
  ZoomOut, 
  Download, 
  Scan, 
  FileImage, 
  FileType, 
  Image as ImageIcon,
  Play,
  Pause,
  Gauge
} from 'lucide-react';
import { Button } from '../../ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../../ui/dropdown-menu';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '../../ui/tooltip';

interface TreeControlsProps {
  onZoomIn: () => void;
  onZoomOut: () => void;
  onResetView: () => void;
  onDownload: (format: 'jpg' | 'png' | 'svg') => void;
  zoomLevel: number;
  
  // Playback controls (optional for backward compatibility)
  isPlaying?: boolean;
  onPlayPause?: () => void;
  // onStepForward/Back removed
  playbackSpeed?: number;
  onPlaybackSpeedChange?: (speed: number) => void;
  hasPendingOperation?: boolean;
}

export const TreeControls: React.FC<TreeControlsProps> = ({
  onZoomIn,
  onZoomOut,
  onResetView,
  onDownload,
  zoomLevel,
  isPlaying = false,
  onPlayPause,
  // onStepForward/Back removed
  playbackSpeed = 1,
  onPlaybackSpeedChange,
  hasPendingOperation = false,
}) => {
  return (
    <div className="absolute top-6 right-6 flex flex-col items-center gap-2 border border-border p-2 rounded-lg backdrop-blur-md shadow-lg bg-background/80">
      {/* Zoom Controls */}
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
      
      {/* Playback Controls (Only shown if handlers provided) */}
      {onPlayPause && (
        <>
          <TooltipProvider>
             <Tooltip open={hasPendingOperation && !isPlaying}>
               <TooltipTrigger asChild>
                 <Button
                    variant={hasPendingOperation && !isPlaying ? "default" : "ghost"}
                    size="icon"
                    onClick={onPlayPause}
                    className={`h-8 w-8 ${hasPendingOperation && !isPlaying ? "animate-pulse bg-slate-800 dark:bg-blue-600 hover:bg-slate-900 dark:hover:bg-blue-700 text-white" : ""}`}
                    title={isPlaying ? "Pause" : (hasPendingOperation ? "Start Visualization" : "Play")}
                  >
                    {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                  </Button>
               </TooltipTrigger>
               <TooltipContent side="left">
                 <p>{hasPendingOperation ? "Click to Start Visualization" : (isPlaying ? "Pause" : "Play")}</p>
               </TooltipContent>
             </Tooltip>
          </TooltipProvider>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                title={`Speed: ${playbackSpeed}x`}
              >
                <Gauge className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {[0.25, 0.5, 1, 1.5, 2].map(speed => (
                <DropdownMenuItem 
                  key={speed} 
                  onClick={() => onPlaybackSpeedChange?.(speed)}
                  className={playbackSpeed === speed ? "bg-accent" : ""}
                >
                  <span><b>{speed}x</b> Speed</span>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          
          <div className="w-full h-px bg-border my-1" />
        </>
      )}

      {/* View Controls */}
      <Button
        variant="ghost"
        size="icon"
        onClick={onResetView}
        className="h-8 w-8"
        title="Center View"
      >
        <Scan className="h-4 w-4" />
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
          <DropdownMenuItem onClick={() => onDownload('jpg')}>
            <ImageIcon className="mr-2 h-4 w-4" />
            <span>JPG (with background)</span>
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => onDownload('png')}>
            <FileImage className="mr-2 h-4 w-4" />
            <span>PNG (transparent)</span>
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => onDownload('svg')}>
            <FileType className="mr-2 h-4 w-4" />
            <span>SVG (vector)</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      
      <div className="w-full h-px bg-border my-1" />
      <div className="text-[10px] text-muted-foreground text-center px-2 py-1 font-mono">
        {Math.round(zoomLevel * 100)}%
      </div>
    </div>
  );
};
