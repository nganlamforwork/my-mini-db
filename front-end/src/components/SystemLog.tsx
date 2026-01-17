import React from 'react';
import type { LogEntry } from '@/types/database';

export const SystemLog: React.FC<{ logs: LogEntry[] }> = ({ logs }) => (
  <div className="h-64 border-t border-border bg-muted/30 flex flex-col">
    <div className="p-2 bg-card border-b border-border flex items-center justify-between">
      <h3 className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-2">
        <span className="w-2 h-2 bg-emerald-500 dark:bg-emerald-400 rounded-full animate-pulse" />
        System Terminal
      </h3>
    </div>
    <div className="flex-1 overflow-y-auto p-3 font-mono text-[11px] space-y-1.5">
      {logs.length === 0 ? (
        <div className="text-muted-foreground italic tracking-wider">Waiting for system events...</div>
      ) : (
        logs.map(log => (
          <div key={log.id} className="flex gap-2">
            <span className="text-muted-foreground">[{log.timestamp.toLocaleTimeString()}]</span>
            <span className={
              log.type === 'success' ? 'text-emerald-600 dark:text-emerald-400' : 
              log.type === 'error' ? 'text-destructive' : 
              log.type === 'warning' ? 'text-amber-600 dark:text-amber-400' : 'text-blue-600 dark:text-blue-400'
            }>
              {log.type === 'success' ? '✔' : log.type === 'error' ? '✖' : '>'} {log.message}
            </span>
          </div>
        ))
      )}
      <div className="animate-pulse text-emerald-600 dark:text-emerald-400">_</div>
    </div>
  </div>
);
