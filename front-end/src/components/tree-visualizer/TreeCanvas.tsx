/**
 * TreeCanvas Component
 * 
 * @description
 * Main orchestrator component for rendering B+ Tree visualizations on an HTML5 Canvas.
 * Refactored to use modular hooks and components for better maintainability.
 */

import React, { useRef, useState, useEffect } from 'react';
import { NodeDetailDialog } from '../NodeDetailDialog';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '../ui/tooltip';

import type { TreeCanvasProps, NodePosition } from './types';
import { useTreeLayout } from './hooks/useTreeLayout';
import { useTreeInteraction } from './hooks/useTreeInteraction';
import { useTreeRenderer } from './hooks/useTreeRenderer';
import { useTreeExport } from './hooks/useTreeExport';
import { TreeControls } from './components/TreeControls';
import { TreeConfig } from './components/TreeConfig';
import { TreeLegend } from './components/TreeLegend';
import { EmptyTreeMessage } from './components/EmptyTreeMessage';

export const TreeCanvas: React.FC<TreeCanvasProps> = ({ 
  treeData,
  schema,
  config,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const positionsRef = useRef<Map<number, NodePosition>>(new Map());

  // 1. Calculate Layout
  const { layout, isEmptyTree } = useTreeLayout(treeData);

  // 2. Handle Interactions (Camera, Selection, Hover)
  const {
    camera,
    selectedNode,
    // setSelectedNode,
    dialogOpen,
    setDialogOpen,
    hoveredEdge,
    tooltipPosition,
    handleMouseDown,
    handleMouseMove,
    handleWheel,
    handleZoomIn,
    handleZoomOut,
    handleResetView,
    isDragging,
    hoveredNodeRef
  } = useTreeInteraction({
    treeData,
    layout,
    positionsRef,
    containerRef,
    canvasRef
  });

  // 3. Handle Rendering Loop
  useTreeRenderer({
    canvasRef,
    containerRef,
    camera,
    layout,
    positionsRef,
    treeData,
    isEmptyTree,
    hoveredEdge,
    tooltipPosition,
    hoveredNodeRef
  });

  // 4. Handle Export
  const { handleDownloadImage } = useTreeExport({
    layout,
    positionsRef,
    treeData
  });

  // 5. Pattern Background Theme Observer
  const [patternColor, setPatternColor] = useState('#e2e8f0');
  
  useEffect(() => {
    const updatePatternColor = () => {
      const isDark = document.documentElement.classList.contains('dark');
      setPatternColor(isDark ? '#1e293b' : '#e2e8f0');
    }
    
    updatePatternColor();
    const observer = new MutationObserver(updatePatternColor);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class']
    });
    
    return () => observer.disconnect();
  }, []);

  return (
    <TooltipProvider>
      <div 
        ref={containerRef} 
        className="w-full h-full bg-background overflow-hidden cursor-grab active:cursor-grabbing relative"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={() => isDragging.current = false}
        onMouseLeave={() => {
          isDragging.current = false;
          // Note: we can't easily reset hoveredEdge from here without exposing setHoveredEdge
          // But useTreeInteraction handles mouse leave via its own logic if needed, 
          // essentially the mouse leave on div might be redundant if the hook logic covers it.
          // The hook resets dragging. 
        }}
        onWheel={handleWheel}
        style={{ backgroundImage: `radial-gradient(${patternColor} 1px, transparent 1px)`, backgroundSize: '24px 24px' }}
      >
        {isEmptyTree ? (
          <EmptyTreeMessage />
        ) : (
          <>
            <canvas ref={canvasRef} className="absolute inset-0" />
            {/* Edge tooltip */}
            {hoveredEdge && tooltipPosition && (
              <Tooltip open={true}>
                <TooltipTrigger asChild>
                  <div
                    className="absolute pointer-events-none"
                    style={{
                      left: tooltipPosition.x,
                      top: tooltipPosition.y,
                      width: 1,
                      height: 1,
                    }}
                  />
                </TooltipTrigger>
                <TooltipContent
                  side="top"
                  className="font-mono text-xs"
                >
                  {hoveredEdge.tooltipText}
                </TooltipContent>
              </Tooltip>
            )}
          </>
        )}
        
        <TreeConfig config={config} treeData={treeData} />
        <TreeLegend />
        
        <NodeDetailDialog
          node={selectedNode}
          schema={schema}
          isRoot={selectedNode?.pageId === treeData.rootPage}
          open={dialogOpen}
          onOpenChange={setDialogOpen}
        />

        <TreeControls
          onZoomIn={handleZoomIn}
          onZoomOut={handleZoomOut}
          onResetView={handleResetView}
          onDownload={handleDownloadImage}
          zoomLevel={camera.zoom}
        />
      </div>
    </TooltipProvider>
  );
};
