import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Search, Trash2, Edit, ArrowLeftRight, Plus, Maximize2, Minimize2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { InsertHelp } from '@/components/help/InsertHelp';
import { DeleteHelp } from '@/components/help/DeleteHelp';
import { SearchHelp } from '@/components/help/SearchHelp';
import { UpdateHelp } from '@/components/help/UpdateHelp';
import { RangeHelp } from '@/components/help/RangeHelp';

interface OperationHelpDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  operation: 'insert' | 'search' | 'update' | 'delete' | 'range' | null;
}

const operationConfig = {
  search: {
    label: 'Search',
    icon: Search,
    activeColor: 'data-[state=active]:bg-blue-100 data-[state=active]:text-blue-700 dark:data-[state=active]:bg-blue-900/40 dark:data-[state=active]:text-blue-300'
  },
  range: {
    label: 'Range Query',
    icon: ArrowLeftRight, 
    activeColor: 'data-[state=active]:bg-violet-100 data-[state=active]:text-violet-700 dark:data-[state=active]:bg-violet-900/40 dark:data-[state=active]:text-violet-300'
  },
  insert: {
    label: 'Insert',
    icon: Plus,
    activeColor: 'data-[state=active]:bg-emerald-100 data-[state=active]:text-emerald-700 dark:data-[state=active]:bg-emerald-900/40 dark:data-[state=active]:text-emerald-300'
  },
  delete: {
    label: 'Delete',
    icon: Trash2,
    activeColor: 'data-[state=active]:bg-rose-100 data-[state=active]:text-rose-700 dark:data-[state=active]:bg-rose-900/40 dark:data-[state=active]:text-rose-300'
  },
  update: {
    label: 'Update',
    icon: Edit,
    activeColor: 'data-[state=active]:bg-amber-100 data-[state=active]:text-amber-700 dark:data-[state=active]:bg-amber-900/40 dark:data-[state=active]:text-amber-300'
  }
};

export const OperationHelpDialog: React.FC<OperationHelpDialogProps> = ({ open, onOpenChange, operation }) => {
  const [selectedOp, setSelectedOp] = React.useState<'insert' | 'search' | 'update' | 'delete' | 'range'>(operation || 'search');
  const [isFullscreen, setIsFullscreen] = React.useState(false);

  React.useEffect(() => {
    if (operation) {
      // Cast to satisfy TS since operation can be null, but we'll default to search if so
      if (['insert', 'search', 'update', 'delete', 'range'].includes(operation as string)) {
          setSelectedOp(operation as any);
      }
    }
  }, [operation]);

  if (!open) return null;

  const operations: Array<'insert' | 'search' | 'update' | 'delete' | 'range'> = ['search', 'range', 'insert', 'delete', 'update'];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={cn(
        "flex flex-col p-6 gap-0 transition-all duration-300",
        isFullscreen 
          ? "w-screen h-screen max-w-none rounded-none border-0" 
          : "max-w-7xl h-[85vh]"
      )}>
        <DialogHeader className="mb-4 flex-shrink-0 flex-row items-center justify-between space-y-0">
          <DialogTitle className="text-2xl font-bold tracking-tight">Operations Guide</DialogTitle>
          <div className="flex items-center gap-2 pr-8">
             <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsFullscreen(!isFullscreen)}
                className="h-8 w-8 text-muted-foreground hover:text-foreground"
                title={isFullscreen ? "Exit Fullscreen" : "Enter Fullscreen"}
             >
                {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
             </Button>
          </div>
        </DialogHeader>
        
        <Tabs value={selectedOp} onValueChange={(value) => setSelectedOp(value as typeof selectedOp)} className="flex-1 flex flex-col h-full overflow-hidden">
          <TabsList className="grid w-full grid-cols-5 mb-4 flex-shrink-0 h-auto p-1 bg-muted/50">
            {operations.map(op => {
              const config = operationConfig[op];
              const Icon = config.icon;
              return (
                <TabsTrigger 
                  key={op} 
                  value={op} 
                  className={cn(
                    "flex flex-col sm:flex-row items-center justify-center gap-2 py-2.5 h-auto capitalize transition-all duration-200",
                    config.activeColor
                  )}
                >
                  <Icon className="h-4 w-4" />
                  <span>{config.label}</span>
                </TabsTrigger>
              );
            })}
          </TabsList>
          
          <div className="flex-1 overflow-hidden">
            <TabsContent key="search" value="search" className="h-full m-0 data-[state=inactive]:hidden">
              <SearchHelp />
            </TabsContent>

            <TabsContent key="range" value="range" className="h-full m-0 data-[state=inactive]:hidden">
              <RangeHelp />
            </TabsContent>

            <TabsContent key="insert" value="insert" className="h-full m-0 data-[state=inactive]:hidden">
              <InsertHelp />
            </TabsContent>
            
            <TabsContent key="delete" value="delete" className="h-full m-0 data-[state=inactive]:hidden">
              <DeleteHelp />
            </TabsContent>
            
            <TabsContent key="update" value="update" className="h-full m-0 data-[state=inactive]:hidden">
              <UpdateHelp />
            </TabsContent>
          </div>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};
