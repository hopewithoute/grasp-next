"use client"

import { useTheme } from "next-themes"
import { Toaster as Sonner, type ToasterProps } from "sonner"
import { CircleCheckIcon, InfoIcon, TriangleAlertIcon, OctagonXIcon, Loader2Icon } from "lucide-react"

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme()

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      icons={{
        success: <CircleCheckIcon className="size-4" />,
        info: <InfoIcon className="size-4" />,
        warning: <TriangleAlertIcon className="size-4" />,
        error: <OctagonXIcon className="size-4" />,
        loading: <Loader2Icon className="size-4 animate-spin" />,
      }}
      toastOptions={{
        classNames: {
          toast:
            "group toast font-mono text-xs tracking-widest uppercase rounded-none border px-4 py-3 shadow-none flex items-center",
          default:
            "border-border/40 bg-background/50 text-foreground",
          error:
            "border-status-danger-border bg-status-danger-surface text-status-danger-foreground",
          success:
            "border-status-success-border bg-status-success-surface text-status-success-foreground",
          warning:
            "border-status-warning-border bg-status-warning-surface text-status-warning-foreground",
          info:
            "border-status-info-border bg-status-info-surface text-status-info-foreground",
          description: "text-muted-foreground font-mono text-[0.65rem] tracking-widest uppercase opacity-80",
          actionButton:
            "bg-brand-accent/20 text-brand-accent hover:bg-brand-accent hover:text-background border-none rounded-none font-mono text-[0.65rem] tracking-widest uppercase transition-all px-3 py-1.5",
          cancelButton:
            "bg-muted/20 text-muted-foreground hover:bg-muted hover:text-foreground border-none rounded-none font-mono text-[0.65rem] tracking-widest uppercase transition-all px-3 py-1.5",
          icon: "mr-3 opacity-90",
          title: "font-mono text-xs tracking-widest uppercase",
        },
      }}
      {...props}
    />
  )
}

export { Toaster }
