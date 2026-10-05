"use client";

import { TabsContent } from "@/components/ui/tabs";
import { ClosetInsights } from "@/components/closet-insights";
import { DeclutterReview } from "@/components/declutter-review";
import { type HomeState } from "@/hooks/use-home";

export function InsightsTab({ home }: { home: HomeState }) {
  const { items, todayIso, pile, keepPiece, openPieceFromInsights } = home;
  return (
    <TabsContent value="insights" className="insights-view">
      <section className="insights-intro">
        <h1>Closet insights</h1>
        <p>What you reach for, what you paid, and what&apos;s waiting for its turn.</p>
      </section>
      <ClosetInsights items={items} onOpenPiece={openPieceFromInsights} />
      <DeclutterReview
        items={items}
        today={todayIso}
        pile={pile}
        onKeep={keepPiece}
        onOpenPiece={openPieceFromInsights}
      />
    </TabsContent>
  );
}
