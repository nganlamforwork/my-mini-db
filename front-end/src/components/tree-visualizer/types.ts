import type { TreeStructure, Schema } from '@/types/database';

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
}

export interface NodePosition {
  id: number;
  x: number;
  y: number;
  targetX: number;
  targetY: number;
  alpha: number;
}
