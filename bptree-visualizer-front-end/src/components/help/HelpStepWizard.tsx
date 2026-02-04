import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { ArrowRight, ArrowLeft, RotateCcw, Layers } from 'lucide-react';
import { cn } from '@/lib/utils';

interface HelpStepWizardProps {
  steps: React.ReactNode[];
  showAllClassName?: string;
  className?: string;
  defaultShowAll?: boolean;
}

export const HelpStepWizard: React.FC<HelpStepWizardProps> = ({ 
  steps, 
  showAllClassName = "grid grid-cols-1 gap-8",
  className,
  defaultShowAll = true
}) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [showAll, setShowAll] = useState(defaultShowAll);
  const [isFading, setIsFading] = useState(false);

  // Handle step transition with fade
  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setIsFading(true);
      setTimeout(() => {
        setCurrentStep(prev => prev + 1);
        setIsFading(false);
      }, 200);
    }
  };

  const handlePrev = () => {
    if (currentStep > 0) {
      setIsFading(true);
      setTimeout(() => {
        setCurrentStep(prev => prev - 1);
        setIsFading(false);
      }, 200);
    }
  };

  const handleReset = () => {
    setIsFading(true);
    setTimeout(() => {
      setCurrentStep(0);
      setIsFading(false);
    }, 200);
  };

  const toggleShowAll = () => {
    setShowAll(prev => !prev);
  };

  if (showAll) {
    return (
      <div className={cn("space-y-4", className)}>
        <div className="flex justify-end mb-4">
           <Button variant="outline" size="sm" onClick={toggleShowAll} className="gap-2">
             <Layers className="h-4 w-4" />
             Show Step-by-Step
           </Button>
        </div>
        <div className={showAllClassName}>
          {steps.map((step, idx) => (
             <React.Fragment key={idx}>
               {step}
             </React.Fragment>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className={cn("flex flex-col h-full", className)}>
       {/* Controls */}
       <div className="flex items-center justify-between mb-2 shrink-0 bg-muted/20 p-2 rounded-lg border">
          <div className="flex items-center gap-2 text-sm text-muted-foreground ml-2">
             <span className="font-semibold text-foreground">Step {currentStep + 1}</span>
             <span>of {steps.length}</span>
          </div>
          
          <div className="flex items-center gap-2">
             <Button variant="ghost" size="sm" onClick={toggleShowAll} title="Show All Steps">
                <Layers className="h-4 w-4" />
             </Button>
             
             <Button 
                variant="outline" 
                size="sm" 
                onClick={handleReset}
                disabled={currentStep === 0}
                className="gap-1 mr-2"
             >
                <RotateCcw className="h-3.5 w-3.5" />
                Reset
             </Button>

             <Button 
                variant="outline" 
                size="sm" 
                onClick={handlePrev} 
                disabled={currentStep === 0}
                className="gap-1"
             >
                <ArrowLeft className="h-3.5 w-3.5" />
                Back
             </Button>

             <Button 
                size="sm" 
                onClick={handleNext} 
                disabled={currentStep === steps.length - 1}
                className="gap-1 min-w-[80px]"
             >
                Next
                <ArrowRight className="h-3.5 w-3.5" />
             </Button>
          </div>
       </div>

       {/* Step Content */}
       <div 
         className={cn(
             "flex-1 transition-opacity duration-200 ease-in-out",
             isFading ? "opacity-0 translate-y-2" : "opacity-100 translate-y-0"
         )}
       >
          {steps[currentStep]}
       </div>
    </div>
  );
};
