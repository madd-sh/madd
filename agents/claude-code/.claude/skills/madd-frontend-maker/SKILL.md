---
name: madd-frontend-maker
description: Use this skill when building frontend components, pages, or UI features. Trigger phrases include "create a component", "build the UI", "implement the form", "add a page", "frontend development", "design the interface", "create the view", "build the dashboard".
---

# Frontend Development (Maker)

Production-grade frontend development patterns for React/TypeScript applications.

## 1. Component Architecture (Atomic Design)

Organize components in a layered hierarchy:

| Level | Name | Description | Example |
|-------|------|-------------|---------|
| 1 | **Atoms** | Smallest UI elements, no business logic | Button, Input, Label, Icon, Badge |
| 2 | **Molecules** | Combinations of atoms with simple behavior | SearchInput (Input + Button), FormField (Label + Input + Error) |
| 3 | **Organisms** | Complex UI sections with business logic | LoginForm, UserCard, DataTable, NavigationBar |
| 4 | **Templates** | Page layouts without data | DashboardLayout, SettingsLayout, AuthLayout |
| 5 | **Pages** | Templates connected to data sources | DashboardPage, SettingsPage, LoginPage |

Directory structure:
```
src/
  components/
    atoms/         # Button, Input, Badge, Spinner
    molecules/     # FormField, SearchBar, DropdownMenu
    organisms/     # DataTable, LoginForm, Sidebar
  layouts/         # DashboardLayout, AuthLayout
  pages/           # DashboardPage, SettingsPage
```

## 2. State Management

Choose the right tool based on scope:

| State Type | Tool | When to Use |
|-----------|------|-------------|
| **Local UI** | `useState` | Toggle, hover, form input, open/close |
| **Complex local** | `useReducer` | Multi-field forms, finite state machines |
| **Shared UI** | React Context | Theme, locale, current user, sidebar state |
| **Server state** | TanStack Query / SWR | API data (caching, revalidation, optimistic updates) |
| **Global client** | Zustand / Jotai | Cross-page state that persists across navigation |

Rules:
- Start with local state. Lift up only when needed.
- Server state and client state are different concerns: never mix them.
- Context for low-frequency updates only (theme, auth). High-frequency updates cause re-renders.
- Zustand/Jotai for high-frequency shared state (real-time data, multi-panel coordination).

## 3. Accessibility (WCAG 2.1 AA)

### Semantic HTML

```tsx
// BAD: div soup
<div onClick={handleClick}>Click me</div>
<div class="heading">Title</div>

// GOOD: semantic elements
<button onClick={handleClick}>Click me</button>
<h2>Title</h2>
```

### ARIA Labels

```tsx
// Icon-only buttons MUST have aria-label
<button aria-label="Close dialog" onClick={onClose}>
  <XIcon />
</button>

// Form inputs MUST have associated labels
<label htmlFor="email">Email</label>
<input id="email" type="email" aria-describedby="email-error" />
{error && <span id="email-error" role="alert">{error}</span>}
```

### Keyboard Navigation

- All interactive elements must be reachable via Tab
- Custom components must handle Enter/Space for activation
- Modals must trap focus (focus stays inside until dismissed)
- Focus must return to trigger element when modal closes
- Skip navigation link for screen readers:
  ```tsx
  <a href="#main-content" className="sr-only focus:not-sr-only">
    Skip to main content
  </a>
  ```

### Color Contrast

- Normal text (< 18px): minimum contrast ratio **4.5:1**
- Large text (>= 18px bold or >= 24px): minimum contrast ratio **3:1**
- UI components and graphical objects: minimum **3:1**
- Never use color alone to convey information (add icons, patterns, or text)

## 4. Responsive Design

### Mobile-First Approach

```css
/* Base styles = mobile */
.container {
  padding: 1rem;
  display: flex;
  flex-direction: column;
}

/* Tablet and up */
@media (min-width: 768px) {
  .container {
    flex-direction: row;
    padding: 2rem;
  }
}

/* Desktop and up */
@media (min-width: 1024px) {
  .container {
    max-width: 1200px;
    margin: 0 auto;
  }
}
```

### Breakpoints

| Name | Min Width | Target |
|------|-----------|--------|
| sm | 640px | Large phones |
| md | 768px | Tablets |
| lg | 1024px | Small desktops |
| xl | 1280px | Large desktops |
| 2xl | 1536px | Ultra-wide |

### Fluid Typography

```css
/* Scales between 16px (mobile) and 20px (desktop) */
html {
  font-size: clamp(1rem, 0.875rem + 0.5vw, 1.25rem);
}
```

## 5. Form Patterns

### Validation (Client + Server)

```tsx
// Zod schema for client-side validation
const loginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

// React Hook Form + Zod
const { register, handleSubmit, formState: { errors } } = useForm({
  resolver: zodResolver(loginSchema),
});
```

### Error Display

```tsx
// Inline field errors
<div>
  <label htmlFor="email">Email</label>
  <input
    id="email"
    aria-invalid={!!errors.email}
    aria-describedby={errors.email ? "email-error" : undefined}
    {...register("email")}
  />
  {errors.email && (
    <span id="email-error" role="alert" className="text-red-600">
      {errors.email.message}
    </span>
  )}
</div>
```

### Loading States and Optimistic Updates

```tsx
const mutation = useMutation({
  mutationFn: createItem,
  onMutate: async (newItem) => {
    // Cancel outgoing refetches
    await queryClient.cancelQueries({ queryKey: ["items"] });
    // Snapshot previous value
    const previous = queryClient.getQueryData(["items"]);
    // Optimistically update
    queryClient.setQueryData(["items"], (old) => [...old, newItem]);
    return { previous };
  },
  onError: (err, newItem, context) => {
    // Rollback on error
    queryClient.setQueryData(["items"], context.previous);
  },
  onSettled: () => {
    queryClient.invalidateQueries({ queryKey: ["items"] });
  },
});
```

## 6. Error Boundaries

```tsx
class ErrorBoundary extends React.Component {
  state = { hasError: false, error: null };

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    // Report to error tracking service
    errorReporter.captureException(error, { extra: errorInfo });
  }

  render() {
    if (this.state.hasError) {
      return <ErrorFallback error={this.state.error} onRetry={() => this.setState({ hasError: false })} />;
    }
    return this.props.children;
  }
}

// Usage: wrap around route sections, not the entire app
<ErrorBoundary>
  <DashboardContent />
</ErrorBoundary>
```

Place error boundaries at:
- Route level (catch page-level crashes)
- Feature section level (isolate feature failures)
- Third-party widget level (contain external code failures)

## 7. Loading States

### Skeleton Screens

```tsx
function UserCardSkeleton() {
  return (
    <div className="animate-pulse">
      <div className="h-12 w-12 rounded-full bg-gray-200" />
      <div className="h-4 w-32 bg-gray-200 rounded mt-2" />
      <div className="h-3 w-24 bg-gray-200 rounded mt-1" />
    </div>
  );
}

function UserCard({ userId }) {
  const { data, isLoading } = useQuery({
    queryKey: ["user", userId],
    queryFn: () => fetchUser(userId),
  });

  if (isLoading) return <UserCardSkeleton />;
  return <div>{data.name}</div>;
}
```

### Suspense Boundaries

```tsx
<Suspense fallback={<PageSkeleton />}>
  <LazyDashboard />
</Suspense>
```

## 8. Performance

### Code Splitting

```tsx
// Route-based splitting
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Settings = lazy(() => import("./pages/Settings"));
```

### Memoization

```tsx
// Expensive computation
const sortedItems = useMemo(
  () => items.sort((a, b) => a.name.localeCompare(b.name)),
  [items]
);

// Callback stability for child components
const handleClick = useCallback((id: string) => {
  setSelectedId(id);
}, []);

// Component memoization (only when re-renders are measured as expensive)
const MemoizedList = React.memo(ItemList);
```

### Image Optimization

```tsx
// Next.js Image (or equivalent)
<Image src="/hero.jpg" width={1200} height={600} alt="Hero" priority />

// Native lazy loading
<img src="/photo.jpg" loading="lazy" alt="Photo" />

// Responsive images
<picture>
  <source srcSet="/hero.webp" type="image/webp" />
  <source srcSet="/hero.avif" type="image/avif" />
  <img src="/hero.jpg" alt="Hero" />
</picture>
```

## 9. TypeScript Strict Mode

Enable in `tsconfig.json`:
```json
{
  "compilerOptions": {
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true
  }
}
```

Rules:
- No `any` types. Use `unknown` for truly unknown data, then narrow.
- All component props must have explicit interfaces.
- All event handlers must be properly typed.
- Use discriminated unions for state machines:
  ```tsx
  type State =
    | { status: "idle" }
    | { status: "loading" }
    | { status: "success"; data: User[] }
    | { status: "error"; error: Error };
  ```

## 10. Testing Patterns

### Component Tests with Testing Library

```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

test("submits login form with valid credentials", async () => {
  const user = userEvent.setup();
  const onSubmit = vi.fn();

  render(<LoginForm onSubmit={onSubmit} />);

  await user.type(screen.getByLabelText("Email"), "test@example.com");
  await user.type(screen.getByLabelText("Password"), "password123");
  await user.click(screen.getByRole("button", { name: "Sign in" }));

  expect(onSubmit).toHaveBeenCalledWith({
    email: "test@example.com",
    password: "password123",
  });
});
```

### API Mocking with MSW

```tsx
import { setupServer } from "msw/node";
import { http, HttpResponse } from "msw";

const server = setupServer(
  http.get("/api/users", () => {
    return HttpResponse.json([
      { id: "1", name: "Alice" },
      { id: "2", name: "Bob" },
    ]);
  })
);

beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
```

## Verification Checklist

- [ ] All components follow atomic design hierarchy
- [ ] State management matches complexity (local before global)
- [ ] All interactive elements are keyboard accessible
- [ ] ARIA labels present on icon-only buttons and unlabeled inputs
- [ ] Color contrast meets WCAG 2.1 AA (4.5:1 normal, 3:1 large)
- [ ] Mobile-first responsive breakpoints implemented
- [ ] Forms have client-side validation with inline error display
- [ ] Error boundaries wrap route sections and third-party widgets
- [ ] Skeleton loading states for all async data
- [ ] Code splitting on route boundaries
- [ ] No `any` types in TypeScript
- [ ] Component tests cover user interactions, not implementation details
