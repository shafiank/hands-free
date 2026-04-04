// ============================================================
// Fix: Lucide React + React 19 Type Mismatch
// ============================================================
// This project has dual @types/react versions:
//   - apps/web/node_modules/@types/react → v19.2.14
//   - node_modules/@types/react → v18.3.28
//
// lucide-react declares its LucideIcon type using React 18's
// ForwardRefExoticComponent, which is incompatible with React 19's
// stricter JSX element types. This causes false "cannot be used
// as a JSX component" errors across all pages.
//
// This declaration file patches the LucideIcon type to be
// compatible with React 19.
// ============================================================

import type { SVGProps, ForwardRefExoticComponent, RefAttributes } from 'react';

declare module 'lucide-react' {
    export interface LucideProps extends Partial<SVGProps<SVGSVGElement>> {
        size?: string | number;
        absoluteStrokeWidth?: boolean;
    }

    export type LucideIcon = ForwardRefExoticComponent<
        LucideProps & RefAttributes<SVGSVGElement>
    >;
}
