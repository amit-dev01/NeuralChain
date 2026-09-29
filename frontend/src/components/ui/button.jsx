import { cva } from "class-variance-authority"
import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-zinc-300 disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default: "bg-zinc-100 text-zinc-900 shadow hover:bg-zinc-100/90",
        destructive: "bg-red-600 text-zinc-100 shadow-sm hover:bg-red-600/90",
        outline: "border border-zinc-700 bg-transparent shadow-sm hover:bg-zinc-800 hover:text-zinc-100 text-zinc-300",
        secondary: "bg-zinc-800 text-zinc-100 shadow-sm hover:bg-zinc-700",
        ghost: "hover:bg-zinc-800 hover:text-zinc-100 text-zinc-400",
        link: "text-zinc-100 underline-offset-4 hover:underline",
        amber: "bg-amber-500 text-zinc-950 shadow hover:bg-amber-400 font-semibold",
      },
      size: {
        default: "h-9 px-4 py-2",
        sm: "h-8 rounded-md px-3 text-xs",
        lg: "h-12 rounded-lg px-8 text-base",
        icon: "h-9 w-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({ className, variant, size, ...props }) {
  return (
    <button
      className={cn(buttonVariants({ variant, size }), className)}
      {...props}
    />
  )
}

export { Button, buttonVariants }
