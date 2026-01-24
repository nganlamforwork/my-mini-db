import type { TreeStructure, Schema, VisualizationStep } from '@/types/database';

export interface TreeCanvasProps {
  treeData: TreeStructure;
  schema?: Schema | null; // Schema for rendering node details
  config?: {
    order?: number;
    pageSize?: number;
    cacheSize?: number;
    walEnabled?: boolean;
  };
  highlightedNodeId?: number | null;
  highlightedKey?: any;
  currentStep?: number;
  onStepComplete?: () => void;
  animationSpeed?: number;
  
  // Playback control props
  isPlaying?: boolean;
  onPlayPause?: () => void;
  onStepForward?: () => void;
  onStepBack?: () => void;
  playbackSpeed?: number;
  onPlaybackSpeedChange?: (speed: number) => void;
  
  // Active step for highlighting
  activeStep?: VisualizationStep;
  steps?: VisualizationStep[]; // Full list of steps for replay
  hasPendingOperation?: boolean;
}

export interface NodePosition {
  id: number;
  x: number;
  y: number;
  targetX: number;
  targetY: number;
  alpha: number;
}
