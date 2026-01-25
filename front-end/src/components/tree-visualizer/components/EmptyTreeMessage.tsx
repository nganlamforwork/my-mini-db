import React from 'react';

export const EmptyTreeMessage: React.FC = () => {
  return (
    <div className="absolute inset-0 flex items-center justify-center">
      <div className="text-center space-y-2 p-8">
        <div className="text-lg font-semibold text-muted-foreground">Empty Tree</div>
        <div className="text-sm text-muted-foreground">This tree has no nodes yet. Add some nodes to see the tree.</div>
      </div>
    </div>
  );
};
