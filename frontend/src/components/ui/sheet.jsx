import * as DialogPrimitive from "@radix-ui/react-dialog"
import { X } from "lucide-react"
import { cn } from "@/lib/utils"

const Sheet = DialogPrimitive.Root
const SheetTrigger = DialogPrimitive.Trigger
const SheetClose = DialogPrimitive.Close

function SheetOverlay({ className, ...props }) {
  return (
    <DialogPrimitive.Overlay
      className={cn(
        "fixed inset-0 z-50 bg-black/60 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
        className
      )}
      {...props}
    />
  )
}

function SheetContent({ side = "right", className, children, ...props }) {
  const sideMap = {
    right:  "inset-y-0 right-0 h-full data-[state=open]:slide-in-from-right data-[state=closed]:slide-out-to-right",
    left:   "inset-y-0 left-0  h-full data-[state=open]:slide-in-from-left  data-[state=closed]:slide-out-to-left",
    top:    "inset-x-0 top-0   w-full data-[state=open]:slide-in-from-top   data-[state=closed]:slide-out-to-top",
    bottom: "inset-x-0 bottom-0 w-full data-[state=open]:slide-in-from-bottom data-[state=closed]:slide-out-to-bottom",
  }
  return (
    <DialogPrimitive.Portal>
      <SheetOverlay />
      <DialogPrimitive.Content
        className={cn(
          "fixed z-50 gap-4 bg-zinc-900 border-zinc-700 shadow-2xl transition ease-in-out data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:duration-200 data-[state=open]:duration-300 flex flex-col",
          side === "right" || side === "left" ? "border-l" : "border-t",
          sideMap[side],
          className
        )}
        {...props}
      >
        {children}
        <DialogPrimitive.Close className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-zinc-950 transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-zinc-300 focus:ring-offset-2 disabled:pointer-events-none">
          <X className="h-4 w-4 text-zinc-400" />
          <span className="sr-only">Close</span>
        </DialogPrimitive.Close>
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  )
}

function SheetHeader({ className, ...props }) {
  return <div className={cn("flex flex-col space-y-1.5 px-6 pt-6 pb-4 border-b border-zinc-800", className)} {...props} />
}

function SheetFooter({ className, ...props }) {
  return <div className={cn("flex items-center gap-2 px-6 py-4 border-t border-zinc-800 mt-auto", className)} {...props} />
}

function SheetTitle({ className, ...props }) {
  return <DialogPrimitive.Title className={cn("text-base font-semibold text-zinc-100", className)} {...props} />
}

function SheetDescription({ className, ...props }) {
  return <DialogPrimitive.Description className={cn("text-sm text-zinc-400", className)} {...props} />
}

export {
  Sheet, SheetTrigger, SheetClose, SheetContent,
  SheetHeader, SheetFooter, SheetTitle, SheetDescription,
}
