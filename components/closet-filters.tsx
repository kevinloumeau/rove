"use client";

import { Check } from "lucide-react";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { seasons } from "@/lib/wardrobe-types";
import { DEFAULT_SORT, activeFilterCount, sortOptions } from "@/lib/closet-filters";

function ChoiceGroup({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: string[];
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <fieldset className="filter-group">
      <legend>{label}</legend>
      <div>
        {options.map((option) => (
          <label key={option} className={value === option ? "active" : ""}>
            <input
              type="radio"
              name={label}
              value={option}
              checked={value === option}
              onChange={() => onChange(option)}
            />
            {value === option && <Check aria-hidden />}
            {option}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

/** Phone filter sheet: category, color, season and sort in one place. */
export function ClosetFilterSheet({
  open,
  onOpenChange,
  categories,
  category,
  setCategory,
  colors,
  color,
  setColor,
  season,
  setSeason,
  sort,
  setSort,
  resultCount,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  categories: string[];
  category: string;
  setCategory: (value: string) => void;
  colors: string[];
  color: string;
  setColor: (value: string) => void;
  season: string;
  setSeason: (value: string) => void;
  sort: string;
  setSort: (value: string) => void;
  resultCount: number;
}) {
  const active = activeFilterCount({ category, color, season, sort });
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="filter-sheet">
        <SheetTitle>Filter and sort</SheetTitle>
        <SheetDescription className="sr-only">Narrow your closet by category, color and season.</SheetDescription>
        <div className="filter-sheet-body">
          <ChoiceGroup label="Category" options={categories} value={category} onChange={setCategory} />
          <ChoiceGroup label="Color" options={["All colors", ...colors]} value={color} onChange={setColor} />
          <ChoiceGroup
            label="Season"
            options={["All seasons", ...seasons.filter((option) => option !== "All season")]}
            value={season}
            onChange={setSeason}
          />
          <ChoiceGroup label="Sort by" options={sortOptions} value={sort} onChange={setSort} />
        </div>
        <div className="filter-sheet-footer">
          <button
            className="filter-clear"
            disabled={!active}
            onClick={() => {
              setCategory("All");
              setColor("All colors");
              setSeason("All seasons");
              setSort(DEFAULT_SORT);
            }}
          >
            Clear all
          </button>
          <button className="filter-apply" onClick={() => onOpenChange(false)}>
            Show {resultCount} {resultCount === 1 ? "piece" : "pieces"}
          </button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
