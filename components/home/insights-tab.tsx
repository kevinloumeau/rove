"use client";

import { TabsContent } from "@/components/ui/tabs";
import { ClosetInsights, InsightsNextStep, InsightsProgress } from "@/components/closet-insights";
import { DeclutterReview } from "@/components/declutter-review";
import { Wishlist } from "@/components/wishlist";
import { declutterCandidates, idleChoices } from "@/lib/declutter";
import { insightStage } from "@/lib/insights-progress";
import { type HomeState } from "@/hooks/use-home";

export function InsightsTab({ home }: { home: HomeState }) {
  const {
    items,
    savedLooks,
    plans,
    todayIso,
    pile,
    keepPiece,
    openPieceFromInsights,
    setActiveTab,
    setOutfitMode,
    addToOutfit,
  } = home;
  const { showRecommendations } = insightStage(items);
  // The let-go review only appears once something has actually sat unworn for the shortest window.
  const showReview = showRecommendations && declutterCandidates(items, todayIso, idleChoices[0]).length > 0;
  return (
    <TabsContent value="insights" className="insights-view">
      <section className="insights-intro">
        <h1>Closet insights</h1>
        <p>What you reach for, what earns its place, and what to try next.</p>
      </section>
      <InsightsNextStep
        items={items}
        savedLookCount={savedLooks.length}
        onGoToCloset={() => setActiveTab("closet")}
        onBuildLook={() => {
          setOutfitMode("canvas");
          setActiveTab("outfits");
        }}
        onStylePiece={(item) => {
          addToOutfit(item.id);
          setOutfitMode("canvas");
          setActiveTab("outfits");
        }}
      />
      <ClosetInsights items={items} onOpenPiece={openPieceFromInsights} />
      <Wishlist items={items} looks={savedLooks} today={todayIso} showGaps={showRecommendations} />
      <DeclutterReview
        items={items}
        today={todayIso}
        pile={pile}
        onKeep={keepPiece}
        onOpenPiece={openPieceFromInsights}
        showReview={showReview}
      />
      <InsightsProgress
        items={items}
        savedLookCount={savedLooks.length}
        plannedDays={
          Object.keys(plans).filter((date) => date >= todayIso && savedLooks.some((look) => look.id === plans[date]))
            .length
        }
      />
    </TabsContent>
  );
}
