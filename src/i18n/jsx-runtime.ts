/* eslint-disable @typescript-eslint/no-namespace, @typescript-eslint/no-empty-object-type */
// Import the real React runtime by relative file path so Vite's alias for
// react/jsx-runtime only applies to application code, not this wrapper.
// @ts-expect-error React does not publish declarations for the file path export.
import { Fragment, jsx as reactJsx, jsxs as reactJsxs } from '../../node_modules/react/jsx-runtime.js';
import type { JSX as ReactJSX } from 'react';
import { translateJsxProps } from './runtime';

export { Fragment };

export namespace JSX {
  export type ElementType = ReactJSX.ElementType;
  export interface Element extends ReactJSX.Element {}
  export interface ElementClass extends ReactJSX.ElementClass {}
  export interface ElementAttributesProperty extends ReactJSX.ElementAttributesProperty {}
  export interface ElementChildrenAttribute extends ReactJSX.ElementChildrenAttribute {}
  export type LibraryManagedAttributes<C, P> = ReactJSX.LibraryManagedAttributes<C, P>;
  export interface IntrinsicAttributes extends ReactJSX.IntrinsicAttributes {}
  export interface IntrinsicClassAttributes<T> extends ReactJSX.IntrinsicClassAttributes<T> {}
  export interface IntrinsicElements extends ReactJSX.IntrinsicElements {}
}

export function jsx(type: unknown, props: unknown, ...rest: unknown[]) {
  return (reactJsx as (...args: unknown[]) => unknown)(type, translateJsxProps(type, props), ...rest);
}

export function jsxs(type: unknown, props: unknown, ...rest: unknown[]) {
  return (reactJsxs as (...args: unknown[]) => unknown)(type, translateJsxProps(type, props), ...rest);
}
