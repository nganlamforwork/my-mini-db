import React from 'react';
import type { TreeStructure } from '@/types/database';

interface TreeConfigProps {
  config?: {
    order?: number;
    pageSize?: number;
    cacheSize?: number;
    walEnabled?: boolean;
  };
  treeData: TreeStructure;
}

export const TreeConfig: React.FC<TreeConfigProps> = ({ config, treeData }) => {
  if (!config) return null;

  return (
    <div className="absolute top-6 left-6 border border-border p-3 rounded-xl backdrop-blur-md pointer-events-none select-none bg-card/80 z-10">
      <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-2">Tree Configuration</div>
      <div className="space-y-1.5 text-xs">
        {config.order !== undefined && (
          <div className="flex items-center justify-between gap-4">
            <span className="text-muted-foreground">Order:</span>
            <span className="font-mono font-semibold text-foreground">{config.order}</span>
          </div>
        )}
        {config.pageSize !== undefined && (
          <div className="flex items-center justify-between gap-4">
            <span className="text-muted-foreground">Page Size:</span>
            <span className="font-mono font-semibold text-foreground">{config.pageSize} bytes</span>
          </div>
        )}
        {config.cacheSize !== undefined && (
          <div className="flex items-center justify-between gap-4">
            <span className="text-muted-foreground">Cache Size:</span>
            <span className="font-mono font-semibold text-foreground">{config.cacheSize} pages</span>
          </div>
        )}
        {config.walEnabled !== undefined && (
          <div className="flex items-center justify-between gap-4">
            <span className="text-muted-foreground">WAL:</span>
            <span className={`font-semibold ${config.walEnabled ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground'}`}>
              {config.walEnabled ? 'Enabled' : 'Disabled'}
            </span>
          </div>
        )}
        <div className="flex items-center justify-between gap-4 pt-1 border-t border-border">
          <span className="text-muted-foreground">Root Page:</span>
          <span className="font-mono font-semibold text-foreground">#{treeData.rootPage}</span>
        </div>
        <div className="flex items-center justify-between gap-4">
          <span className="text-muted-foreground">Height:</span>
          <span className="font-mono font-semibold text-foreground">{treeData.height}</span>
        </div>
      </div>
    </div>
  );
};
