import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Layers, Network, Maximize2, Minimize2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { OrderHelp } from '@/components/help/OrderHelp';
import { RoutingHelp } from '@/components/help/RoutingHelp';

interface FoundationHelpDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultTab?: 'order' | 'routing';
}

const foundationConfig = {
  order: {
    label: 'Order',
    icon: Layers,
    activeColor: 'data-[state=active]:bg-purple-100 data-[state=active]:text-purple-700 dark:data-[state=active]:bg-purple-900/40 dark:data-[state=active]:text-purple-300'
  },
  routing: {
      label: 'Routing',
      icon: Network,
      activeColor: 'data-[state=active]:bg-cyan-100 data-[state=active]:text-cyan-700 dark:data-[state=active]:bg-cyan-900/40 dark:data-[state=active]:text-cyan-300'
  }
};

export const FoundationHelpDialog: React.FC<FoundationHelpDialogProps> = ({ open, onOpenChange, defaultTab = 'order' }) => {
  const [selectedTab, setSelectedTab] = React.useState<'order' | 'routing'>(defaultTab);
  const [isFullscreen, setIsFullscreen] = React.useState(false);

  React.useEffect(() => {
    setSelectedTab(defaultTab);
  }, [defaultTab]);

  if (!open) return null;

  const tabs: Array<'order' | 'routing'> = ['order', 'routing'];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={cn(
        "flex flex-col p-6 gap-0 transition-all duration-300",
        isFullscreen 
          ? "w-screen h-screen max-w-none rounded-none border-0" 
          : "max-w-4xl h-[85vh]"
      )}>
        <DialogHeader className="mb-4 flex-shrink-0 flex-row items-center justify-between space-y-0">
          <DialogTitle className="text-2xl font-bold tracking-tight">B+Tree Foundations</DialogTitle>
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
        
        <Tabs value={selectedTab} onValueChange={(value) => setSelectedTab(value as typeof selectedTab)} className="flex-1 flex flex-col h-full overflow-hidden">
          <TabsList className="grid w-full grid-cols-2 mb-4 flex-shrink-0 h-auto p-1 bg-muted/50">
            {tabs.map(tab => {
              const config = foundationConfig[tab];
              const Icon = config.icon;
              return (
                <TabsTrigger 
                  key={tab} 
                  value={tab} 
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
            <TabsContent key="order" value="order" className="h-full m-0 data-[state=inactive]:hidden">
              <OrderHelp />
            </TabsContent>

            <TabsContent key="routing" value="routing" className="h-full m-0 data-[state=inactive]:hidden">
              <RoutingHelp />
            </TabsContent>
          </div>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};
