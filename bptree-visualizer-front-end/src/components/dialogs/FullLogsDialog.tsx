import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { SystemLog } from "@/components/SystemLog";
import type { LogEntry } from "@/types/database";

interface FullLogsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  logs: LogEntry[];
}

export function FullLogsDialog({
  open,
  onOpenChange,
  logs,
}: FullLogsDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle>System Log (Full View)</DialogTitle>
        </DialogHeader>
        <div className="overflow-y-auto max-h-[70vh]">
          <SystemLog logs={logs} />
        </div>
      </DialogContent>
    </Dialog>
  );
}
