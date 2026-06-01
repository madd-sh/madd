---
name: madd-frontend-review
description: Use this skill when auditing or reviewing frontend code, components, or UI implementations. Trigger phrases include "review the UI", "audit the frontend", "check the components", "verify accessibility", "frontend review", "component audit", "UX review".
metadata:
  short-description: Frontend audit checklist for Breaker agent
---

# Frontend Review (Breaker)

Systematic audit checklist for frontend code quality, accessibility, performance, and user experience.

## Audit Process

For each check below, mark as PASS, FAIL, or N/A. Any FAIL must include the specific component/file and a recommended fix.

## 1. Accessibility

- [ ] **Missing aria labels**: Icon-only buttons, unlabeled inputs, or interactive elements without text content or `aria-label`. --> Screen readers cannot announce the element's purpose.

- [ ] **No keyboard navigation**: Custom interactive components (dropdowns, modals, tabs) not reachable or operable via Tab, Enter, Space, Escape, Arrow keys. --> Keyboard-only users cannot interact with the component.

- [ ] **Missing focus management**: Modals not trapping focus, focus not returned to trigger on close, dynamic content not receiving focus. --> Focus lost in void, keyboard users stranded.

- [ ] **Poor color contrast**: Text-to-background contrast below 4.5:1 for normal text or 3:1 for large text (WCAG 2.1 AA). Use axe DevTools or Lighthouse to verify. --> Content unreadable for low-vision users.

- [ ] **Color-only information**: Status, errors, or states conveyed solely through color without icons, text, or patterns. --> Color-blind users miss critical information.

- [ ] **Missing skip navigation**: No skip-to-content link for screen reader users to bypass repetitive navigation. --> Screen reader users must tab through entire nav on every page.

- [ ] **Missing semantic HTML**: Using `<div>` with click handlers instead of `<button>`, `<div>` instead of `<nav>`, `<span>` instead of `<a>`. --> Assistive technology cannot identify element roles.

- [ ] **Missing alt text on images**: Images without `alt` attribute, or decorative images without `alt=""`. --> Screen readers read file names, confusing users.

## 2. Error Handling

- [ ] **Missing error boundaries**: No React ErrorBoundary (or framework equivalent) around route sections, feature panels, or third-party widgets. --> Unhandled rendering error crashes the entire application.

- [ ] **Missing error states**: API failure scenarios show blank screens or default/stale data without an error message. --> Users do not know something went wrong.

- [ ] **No retry mechanism**: Error states without a "Retry" or "Reload" action. --> Users must manually refresh the page.

- [ ] **Uncaught promise rejections**: Async operations (fetch, mutations) without try/catch or `.catch()` handlers. --> Unhandled rejections cause silent failures.

## 3. Loading States

- [ ] **Missing loading states**: Data fetching shows blank screens instead of skeleton loaders, spinners, or progress indicators. --> Users think the page is broken during normal loading.

- [ ] **No skeleton screens**: Loading states use generic spinners instead of layout-aware skeleton screens. --> Content layout shift (CLS) when data loads.

- [ ] **Missing Suspense boundaries**: Lazy-loaded routes or components without Suspense fallback. --> White screen during chunk loading.

- [ ] **No optimistic updates**: Mutations wait for server confirmation before updating UI, causing perceived sluggishness. --> Operations feel slow despite fast network.

## 4. Performance

- [ ] **Unnecessary re-renders**: Components re-rendering on every parent update without memoization. Use React DevTools Profiler to detect. --> Sluggish UI, janky scrolling, wasted CPU.

- [ ] **Missing memoization**: Expensive computations (sorting, filtering, formatting large lists) recalculated on every render without `useMemo`. --> Blocking the main thread on user interactions.

- [ ] **Large bundle size**: All pages and features in a single bundle without code splitting. Check bundle analyzer output. --> Slow initial page load, poor Core Web Vitals (LCP).

- [ ] **Unoptimized images**: Images served without compression, without responsive `srcSet`, or without lazy loading. --> Wasted bandwidth, slow page load.

- [ ] **Missing virtual scrolling**: Lists with 100+ items rendered entirely in the DOM instead of using virtualization (react-window, TanStack Virtual). --> Memory exhaustion, frozen scrolling.

## 5. Responsive Design

- [ ] **Missing mobile breakpoints**: Layout does not adapt below 768px, causing horizontal scrolling or overlapping elements. --> Unusable on phones and small tablets.

- [ ] **Fixed-width elements**: Elements with hardcoded pixel widths that overflow small screens. --> Content cut off or horizontal scroll on mobile.

- [ ] **Missing touch targets**: Interactive elements smaller than 44x44px on mobile. --> Frustrating tap accuracy on touch devices.

- [ ] **Missing viewport meta tag**: `<meta name="viewport" content="width=device-width, initial-scale=1">` not set. --> Mobile browsers render at desktop width, then zoom out.

## 6. Form Quality

- [ ] **Missing client-side validation**: Forms submitted without field validation, relying only on server-side checks. --> Unnecessary round-trips, poor user experience.

- [ ] **Missing inline error display**: Validation errors shown as alerts or only at form top, not next to the invalid field. --> Users cannot locate which field has the error.

- [ ] **Missing loading state on submit**: Submit button not showing loading state or disabling during submission. --> Users click multiple times, causing duplicate submissions.

- [ ] **Missing field types**: Email fields using `type="text"` instead of `type="email"`, numbers using text instead of `type="number"`. --> Mobile keyboards do not optimize, browser validation skipped.

## 7. Design Consistency

- [ ] **Inconsistent styling approaches**: Mixed CSS modules, inline styles, styled-components, and Tailwind in the same project without a deliberate strategy. --> Unmaintainable styles, specificity wars.

- [ ] **Inconsistent spacing**: Mixed spacing values (margin: 12px, margin: 1rem, margin: 0.75em) without a consistent scale. --> Visual rhythm is broken, layout feels unprofessional.

- [ ] **Inconsistent component patterns**: Similar UI needs solved differently across pages (different modal components, different table implementations). --> Code duplication, inconsistent user experience.

## 8. TypeScript Quality

- [ ] **Using `any` type**: Explicit `any` annotations or implicit `any` from missing type declarations. --> Type safety bypassed, runtime errors not caught at compile time.

- [ ] **Missing null checks**: Optional chaining not used on nullable values, or non-null assertions (`!`) used without justification. --> Runtime `cannot read property of undefined` errors.

- [ ] **Missing strict mode**: `tsconfig.json` without `"strict": true`. --> Entire categories of type errors go undetected.

- [ ] **Missing discriminated unions**: State machines or multi-state values modeled as flat interfaces with optional fields instead of discriminated unions. --> Impossible states are representable.

## 9. Testing

- [ ] **Missing component tests**: Interactive components without Testing Library tests covering user interactions. --> Regressions in user-facing behavior go undetected.

- [ ] **Testing implementation details**: Tests using `container.querySelector`, checking internal state, or relying on component internals. --> Tests break on refactoring, provide false confidence.

- [ ] **Missing API mocking**: Tests making real network requests instead of using MSW or similar. --> Flaky tests, slow execution, external dependency.

- [ ] **Missing edge case tests**: No tests for empty states, error states, loading states, or boundary values. --> Edge cases cause production bugs.

## 10. Internationalization

- [ ] **Hardcoded strings**: User-visible text hardcoded in components instead of using i18n keys. --> Cannot translate the application.

- [ ] **Hardcoded date/number formatting**: Dates formatted with string manipulation instead of `Intl.DateTimeFormat`. --> Wrong format for non-English locales.

## 11. SEO

- [ ] **Missing meta tags**: Pages without `<title>`, `<meta name="description">`, or Open Graph tags. --> Poor search engine ranking and social media previews.

- [ ] **Missing semantic HTML**: Content structure lacking proper heading hierarchy (`h1` > `h2` > `h3`), `<main>`, `<article>`, `<section>`. --> Search engines cannot understand page structure.

- [ ] **Missing canonical URLs**: Pages with multiple URLs (www/non-www, trailing slash) without `<link rel="canonical">`. --> Duplicate content penalties.

## Severity Guide

| Severity | Criteria | Examples |
|----------|----------|---------|
| CRITICAL | Prevents usage for user groups | Missing keyboard navigation, no error boundaries, broken mobile |
| HIGH | Significant UX degradation | Missing loading states, no validation, missing error states |
| MEDIUM | Quality and maintainability | Inconsistent patterns, `any` types, hardcoded strings |
| LOW | Polish and optimization | Missing memoization, missing canonical URLs, generic spinners |
