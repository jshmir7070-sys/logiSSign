# Design System Specification: Precision Velocity

## 1. Overview & Creative North Star
The core of this design system is defined by a Creative North Star we call **"The Precision Velocity."** 

In the high-stakes world of last-mile delivery, data is often chaotic. This system rejects the cluttered, "boxed-in" aesthetic of traditional enterprise software. Instead, we adopt a high-end editorial approach. We treat logistics data like a premium financial journal—utilizing intentional white space, sophisticated tonal layering, and high-contrast typography to guide the administrator’s eye toward what matters most. 

By breaking the rigid 1px-border grid and moving toward "nested surfaces," we create an interface that feels less like a database and more like a curated command center.

---

## 2. Colors & Surface Logic
The palette is anchored in professional authority and operational clarity.

### The "No-Line" Rule
To achieve a premium feel, **1px solid borders for sectioning are strictly prohibited.** Do not use lines to separate the sidebar from the main content or to define table rows. 
- **Boundaries:** Defined solely through background color shifts. For example, a `surface-container-lowest` card sits on a `surface-container-low` section.
- **Tonal Transitions:** Use the `surface` tokens to create natural separation.

### Surface Hierarchy & Nesting
Treat the UI as a series of physical layers. 
- **Base Layer:** `surface` (#f7f9fb) for the main page background.
- **Secondary Layer:** `surface-container-low` (#f2f4f6) for grouping related content sections.
- **Interaction Layer:** `surface-container-lowest` (#ffffff) for primary cards and data entry areas.
- **The "Glass" Rule:** For floating elements like the Top Header or dropdowns, use `surface` colors at 80% opacity with a `20px` backdrop-blur.

### Signature Textures
- **The Power Gradient:** Main CTAs and hero sparklines should utilize a subtle linear gradient: `primary` (#004ac6) to `primary_container` (#2563eb). This adds a "visual soul" that flat hex codes cannot provide.

---

### 3. Typography: Editorial Authority
We use a dual-font strategy to balance Korean legibility with global data precision.

| Role | Font Family | Usage |
| :--- | :--- | :--- |
| **Display/Headline** | Pretendard | Large-scale Korean titles (e.g., "배송 현황 요약"). |
| **Data/Numbers** | Inter | All numerical values, timestamps, and KPI metrics. |
| **Body/Labels** | Pretendard | General UI labels and descriptive text. |

**Hierarchy Note:** 
- Use `display-md` (Pretendard Bold) for high-level dashboard summaries.
- Use `title-lg` (Inter Semibold) for KPI values to emphasize the "data-driven" nature of the Super Admin.
- All Korean labels must use `label-md` or `label-sm` with a slightly increased letter-spacing (+0.02em) to ensure clarity in dense tables.

---

## 4. Elevation & Depth
Depth in this system is achieved through **Tonal Layering**, not structural lines.

- **The Layering Principle:** Stacking tiers (e.g., a `surface-container-highest` button on a `surface-container-lowest` card) creates a soft, natural lift.
- **Ambient Shadows:** When an element must "float" (like a Modal or a Tooltip), use an extra-diffused shadow: `0 8px 32px rgba(15, 23, 42, 0.08)`. The shadow color is tinted with our Sidebar Navy to ensure it feels integrated with the brand.
- **The "Ghost Border":** If a container lacks contrast (e.g., white on light grey), use a "Ghost Border": `outline_variant` (#c3c6d7) at **15% opacity**. It should be felt, not seen.

---

## 5. Components

### Sidebar (The Control Tower)
- **Background:** `on_secondary_fixed` (#0f172a).
- **Active State:** A "Pill" shape using `primary_container` (#2563eb).
- **Navigation:** Text in `on_primary` at 90% opacity. Avoid icons with boxes; use thin-stroke "Ghost" icons.

### KPI Cards & Sparklines
- **Container:** `surface-container-lowest` (Radius: 1.5rem / 24px).
- **Visuals:** Sparklines must use the primary gradient with a soft `surface_tint` glow. No axes or grid lines—just the trend.
- **Labels:** Korean title at the top left (`label-md`), Inter number at the center (`display-sm`).

### Data Tables (The List View)
- **Separation:** Forbid the use of divider lines. 
- **Layout:** Use `2.25rem` (10) vertical spacing between rows. Highlight the hovered row using `surface-container-high`.
- **Badges:** Use `full` (999px) radius. 
    - *Success (배송 완료):* `tertiary` text on `tertiary_fixed` background.
    - *Danger (지연):* `error` text on `error_container` background.

### Buttons
- **Primary:** `8px` radius. Gradient fill (`primary` to `primary_container`).
- **Secondary:** Transparent background with a "Ghost Border" (15% opacity `outline`).
- **Interaction:** On hover, increase the `surface_tint` overlay by 10%.

---

## 6. Do's and Don'ts

### Do
- **Do** use `Inter` for all numbers; it is the "DNA" of our data-driven look.
- **Do** use `Pretendard` for all Korean UI labels (e.g., "설정", "고객사 관리").
- **Do** lean on white space. If two elements feel too close, increase the spacing by one tier in the scale rather than adding a line.
- **Do** use Glassmorphism for the Top Header to provide a sense of vertical depth as content scrolls underneath.

### Don't
- **Don't** use 100% opaque grey borders. They break the editorial flow.
- **Don't** use standard "Drop Shadows" (Black #000). Always tint shadows with the `on_surface` color at very low alpha.
- **Don't** use sharp corners for cards. Stick to the `xl` (24px) or `lg` (16px) radius to maintain the modern, approachable enterprise feel.
- **Don't** clutter the dashboard. If a metric isn't "Actionable," move it to a sub-page.
