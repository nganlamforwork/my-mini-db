import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { z } from "zod";

const INIT_MIN = 5;
const INIT_MAX = 100;

const initCountSchema = z.coerce
  .number()
  .refine((n) => !Number.isNaN(n), "Enter a number")
  .int("Must be a whole number")
  .min(INIT_MIN, `Min ${INIT_MIN} items`)
  .max(INIT_MAX, `Max ${INIT_MAX} items`);

interface InitDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onInit: (count: number) => Promise<void>;
  defaultCount?: number;
}

export function InitDialog({
  open,
  onOpenChange,
  onInit,
  defaultCount = 15,
}: InitDialogProps) {
  const [initCount, setInitCount] = useState<number>(defaultCount);
  const [initCountInput, setInitCountInput] = useState<string>(
    String(defaultCount),
  );
  const [initCountError, setInitCountError] = useState<string | null>(null);
  const [initInProgress, setInitInProgress] = useState(false);

  // Reset state when dialog opens
  useEffect(() => {
    if (open) {
      setInitCountInput(String(initCount));
      setInitCountError(null);
    }
  }, [open, initCount]);

  const validateInitCount = (raw: string): number | null => {
    const result = initCountSchema.safeParse(raw);
    if (result.success) return result.data;
    return null;
  };

  const handleInitCountInputChange = (raw: string) => {
    setInitCountInput(raw);
    const result = initCountSchema.safeParse(raw);
    if (result.success) {
      setInitCount(result.data);
      setInitCountError(null);
    } else {
      setInitCountError(result.error.issues[0]?.message ?? "Invalid");
    }
  };

  const handleInitQuickSelect = (value: string) => {
    const n = parseInt(value, 10);
    setInitCount(n);
    setInitCountInput(String(n));
    setInitCountError(null);
  };

  const handleInit = async () => {
    const count = validateInitCount(initCountInput);
    if (count === null) {
      setInitCountError("Enter a number between 5 and 100");
      return;
    }
    setInitInProgress(true);
    setInitCountError(null);
    try {
      await onInit(count);
      onOpenChange(false);
    } finally {
      setInitInProgress(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Initialize with random data</DialogTitle>
          <DialogDescription className="space-y-2 pt-1">
            <span className="block text-destructive font-medium">
              This will reset the tree and add random items. All existing data
              will be lost.
            </span>
            <span className="block text-muted-foreground">
              Choose how many random integer keys (and values) to insert. Keys
              are truly random (not sequential), creating gaps where you can
              insert your own keys or delete existing ones.
            </span>
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="init-count">
              Number of items ({INIT_MIN}–{INIT_MAX})
            </Label>
            <div className="flex gap-2">
              <Input
                id="init-count"
                type="number"
                min={INIT_MIN}
                max={INIT_MAX}
                step={1}
                placeholder={`${INIT_MIN}–${INIT_MAX}`}
                value={initCountInput}
                onChange={(e) => handleInitCountInputChange(e.target.value)}
                className={initCountError ? "border-destructive" : ""}
              />
              <Select
                value={
                  [10, 15, 20, 30, 50].includes(Number(initCountInput))
                    ? initCountInput
                    : "custom"
                }
                onValueChange={(v) => {
                  if (v !== "custom") handleInitQuickSelect(v);
                }}
              >
                <SelectTrigger className="w-[110px] shrink-0">
                  <SelectValue placeholder="Quick" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="custom">Custom</SelectItem>
                  {[10, 15, 20, 30, 50].map((n) => (
                    <SelectItem key={n} value={String(n)}>
                      {n}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {initCountError && (
              <p className="text-sm text-destructive">{initCountError}</p>
            )}
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={initInProgress}
          >
            Cancel
          </Button>
          <Button
            variant="pink"
            onClick={handleInit}
            disabled={
              initInProgress ||
              !!initCountError ||
              validateInitCount(initCountInput) === null
            }
          >
            {initInProgress ? "Initializing…" : "Initialize"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
