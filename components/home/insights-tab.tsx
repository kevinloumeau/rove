"use client";

import { TabsContent } from "@/components/ui/tabs";
import { ClosetInsights } from "@/components/closet-insights";
import { DeclutterReview } from "@/components/declutter-review";
import { ForgottenLooks } from "@/components/forgotten-looks";
import { Wishlist } from "@/components/wishlist";
import { type HomeState } from "@/hooks/use-home";

export function InsightsTab({ home }: { home: HomeState }) {
  const { items, savedLooks, plans, todayIso, pile, keepPiece, openPieceFromInsights, loadLook, planDates } = home;
  return (
    <TabsContent value="insights" className="insights-view">
      <section className="insights-intro">
        <h1>Closet insights</h1>
        <p>What you reach for, what you paid, what&apos;s missing, and what&apos;s waiting for its turn.</p>
      </section>
      <ClosetInsights items={items} onOpenPiece={openPieceFromInsights} />
      <ForgottenLooks
        items={items}
        looks={savedLooks}
        plans={plans}
        today={todayIso}
        onOpenLook={loadLook}
        onPlan={(date, look) =>
          planDates(
            [date],
            look.id,
            `Planned ${look.name} for ${new Date(`${date}T00:00:00`).toLocaleDateString(undefined, { weekday: "long" })}`,
          )
        }
      />
      <Wishlist items={items} looks={savedLooks} today={todayIso} />
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
