# mouse-hook

[![JSR](https://jsr.io/badges/@nktkas/mouse-hook)](https://jsr.io/@nktkas/mouse-hook)

Windows mouse listening for Deno with zero dependencies.

## Usage example

```ts
import { MouseHook } from "@nktkas/mouse-hook";

const hook = new MouseHook();
hook.addEventListener("mousemove", (event) => {
    console.log("Mouse moved:", event.detail);
});
hook.addEventListener("mousedown", (event) => {
    console.log("Mouse button down:", event.detail);
});
hook.addEventListener("mouseup", (event) => {
    console.log("Mouse button up:", event.detail);
});
hook.addEventListener("mousewheel", (event) => {
    console.log("Mouse wheel:", event.detail);
});

// When done, clean up resources
// hook.close();
```

## API

```ts
/** Mouse event structure. */
export interface MouseEvent {
    /** X position of the mouse. */
    x: number;
    /** Y position of the mouse. */
    y: number;
    /** Mouse data (e.g., wheel delta for mouse wheel). */
    mouseData: number;
    /** Event flags. */
    flags: number;
    /** Time of the event. */
    time: number;
}

/** A class to hook into mouse events on Windows. */
export class MouseHook extends EventTarget {
    /** Stops the mouse hook and cleans up resources. */
    close(): void;

    /** Strictly typed addEventListener. */
    addEventListener(
        type: "mousemove" | "mousedown" | "mouseup" | "mousewheel",
        listener: (event: CustomEvent<MouseEvent>) => void,
    ): void;
}

/** Enumeration of mouse buttons and their values. */
export const MouseButton = {
    Left: 0x0001,
    Right: 0x0002,
    Middle: 0x0010,
    X1: 0x0020,
    X2: 0x0040,
};
```

## Related

[`@nktkas/keyboard-hook`](https://github.com/nktkas/keyboard-hook) - Windows keyboard listening for Deno with zero
dependencies.

[`@nktkas/windows-screenshot`](https://github.com/nktkas/windows-screenshot) - Windows screen capture for Deno with zero
dependencies.
