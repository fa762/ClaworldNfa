# Design System Document

## 1. Overview & Creative North Star: "The Terminal Authority"

This design system is a high-end digital translation of retro-futuristic computational aesthetics. Moving beyond a simple "gaming skin," it adopts a **Creative North Star of "The Terminal Authority."** It reimagines the iconic RobCo Industries interface as a premium, editorial-grade operating system where data density meets intentional negative space.

Rather than a flat imitation of 1950s technology, this system uses a "Digital Brutalism" approach. We break the standard web grid through **asymmetric data columns**, **monochromatic depth layering**, and **intentional phosphor-glow typography**. The interface should feel like a high-fidelity recovery of a lost nuclear-age mainframe—authoritative, raw, and meticulously organized.

---

## 2. Colors: The Phosphor Spectrum

The palette is strictly monochromatic green, utilizing tonal shifts to define hierarchy. We lean heavily on the "glow" of the screen rather than external lighting.

*   **Primary (#00FF00 / `primary_container`):** Used sparingly for high-action triggers and the primary "phosphor glow" of active data.
*   **Secondary (#2F8E1C / `secondary_container`):** The functional workhorse. Used for persistent UI frames and inactive status indicators.
*   **Surface (#131313 / `surface`):** The "Glass" of the CRT. It is not pure black, but a deep, pressurized dark grey that suggests a cathode-ray tube's depth.

### The "No-Line" Rule
Sectioning must never rely on 1px solid dividers (except where used as stylistic "Terminal Frames"). Boundaries are defined by shifting between `surface_container_lowest` (#0E0E0E) and `surface_container_low` (#1B1B1B). This creates a sense of recessed panels within a machine casing rather than lines drawn on a page.

### Glass & Gradient Rule
To simulate the physical curve of a CRT monitor, use a subtle radial gradient on the main `background`: a soft transition from `surface_bright` (#393939) at the center to `surface` (#131313) at the edges. Floating modals should utilize `surface_variant` at 80% opacity with a `backdrop-blur` of 12px to simulate thick, leaded glass.

---

## 3. Typography: Monospaced Editorial

All type is set in **JetBrains Mono** (or Space Grotesk for display headers). The hierarchy is built on the logic of machine code output.

*   **Display (Display-LG/MD):** Large, glowing headers. Use `text-shadow: 0 0 8px #00FF00;` to simulate CRT "bleed."
*   **Headline & Title:** Used for RobCo-style section headers. These should always be uppercase to convey systemic authority.
*   **Body (Body-LG/MD):** For data readouts. Maintain a tracking of -2% for a denser, more "technical" feel.
*   **Label:** Smallest metadata. Use `on_surface_variant` (#B9CCAF) to differentiate "labels" from "live data."

The typography conveys brand identity through **intentional rigidity**. By forcing all content into a monospaced grid, we evoke the feeling of a system where every character has a specific memory address.

---

## 4. Elevation & Depth: Tonal Layering

Traditional shadows do not exist in a terminal. Depth is achieved through **luminance and layering**.

*   **The Layering Principle:** A "recessed" input field should use `surface_container_lowest` (#0E0E0E) nested within a `surface_container` (#20201F) panel. The lower the luminance, the "deeper" the element sits in the hardware.
*   **Ambient Shadows:** If a floating element (like a RobCo notification) is required, use a "Glow Shadow" rather than a dark shadow. Use `primary_container` (#00FF00) at 5% opacity with a 40px blur to simulate the screen's light reflecting off internal components.
*   **The "Ghost Border" Fallback:** For buttons or card outlines, use `outline_variant` (#3B4B35) at 20% opacity. This creates a "scanning line" effect that defines the shape without breaking the monochromatic immersion.

---

## 5. Components

### Buttons (Terminal Interaction)
*   **Primary:** Solid `secondary_container` (#157901) background with `on_primary_fixed` text. On hover, the background pulses with a `primary_container` (#00FF00) glow.
*   **Tertiary/Ghost:** Brackets `[ ]` surrounding text. No background. This is the "Pure Terminal" style for navigation.

### Input Fields
*   **State:** Rectangular, `0px` border radius. 
*   **Cursor:** A solid block `█` (using the `primary` token) that blinks at 1Hz.
*   **Error:** Shift the glow from green to `error` (#FFB4AB). The label should flicker briefly to simulate hardware malfunction.

### Cards & Lists
*   **Constraint:** Forbid divider lines. Use `0.9rem` (`spacing.4`) of vertical space to separate list items.
*   **Framing:** Instead of a border, use a "Header Bar" using `surface_container_highest` (#353535) to anchor the content group.

### Terminal-Specific Components
*   **Scanline Overlay:** A persistent, fixed-position `div` with a repeating linear gradient of `transparent` and `rgba(0,0,0,0.1)` every 2px.
*   **The Breadcrumb "Path":** Displayed as `C:\ROBCO\SYSTEM\NAV > [DIRECTORY]`.

---

## 6. Do's and Don'ts

### Do:
*   **Use 0px Corner Radii:** This system is built on hardware and code; there is no room for "soft" rounded corners.
*   **Embrace High Contrast:** Keep text high-contrast against backgrounds to maintain the "phosphor" look.
*   **Intentional Asymmetry:** Align data to the left, but allow metadata or status codes to float to the far right, creating a balanced but non-centered layout.

### Don't:
*   **Don't Use Standard Gradients:** Avoid "modern" colorful gradients. Only use monochromatic green gradients to simulate light falloff or screen curvature.
*   **Don't Use 1px Borders for Everything:** Use background shifts first. Only use borders for primary "Action Frames."
*   **Don't Use Smooth Transitions:** UI states should be "instant" or use a "typewriter" effect. Avoid 300ms ease-in-out transitions; they feel too "organic" for a terminal. Use a 50ms "flicker" transition instead.

### Accessibility Note:
While the aesthetic is monochromatic, ensure that "Error" states use the `error` (#FFB4AB) token and "Warning" states use the `tertiary_fixed_dim` (#F1C100) amber token to ensure critical information is distinguishable by more than just text content.