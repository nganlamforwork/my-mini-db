import * as React from "react"
import * as SwitchPrimitives from "@radix-ui/react-switch"
import type { LucideIcon } from "lucide-react"
import { cn } from "@/lib/utils"

interface IconSwitchProps extends React.ComponentPropsWithoutRef<typeof SwitchPrimitives.Root> {
  activeIcon: LucideIcon
  inactiveIcon: LucideIcon
  activeLabel?: string
  inactiveLabel?: string
}

const IconSwitch = React.forwardRef<
  React.ElementRef<typeof SwitchPrimitives.Root>,
  IconSwitchProps
>(({ className, activeIcon: ActiveIcon, inactiveIcon: InactiveIcon, activeLabel, inactiveLabel, checked, ...props }, ref) => {
  // Use controlled or uncontrolled pattern based on checked prop
  const isControlled = checked !== undefined
  const [internalChecked, setInternalChecked] = React.useState(checked ?? false)
  
  const currentChecked = isControlled ? checked : internalChecked

  return (
    <SwitchPrimitives.Root
      className={cn(
        "peer inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:bg-primary data-[state=unchecked]:bg-input",
        className
      )}
      checked={isControlled ? checked : internalChecked}
      onCheckedChange={(newChecked) => {
        if (!isControlled) {
          setInternalChecked(newChecked)
        }
        props.onCheckedChange?.(newChecked)
      }}
      {...props}
      ref={ref}
    >
      <SwitchPrimitives.Thumb
        className={cn(
          "pointer-events-none flex h-5 w-5 items-center justify-center rounded-full bg-background shadow-lg ring-0 transition-transform duration-200 ease-in-out data-[state=checked]:translate-x-5 data-[state=unchecked]:translate-x-0"
        )}
      >
        <div className="flex items-center justify-center h-full w-full relative">
          <div className={cn(
            "absolute inset-0 flex items-center justify-center transition-opacity duration-200 ease-in-out",
            currentChecked ? "opacity-100" : "opacity-0"
          )}>
            <ActiveIcon className="h-3 w-3 text-foreground" />
          </div>
          <div className={cn(
            "absolute inset-0 flex items-center justify-center transition-opacity duration-200 ease-in-out",
            currentChecked ? "opacity-0" : "opacity-100"
          )}>
            <InactiveIcon className="h-3 w-3 text-foreground" />
          </div>
        </div>
      </SwitchPrimitives.Thumb>
    </SwitchPrimitives.Root>
  )
})
IconSwitch.displayName = "IconSwitch"

export { IconSwitch }
