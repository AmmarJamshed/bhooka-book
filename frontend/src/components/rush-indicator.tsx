"use client";

/** Rush level indicator badge */

import { Clock, TrendingUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { RushInfo } from "@/types";
import { RUSH_COLORS, RUSH_LABELS } from "@/types";

export function RushIndicator({ rush, showDetails = true }: { rush: RushInfo; showDetails?: boolean }) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <Badge className={`border px-3 py-1 text-sm ${RUSH_COLORS[rush.rush_level]}`}>
        <TrendingUp className="mr-1 h-3.5 w-3.5" />
        {RUSH_LABELS[rush.rush_level]} — {rush.rush_percentage}%
      </Badge>
      {showDetails && (
        <>
          <span className="flex items-center gap-1 text-sm text-muted-foreground">
            <Clock className="h-4 w-4" />
            ~{rush.estimated_wait_minutes} min wait
          </span>
          <span className="text-xs text-muted-foreground">
            Confidence: {Math.round(rush.confidence_score * 100)}%
          </span>
        </>
      )}
    </div>
  );
}
