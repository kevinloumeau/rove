"use client";

import { ArrowRight, ChartColumn, Lock, WashingMachine, Repeat2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { closetStats, formatMoney } from "@/lib/closet-stats";
import { UNLOCK_WEARS, insightStage, nextStep } from "@/lib/insights-progress";
import { colorSwatch } from "@/lib/local-wardrobe";
import type { WardrobeItem } from "@/lib/wardrobe-types";

function lastWornLabel(date?: string | null) {
  if (!date) return "Not worn yet";
  return `Last worn ${new Date(`${date}T00:00:00`).toLocaleDateString(undefined, { month: "short", day: "numeric" })}`;
}

/** The one thing to do next, always phrased as a step forward. */
export function InsightsNextStep({
  items,
  savedLookCount,
  onGoToCloset,
  onBuildLook,
  onStylePiece,
}: {
  items: WardrobeItem[];
  savedLookCount: number;
  onGoToCloset: () => void;
  onBuildLook: () => void;
  onStylePiece: (item: WardrobeItem) => void;
}) {
  if (!items.length) return null;
  const step = nextStep(items, savedLookCount);
  const { totalWears } = insightStage(items);
  if (step.kind === "log-wears")
    return (
      <section className="insight-card insight-next" aria-labelledby="next-title">
        <p className="insight-eyebrow">Next step</p>
        <h2 id="next-title">
          Log {step.wearsToGo} {step.wearsToGo === 1 ? "wear" : "wears"} to unlock rotation insights
        </h2>
        <p>
          Tap “Wore it today” on what you have on. Rove will start showing what you reach for and what each piece costs
          per wear.
        </p>
        <div
          className="insight-meter"
          role="progressbar"
          aria-label="Wears logged"
          aria-valuemin={0}
          aria-valuemax={UNLOCK_WEARS}
          aria-valuenow={totalWears}
        >
          {Array.from({ length: UNLOCK_WEARS }, (_, index) => (
            <i key={index} className={index < totalWears ? "done" : ""} />
          ))}
          <span>
            {totalWears} of {UNLOCK_WEARS}
          </span>
        </div>
        <Button onClick={onGoToCloset}>
          Log today&apos;s outfit <ArrowRight />
        </Button>
      </section>
    );
  if (step.kind === "save-look")
    return (
      <section className="insight-card insight-next" aria-labelledby="next-title">
        <p className="insight-eyebrow">Next step</p>
        <h2 id="next-title">Save your first look</h2>
        <p>Put a few favorite pieces together so you can plan and repeat them.</p>
        <Button onClick={onBuildLook}>
          Style a look <ArrowRight />
        </Button>
      </section>
    );
  if (step.kind === "first-outing") {
    const piece = items.find((item) => String(item.id) === String(step.piece.id));
    return (
      <section className="insight-card insight-next" aria-labelledby="next-title">
        <p className="insight-eyebrow">Next step</p>
        <h2 id="next-title">Give {step.piece.name} its first outing</h2>
        <p>Build a look around it and see how it fits with what you already wear.</p>
        {piece && (
          <Button onClick={() => onStylePiece(piece)}>
            Style this piece <ArrowRight />
          </Button>
        )}
      </section>
    );
  }
  return (
    <section className="insight-card insight-next" aria-labelledby="next-title">
      <p className="insight-eyebrow">Nice rotation 👏</p>
      <h2 id="next-title">Every piece has been worn</h2>
      <p>Keep logging wears to see cost per wear drop over time.</p>
    </section>
  );
}

/** Closing card: what has been done so far, so the page ends on progress. */
export function InsightsProgress({
  items,
  savedLookCount,
  plannedDays,
}: {
  items: WardrobeItem[];
  savedLookCount: number;
  plannedDays: number;
}) {
  if (!items.length) return null;
  const { totalWears } = insightStage(items);
  const worn = items.filter((item) => (item.wearCount ?? 0) > 0).length;
  return (
    <section className="insight-card insight-progress" aria-labelledby="progress-title">
      <h2 id="progress-title">
        <span aria-hidden>🎉</span> {totalWears ? "Your progress" : "You're set up"}
      </h2>
      <ul>
        <li>
          <strong>{items.length}</strong> {items.length === 1 ? "piece" : "pieces"} in your closet
        </li>
        <li>
          <strong>{savedLookCount}</strong> {savedLookCount === 1 ? "look" : "looks"} saved
        </li>
        <li>
          <strong>{plannedDays}</strong> {plannedDays === 1 ? "day" : "days"} planned ahead
        </li>
        <li>
          <strong>{worn}</strong> of {items.length} worn at least once
        </li>
      </ul>
      <div className="insight-progress-bar" aria-hidden>
        <i style={{ width: `${(worn / items.length) * 100}%` }} />
      </div>
    </section>
  );
}

export function ClosetInsights({
  items,
  onOpenPiece,
}: {
  items: WardrobeItem[];
  onOpenPiece: (item: WardrobeItem) => void;
}) {
  const stats = closetStats(items);
  const { rotationUnlocked } = insightStage(items);
  const largestCategory = stats.byCategory[0]?.[1] ?? 1;

  if (!items.length)
    return (
      <div className="empty-state">
        <ChartColumn />
        <h2>No insights yet</h2>
        <p>Add pieces and log what you wear to see what earns its place.</p>
      </div>
    );

  const pieceRow = (item: WardrobeItem, detail: string) => (
    <li key={item.id}>
      <button onClick={() => onOpenPiece(item)}>
        <img src={item.thumb ?? item.image} alt="" />
        <span>
          <strong>{item.name}</strong>
          <small>{detail}</small>
        </span>
      </button>
    </li>
  );

  return (
    <div className="insights-grid">
      <section className="insight-card insight-totals" aria-label="Closet totals">
        <div>
          <strong>{stats.pieceCount}</strong>
          <span>{stats.pieceCount === 1 ? "piece" : "pieces"}</span>
        </div>
        <div>
          <strong>{stats.totalWears}</strong>
          <span>{stats.totalWears === 1 ? "wear logged" : "wears logged"}</span>
        </div>
        {stats.pricedCount ? (
          <div>
            <strong>{formatMoney(stats.totalValue)}</strong>
            <span>closet value</span>
          </div>
        ) : (
          <div className="insight-hint">
            <span>Add prices when you edit pieces to see your closet&apos;s value.</span>
          </div>
        )}
        {rotationUnlocked && stats.averageCostPerWear !== null ? (
          <div>
            <strong>{formatMoney(stats.averageCostPerWear)}</strong>
            <span>avg. cost per wear</span>
          </div>
        ) : null}
      </section>
      {rotationUnlocked ? (
        <>
          <section className="insight-card">
            <h2>
              <Repeat2 /> Most worn
            </h2>
            {stats.mostWorn.length ? (
              <ul className="insight-pieces">
                {stats.mostWorn.map((item) =>
                  pieceRow(item, `${item.wearCount} ${item.wearCount === 1 ? "wear" : "wears"}`),
                )}
              </ul>
            ) : (
              <p className="insight-empty">Tap “Wore it today” on a piece to start counting.</p>
            )}
          </section>
          <section className="insight-card">
            <h2>
              <Sparkles /> Ready for an outing
            </h2>
            {stats.neverWorn.length ? (
              <ul className="insight-pieces">
                {stats.neverWorn.slice(0, 6).map((item) => pieceRow(item, lastWornLabel(item.lastWorn)))}
              </ul>
            ) : (
              <p className="insight-empty">Every piece has been worn at least once.</p>
            )}
            {stats.neverWorn.length > 6 && <p className="insight-more">+{stats.neverWorn.length - 6} more</p>}
          </section>
        </>
      ) : (
        <section className="insight-card insight-locked">
          <h2>
            <Lock /> Rotation insights
          </h2>
          <p className="insight-empty">
            Most worn, waiting to be worn and cost per wear appear after {UNLOCK_WEARS} logged wears.
          </p>
        </section>
      )}
      <section className="insight-card">
        <h2>
          <ChartColumn /> By category
        </h2>
        <ul className="insight-bars">
          {stats.byCategory.map(([category, count]) => (
            <li key={category}>
              <span>{category}</span>
              <i style={{ width: `${(count / largestCategory) * 100}%` }} />
              <b>{count}</b>
            </li>
          ))}
        </ul>
      </section>
      <section className="insight-card">
        <h2>Colors</h2>
        <ul className="insight-colors">
          {stats.byColor.map(([color, count]) => (
            <li key={color}>
              <i style={{ background: colorSwatch(color) }} />
              <span>{color}</span>
              <b>{count}</b>
            </li>
          ))}
        </ul>
      </section>
      <section className="insight-card">
        <h2>
          <WashingMachine /> In the wash
        </h2>
        {stats.inLaundry.length ? (
          <ul className="insight-pieces">{stats.inLaundry.map((item) => pieceRow(item, item.category))}</ul>
        ) : (
          <p className="insight-empty">Nothing in the wash right now.</p>
        )}
      </section>
    </div>
  );
}
