"use client"

import * as React from "react"
import { Tooltip, Legend, ResponsiveContainer } from "recharts"
import type { ContentType } from "recharts/types/component/Tooltip"
import { cn } from "@/lib/utils"

export const CHART_COLORS = [
  "#3b82f6",
  "#06b6d4",
  "#8b5cf6",
  "#10b981",
  "#f59e0b",
  "#ef4444",
  "#ec4899",
]

export function ChartContainer({
  className,
  children,
  height = 240,
}: {
  className?: string
  children: React.ComponentProps<typeof ResponsiveContainer>["children"]
  height?: number
}) {
  return (
    <div className={cn("w-full", className)} style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        {children}
      </ResponsiveContainer>
    </div>
  )
}

export function ChartTooltipContent({
  active,
  payload,
  label,
}: {
  active?: boolean
  payload?: Array<{ name: string; value: number; color: string; dataKey: string }>
  label?: string
}) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-lg border border-border bg-background px-3 py-2 shadow-md text-xs">
      {label && (
        <p className="mb-1.5 font-medium text-foreground">{label}</p>
      )}
      <div className="space-y-1">
        {payload.map((entry, i) => (
          <div key={i} className="flex items-center gap-2">
            <span
              className="inline-block size-2 rounded-[2px] shrink-0"
              style={{ backgroundColor: entry.color }}
            />
            <span className="text-muted-foreground">{entry.name}</span>
            <span className="ml-auto font-mono font-medium tabular-nums text-foreground">
              {entry.value.toLocaleString()}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

export const ChartTooltip = Tooltip as typeof Tooltip & {
  defaultProps?: Partial<React.ComponentProps<typeof Tooltip>>
}

export const ChartLegend = Legend
