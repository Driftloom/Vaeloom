# 12. Forms & Input Controls

## 1. Input Suite

- `<Input>`: Single-line text, email, password, URL input.
- `<Textarea>`: Multi-line text input with optional auto-resize.
- `<Select>`: Single-select dropdown with keyboard navigation and search filter.
- `<Checkbox>`: Binary or indeterminate selection.
- `<Radio>` / `<RadioGroup>`: Mutually exclusive single-option selection.
- `<Switch>`: Immediate binary state toggles (e.g. feature flags, permissions).
- `<SearchField>`: Specialized input with embedded search icon, clear button,
  and debounce support.

## 2. Form Field States & Validation

Every form control integrates with:

- `label`: High-contrast semantic text associated via `htmlFor` / `id`.
- `helperText`: Explanatory subtext.
- `errorMessage`: High-visibility error state accompanied by an alert icon and
  `aria-invalid="true"`.
- `isRequired`: Visually and semantically flags mandatory inputs with
  `aria-required="true"`.
- `isDisabled`: Greyed out, non-interactive, `aria-disabled="true"`.
