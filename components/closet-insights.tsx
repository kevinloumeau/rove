"use client";

import { ChartColumn, WashingMachine, Repeat2, Sparkles } from "lucide-react";
import { closetStats, formatMoney } from "@/lib/closet-stats";
import { colorSwatch } from "@/lib/local-wardrobe";
import type { WardrobeItem } from "@/lib/wardrobe-types";

function lastWornLabel(date?: string | null) {
  if (!date) return "Never worn";
  return `Last worn ${new Date(`${date}T00:00:00`).toLocaleDateString(undefined, { month: "short", day: "numeric" })}`;
}

export function ClosetInsights({
  items,
  onOpenPiece,
}: {
  items: WardrobeItem[];
  onOpenPiece: (item: WardrobeItem) => void;
}) {
  const stats = closetStats(items);
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
        <img src={item.image} alt="" />
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
        <div>
          <strong>{stats.pricedCount ? formatMoney(stats.totalValue) : "—"}</strong>
          <span>closet value</span>
        </div>
        <div>
          <strong>{stats.averageCostPerWear === null ? "—" : formatMoney(stats.averageCostPerWear)}</strong>
          <span>avg. cost per wear</span>
        </div>
      </section>
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
          <Sparkles /> Waiting to be worn
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
