---
name: Rove
description: A clean, tactile garment archive for everyday wardrobe decisions.
colors:
  electric-blue: "#3e55f0"
  blue-work-surface: "#e9ecff"
  wardrobe-paper: "#f6f7f3"
  garment-white: "#ffffff"
  carbon-ink: "#161815"
  quiet-ink: "#676b63"
  rail-line: "#dfe2db"
typography:
  display:
    fontFamily: "Avenir Next, Avenir, Helvetica Neue, Helvetica, Arial, sans-serif"
    fontSize: "clamp(2.4rem, 5vw, 4.6rem)"
    fontWeight: 650
    lineHeight: 0.95
    letterSpacing: "-0.04em"
  body:
    fontFamily: "Avenir Next, Avenir, Helvetica Neue, Helvetica, Arial, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.55
  label:
    fontFamily: "Avenir Next, Avenir, Helvetica Neue, Helvetica, Arial, sans-serif"
    fontSize: "0.7rem"
    fontWeight: 700
    lineHeight: 1
    letterSpacing: "0.08em"
rounded:
  control: "11px"
  surface: "16px"
  pill: "999px"
spacing:
  compact: "8px"
  standard: "16px"
  section: "44px"
components:
  button-primary:
    backgroundColor: "{colors.carbon-ink}"
    textColor: "{colors.garment-white}"
    rounded: "{rounded.control}"
    height: "42px"
    padding: "0 18px"
  button-accent:
    backgroundColor: "{colors.electric-blue}"
    textColor: "{colors.garment-white}"
    rounded: "{rounded.control}"
    height: "43px"
  filter-active:
    backgroundColor: "{colors.electric-blue}"
    textColor: "{colors.garment-white}"
    rounded: "{rounded.pill}"
    height: "36px"
---

# Design System: Rove

## Overview

**Creative North Star: "The Stylist’s Garment Archive"**

Rove treats a personal closet as a working archive rather than a retail catalog. Crisp white product plates sit on a quiet cool-paper ground, while the sidebar and metadata behave like a compact studio filing system. The outfit builder changes the rhythm: it becomes a softly lit blue styling table where garments can be moved into relation.

The interface is image-led, calm, and operational. Large headings provide orientation; controls stay compact and specific. Electric blue is reserved for active choices, generated intelligence, and the styling workspace.

**Key Characteristics:**
- High-resolution garment cutouts on clean white plates.
- A narrow persistent navigation rail on desktop and a bottom dock on mobile.
- Dense controls paired with generous space around the wardrobe grid.
- One electric-blue accent with a pale blue composition surface.

## Colors

The palette combines cool wardrobe paper, carbon ink, and one concentrated electric-blue signal.

### Primary
- **Electric Blue** (#3e55f0): active filters, generated intelligence, and decisive wardrobe actions.
- **Blue Work Surface** (#e9ecff): the outfit-building canvas and subtle generated-content tags.

### Neutral
- **Wardrobe Paper** (#f6f7f3): application background.
- **Garment White** (#ffffff): product plates, dialogs, and working panels.
- **Carbon Ink** (#161815): headings, active navigation, and primary actions.
- **Quiet Ink** (#676b63): supporting copy and metadata.
- **Rail Line** (#dfe2db): dividers and structural borders.

**The One Signal Rule.** Electric blue marks active choice or assisted work; it does not decorate passive content.

## Typography

**Display Font:** Avenir Next with Helvetica and Arial fallbacks  
**Body Font:** Avenir Next with Helvetica and Arial fallbacks

**Character:** A compact humanist sans hierarchy gives the closet a precise editorial voice without competing with garment imagery.

### Hierarchy
- **Display** (650, clamp(2.4rem, 5vw, 4.6rem), 0.95): route-level headings only.
- **Title** (650, 1.3–1.55rem): selected-item and styling-note titles.
- **Body** (400, 1rem, 1.55): instructions and descriptions.
- **Label** (700, 0.67–0.8rem, 0.08em): categories and compact control labels.

**The Image Leads Rule.** Type identifies and organizes garments; it never becomes more visually elaborate than the wardrobe itself.

## Layout

Desktop uses a 102px navigation rail, a fluid wardrobe workspace, and a 310px detail panel. The closet grid holds three equal columns with 16px horizontal gaps. At 1100px, the detail panel disappears; at 760px, navigation becomes a fixed bottom dock, the wardrobe becomes two columns, and the outfit builder stacks its rail beneath the canvas. Section padding ranges from 24px to 64px responsively.

## Elevation & Depth

The system is flat by default and uses elevation only for active or floating UI: the selected garment plate, dialog, primary rail tab, and styling workspace. Garment cutouts use a restrained directional drop shadow to keep transparent edges legible.

### Shadow Vocabulary
- **Active plate** (`0 18px 36px rgba(34,41,28,.1)`): selected closet item.
- **Workspace lift** (`0 24px 60px rgba(37,43,32,.08)`): outfit builder shell.
- **Garment grounding** (`drop-shadow(0 14px 16px rgba(20,20,20,.12))`): transparent product imagery.

**The Flat Archive Rule.** Resting surfaces are separated by tone and rules; shadows indicate active handling or floating layers.

## Shapes

Product plates and major working surfaces use 16px corners. Inputs and buttons use 11–13px corners. Pills are limited to filters and compact tags. Circular shapes are reserved for favorite controls, garment detail plates, and color swatches.

## Components

### Buttons
- **Shape:** compact rounded rectangle (11–12px).
- **Primary:** carbon ink or electric blue with white text.
- **Hover / Focus:** subtle tone shift and a three-pixel blue focus ring.
- **Secondary:** white surface with a single rail-line border.

### Chips
- **Style:** compact pill with quiet text at rest.
- **State:** active chips fill electric blue with white text; generated tags use the pale blue work surface.

### Cards / Containers
- **Corner Style:** 16px.
- **Background:** garment white.
- **Shadow Strategy:** flat at rest; selected garment plates receive a blue inset ring and ambient lift.
- **Internal Padding:** image plates use 12–16% proportional padding.

### Inputs / Fields
- **Style:** white background, single neutral border, 11–13px radius.
- **Focus:** electric-blue ring with clear offset.
- **Disabled:** reduced opacity with preserved legibility.

### Navigation
- Desktop navigation is a compact icon-and-label rail. Active destinations fill carbon ink. Mobile navigation becomes a two-item bottom dock with the same active treatment.

### Outfit Canvas
- A pale blue styling surface uses a single centered radial light and grounded garment shadows. Pieces remain isolated, directly removable, and limited to three per look.

## Do's and Don'ts

### Do:
- **Do** let garment imagery carry the color and personality of closet views.
- **Do** reserve electric blue for active choices, assisted work, and focus.
- **Do** preserve the two-column mobile closet and persistent bottom navigation.
- **Do** keep product cutouts centered with generous clear margin.

### Don't:
- **Don't** add decorative gradients, glass effects, or nested card shells.
- **Don't** turn metadata into oversized dashboard metrics.
- **Don't** use more than one saturated interface accent per screen.
- **Don't** hide generated names, descriptions, or tags from user review.
