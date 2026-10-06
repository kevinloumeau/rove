"use client";

import { CalendarDays, Check, ChevronLeft, ChevronRight, Luggage, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TabsContent } from "@/components/ui/tabs";
import { OutfitJournal } from "@/components/outfit-journal";
import { occasions, weekdayLabels, sameId, LOOK_DRAG_TYPE, isNarrow, scrollIntoViewSoon } from "@/lib/home-utils";
import { type HomeState } from "@/hooks/use-home";

export function CalendarTab({ home }: { home: HomeState }) {
  const {
    items,
    setActiveTab,
    setSelectedId,
    setDetailSheetOpen,
    dayPanelRef,
    savedLooks,
    calendarMonth,
    selectedDate,
    setSelectedDate,
    occasionFilter,
    setOccasionFilter,
    plans,
    setPlanLookId,
    repeatWeeks,
    setRepeatWeeks,
    calendarView,
    setCalendarView,
    calendarMode,
    setCalendarMode,
    setPackingOpen,
    dropDate,
    selectedWeek,
    filteredLooks,
    plannedLook,
    lookToPlan,
    leadingBlanks,
    monthDates,
    plannedThisMonth,
    todayIso,
    selectedDateLabel,
    updateItem,
    loadLook,
    planSelectedLook,
    lookDropProps,
    shiftWeek,
    lookThumbs,
    removePlan,
    shiftMonth,
    rateDay,
    armedLookId,
    setArmedLookId,
  } = home;
  const armedLook = savedLooks.find((look) => look.id === armedLookId && look.id === lookToPlan);
  const selectedShort = new Date(`${selectedDate}T00:00:00`).toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
  return (
    <TabsContent value="calendar" className="calendar-view">
      <section className="calendar-intro">
        <div>
          <h1>{calendarMode === "plan" ? "Plan your month" : "Outfit journal"}</h1>
          <p>
            {calendarMode === "plan" ? (
              <>
                <span className="pointer-fine">
                  Drag saved looks onto days, repeat them weekly, and pack for trips.
                </span>
                <span className="pointer-coarse">Choose a look, then tap a day.</span>
              </>
            ) : (
              "What you wore each day, with a photo and a note to remember it by."
            )}
          </p>
        </div>
        <div className="view-switch" aria-label="Calendar mode">
          <button className={calendarMode === "plan" ? "active" : ""} onClick={() => setCalendarMode("plan")}>
            Plan
          </button>
          <button className={calendarMode === "journal" ? "active" : ""} onClick={() => setCalendarMode("journal")}>
            Journal
          </button>
        </div>
      </section>
      {calendarMode === "journal" ? (
        <OutfitJournal
          items={items}
          today={todayIso}
          onOpenPiece={(item) => {
            setSelectedId(item.id);
            setActiveTab("closet");
            if (isNarrow(1100)) setDetailSheetOpen(true);
          }}
          onWearChange={(itemId, change) => updateItem(itemId, change)}
          onRate={rateDay}
        />
      ) : (
        <>
          <section className="calendar-intro calendar-occasions">
            <div className="occasion-list">
              {occasions.map((occasion) => (
                <button
                  key={occasion}
                  className={occasionFilter === occasion ? "active" : ""}
                  onClick={() => setOccasionFilter(occasion)}
                >
                  {occasion}
                </button>
              ))}
            </div>
          </section>
          {savedLooks.length > 0 && (
            <div className="plan-looks" role="group" aria-label="Choose a look to plan">
              {filteredLooks.map((look) => (
                <button
                  key={look.id}
                  draggable
                  className={armedLook?.id === look.id ? "active" : ""}
                  onDragStart={(event) => {
                    event.dataTransfer.setData(LOOK_DRAG_TYPE, look.id);
                    event.dataTransfer.effectAllowed = "copy";
                  }}
                  onClick={() => {
                    if (armedLook?.id === look.id) {
                      setArmedLookId(null);
                      return;
                    }
                    setPlanLookId(look.id);
                    setArmedLookId(look.id);
                  }}
                  aria-pressed={armedLook?.id === look.id}
                >
                  {armedLook?.id === look.id && <Check className="plan-look-check" aria-hidden />}
                  <span className="plan-look-thumbs">
                    {lookThumbs(look, 3).map((item) => (
                      <img key={item.id} src={item.thumb ?? item.image} alt="" />
                    ))}
                  </span>
                  <span>{look.name}</span>
                </button>
              ))}
              <p className="plan-looks-hint pointer-fine">Drag a look onto a day, or click one</p>
            </div>
          )}
          <div className="calendar-workspace" data-view={calendarView}>
            <section className="month-panel">
              <div className="calendar-view-switch view-switch" aria-label="Calendar view">
                <button
                  className={calendarView !== "month" ? "week-active" : ""}
                  aria-pressed={calendarView === "week"}
                  onClick={() => setCalendarView("week")}
                >
                  Week
                </button>
                <button
                  className={calendarView !== "week" ? "month-active" : ""}
                  aria-pressed={calendarView === "month"}
                  onClick={() => setCalendarView("month")}
                >
                  Month
                </button>
              </div>
              <div className="week-panel">
                <div className="month-nav">
                  <button aria-label="Previous week" onClick={() => shiftWeek(-1)}>
                    <ChevronLeft />
                  </button>
                  <h2>
                    {new Date(`${selectedWeek[0]}T00:00:00`).toLocaleDateString(undefined, {
                      month: "short",
                      day: "numeric",
                    })}
                    {" – "}
                    {new Date(`${selectedWeek[6]}T00:00:00`).toLocaleDateString(undefined, {
                      month: "short",
                      day: "numeric",
                    })}
                  </h2>
                  <button aria-label="Next week" onClick={() => shiftWeek(1)}>
                    <ChevronRight />
                  </button>
                </div>
                <ol className="week-list">
                  {selectedWeek.map((date) => {
                    const look = savedLooks.find((candidate) => candidate.id === plans[date]);
                    const day = new Date(`${date}T00:00:00`);
                    return (
                      <li key={date}>
                        <button
                          className={`${selectedDate === date ? "selected" : ""} ${date === todayIso ? "today" : ""} ${dropDate === date ? "drop-target" : ""}`}
                          aria-current={selectedDate === date ? "true" : undefined}
                          onClick={() => {
                            setSelectedDate(date);
                            // While a look is chosen, the sticky Plan bar confirms, so the page stays put.
                            if (isNarrow(760) && !armedLook) scrollIntoViewSoon(dayPanelRef.current);
                          }}
                          {...lookDropProps(date)}
                        >
                          <span className="week-day">
                            <small>{day.toLocaleDateString(undefined, { weekday: "short" })}</small>
                            <strong>{day.getDate()}</strong>
                          </span>
                          <span className="week-look">
                            {look ? (
                              <>
                                <span className="plan-look-thumbs">
                                  {lookThumbs(look, 3).map((item) => (
                                    <img key={item.id} src={item.thumb ?? item.image} alt="" />
                                  ))}
                                </span>
                                <span>
                                  <strong>{look.name}</strong>
                                  <small>{look.occasion}</small>
                                </span>
                              </>
                            ) : (
                              <small>Nothing planned</small>
                            )}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ol>
              </div>
              <div className="month-heading">
                <div className="month-nav">
                  <button aria-label="Previous month" onClick={() => shiftMonth(-1)}>
                    <ChevronLeft />
                  </button>
                  <h2>{calendarMonth.toLocaleDateString(undefined, { month: "long", year: "numeric" })}</h2>
                  <button aria-label="Next month" onClick={() => shiftMonth(1)}>
                    <ChevronRight />
                  </button>
                </div>
                <span>
                  {plannedThisMonth} {plannedThisMonth === 1 ? "look" : "looks"} planned
                </span>
              </div>
              <div className="calendar-grid">
                {weekdayLabels.map((day) => (
                  <span className="weekday" key={day}>
                    {day}
                  </span>
                ))}
                {Array.from({ length: leadingBlanks }, (_, index) => (
                  <span key={`blank-${index}`} />
                ))}
                {monthDates.map((date) => {
                  const look = savedLooks.find((candidate) => candidate.id === plans[date]);
                  const thumb = look && items.find((item) => look.itemIds.some((id) => sameId(id, item.id)));
                  return (
                    <button
                      key={date}
                      className={`${selectedDate === date ? "selected" : ""} ${look ? "planned" : ""} ${date === todayIso ? "today" : ""} ${dropDate === date ? "drop-target" : ""}`}
                      aria-label={new Date(`${date}T00:00:00`).toLocaleDateString(undefined, { dateStyle: "full" })}
                      aria-current={selectedDate === date ? "true" : undefined}
                      onClick={() => {
                        setSelectedDate(date);
                        // While a look is chosen, the sticky Plan bar confirms, so the page stays put.
                        if (isNarrow(760) && !armedLook) scrollIntoViewSoon(dayPanelRef.current);
                      }}
                      {...lookDropProps(date)}
                    >
                      <span>{Number(date.slice(-2))}</span>
                      {thumb && <img src={thumb.thumb ?? thumb.image} alt="" />}
                    </button>
                  );
                })}
              </div>
            </section>
            <aside className="day-panel" ref={dayPanelRef}>
              <p>{selectedDateLabel}</p>
              <h2>{plannedLook ? plannedLook.name : "Nothing planned"}</h2>
              {plannedLook ? (
                <>
                  <div className="day-look">
                    {plannedLook.itemIds.map((id) => {
                      const item = items.find((piece) => sameId(piece.id, id));
                      return item ? <img key={id} src={item.thumb ?? item.image} alt={item.name} /> : null;
                    })}
                  </div>
                  <span>
                    {plannedLook.occasion} · {plannedLook.itemIds.length} pieces
                  </span>
                  <Button variant="outline" onClick={() => loadLook(plannedLook)}>
                    Open look
                  </Button>
                </>
              ) : (
                <div className="day-empty">
                  <CalendarDays />
                  <span>Pick a saved look for this day.</span>
                </div>
              )}
              <div className="plan-control">
                <label htmlFor="plan-look">Saved look</label>
                <select
                  id="plan-look"
                  value={lookToPlan}
                  disabled={!filteredLooks.length}
                  onChange={(event) => setPlanLookId(event.target.value)}
                >
                  {!filteredLooks.length && (
                    <option value="">{savedLooks.length ? "No looks for this occasion" : "Save a look first"}</option>
                  )}
                  {filteredLooks.map((look) => (
                    <option key={look.id} value={look.id}>
                      {look.name} · {look.occasion}
                    </option>
                  ))}
                </select>
                <label htmlFor="plan-repeat">Repeat</label>
                <select
                  id="plan-repeat"
                  value={repeatWeeks}
                  onChange={(event) => setRepeatWeeks(Number(event.target.value))}
                >
                  <option value={0}>Just this day</option>
                  <option value={4}>
                    Every {new Date(`${selectedDate}T00:00:00`).toLocaleDateString(undefined, { weekday: "long" })} for
                    4 weeks
                  </option>
                  <option value={8}>
                    Every {new Date(`${selectedDate}T00:00:00`).toLocaleDateString(undefined, { weekday: "long" })} for
                    8 weeks
                  </option>
                  <option value={12}>
                    Every {new Date(`${selectedDate}T00:00:00`).toLocaleDateString(undefined, { weekday: "long" })} for
                    12 weeks
                  </option>
                </select>
                <Button disabled={!lookToPlan} onClick={planSelectedLook}>
                  {repeatWeeks ? `Plan ${repeatWeeks} weeks` : plannedLook ? "Replace planned look" : "Plan this look"}
                </Button>
                {plannedLook && (
                  <button className="remove-plan" onClick={removePlan}>
                    Remove from day
                  </button>
                )}
              </div>
              <Button variant="outline" className="pack-button" onClick={() => setPackingOpen(true)}>
                <Luggage /> Pack for a trip
              </Button>
            </aside>
          </div>
          {armedLook && (
            <div className="plan-confirm" role="region" aria-label="Plan the chosen look">
              <span className="plan-look-thumbs" aria-hidden>
                {lookThumbs(armedLook, 2).map((item) => (
                  <img key={item.id} src={item.thumb ?? item.image} alt="" />
                ))}
              </span>
              <p aria-live="polite">
                <strong>{armedLook.name}</strong>
                <span>
                  {plans[selectedDate] === armedLook.id ? "Already on " : "On "}
                  {selectedShort}
                  {repeatWeeks ? `, then weekly for ${repeatWeeks} weeks` : ""}
                </span>
              </p>
              <Button
                disabled={plans[selectedDate] === armedLook.id && !repeatWeeks}
                onClick={() => {
                  planSelectedLook();
                  setArmedLookId(null);
                }}
              >
                Plan
              </Button>
              <button
                className="plan-confirm-cancel"
                aria-label="Stop planning this look"
                onClick={() => setArmedLookId(null)}
              >
                <X />
              </button>
            </div>
          )}
        </>
      )}
    </TabsContent>
  );
}
