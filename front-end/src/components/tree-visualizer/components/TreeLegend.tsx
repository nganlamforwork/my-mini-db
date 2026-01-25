import React from 'react';
import { Info } from 'lucide-react';

export const TreeLegend: React.FC = () => {
  return (
    <div className="absolute bottom-6 left-6 border border-border p-3 rounded-xl backdrop-blur-md pointer-events-none flex flex-col gap-2">
      <div className="flex items-center gap-3 text-xs mb-2">
        <div className="w-3 h-3 bg-amber-100 dark:bg-amber-900/50 border border-amber-500 dark:border-amber-400 rounded-sm" />
        <span className="text-foreground font-medium">Root Node (can be Leaf or Internal)</span>
      </div>
      <div className="flex items-center gap-3 text-xs mb-2">
        <div className="w-3 h-3 bg-muted border border-border rounded-sm" />
        <span className="text-foreground font-medium">Internal (Index Node)</span>
      </div>
      <div className="flex items-center gap-3 text-xs mb-2">
        <div className="w-3 h-3 bg-emerald-900/50 dark:bg-emerald-900/50 border border-emerald-500 rounded-sm" />
        <span className="text-foreground font-medium">Leaf (Data Node)</span>
      </div>
      <div className="pt-2 border-t border-border flex items-center gap-2 text-xs text-muted-foreground">
        <Info className="h-3 w-3" />
        <span>Click on any node to view details</span>
      </div>
    </div>
  );
};
