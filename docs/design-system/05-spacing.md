# 05. Spacing & Density Scale

## 1. 4px Base Grid

Vaeloom uses a strict 4px grid for all spacing, padding, margins, and component
dimensions. No arbitrary pixel offsets (e.g. `13px`, `7px`) are permitted.

| Token       | Value (px) | Rem Equivalent | Common Application                               |
| :---------- | :--------- | :------------- | :----------------------------------------------- |
| `space-0`   | 0px        | 0rem           | Reset                                            |
| `space-0.5` | 2px        | 0.125rem       | Border offset, subtle icon adjustments           |
| `space-1`   | 4px        | 0.25rem        | Compact item spacing, badge internal padding     |
| `space-2`   | 8px        | 0.5rem         | Button padding vertical, form field gap          |
| `space-3`   | 12px       | 0.75rem        | Button padding horizontal, card internal compact |
| `space-4`   | 16px       | 1.0rem         | Standard container padding, form row gap         |
| `space-5`   | 20px       | 1.25rem        | Section spacing inside cards                     |
| `space-6`   | 24px       | 1.5rem         | Card padding comfortable, drawer header padding  |
| `space-8`   | 32px       | 2.0rem         | Page section gap, major grid gutters             |
| `space-10`  | 40px       | 2.5rem         | Page header bottom margin                        |
| `space-12`  | 48px       | 3.0rem         | Major layout block division                      |
| `space-16`  | 64px       | 4.0rem         | Canvas outer margins on widescreen               |

## 2. Density Modes

Components support three explicit density modes:

1. **Compact**: For dense data tables, developer views, and log streams (row
   height: 32px, text: 12-13px).
2. **Comfortable (Default)**: Standard enterprise workspace views (row height:
   44px, text: 14px).
3. **Spacious**: Reading modes, onboarding flows, and focused modal forms (row
   height: 52px, text: 15-16px).
