# mouse-hook

[![JSR](https://jsr.io/badges/@nktkas/mouse-hook)](https://jsr.io/@nktkas/mouse-hook)

Global Windows mouse listener for Deno with zero dependencies.

## Usage example

```ts
import { MouseHook } from "@nktkas/mouse-hook";

const hook = new MouseHook();
hook.addEventListener("lbuttondown", (event) => {
    console.log("Left button down | X:", event.detail.pt.x, "Y:", event.detail.pt.y);
});
hook.addEventListener("lbuttonup", (event) => {
    console.log("Left button up | X:", event.detail.pt.x, "Y:", event.detail.pt.y);
});
hook.addEventListener("rbuttondown", (event) => {
    console.log("Right button down | X:", event.detail.pt.x, "Y:", event.detail.pt.y);
});
hook.addEventListener("rbuttonup", (event) => {
    console.log("Right button up | X:", event.detail.pt.x, "Y:", event.detail.pt.y);
});
hook.addEventListener("mbuttondown", (event) => {
    console.log("Middle button down | X:", event.detail.pt.x, "Y:", event.detail.pt.y);
});
hook.addEventListener("mbuttonup", (event) => {
    console.log("Middle button up | X:", event.detail.pt.x, "Y:", event.detail.pt.y);
});
hook.addEventListener("xbuttondown", (event) => {
    console.log("X button down | X:", event.detail.pt.x, "Y:", event.detail.pt.y);
});
hook.addEventListener("xbuttonup", (event) => {
    console.log("X button up | X:", event.detail.pt.x, "Y:", event.detail.pt.y);
});
hook.addEventListener("mousemove", (event) => {
    console.log("Mouse move | X:", event.detail.pt.x, "Y:", event.detail.pt.y);
});
hook.addEventListener("mousewheel", (event) => {
    console.log("Mouse wheel | Scroll:", event.detail.mouseData);
});

// When done, clean up resources
// hook.close();
```

## API

```ts
/** Contains information about a low-level mouse input event. */
export interface MouseEvent {
    /** The x- and y-coordinates of the cursor, in per-monitor-aware screen coordinates. */
    pt: Point;
    /**
     * The mouse data.
     * - If the message is WM_MOUSEWHEEL, indicates the distance the wheel is rotated, expressed in multiples or divisions of WHEEL_DELTA, which is 120.
     * - If the message is WM_XBUTTONDOWN or WM_XBUTTONUP, specifies which X button was pressed or released.
     * - Otherwise, it is 0.
     */
    mouseData: number;
    /** The event-injected flags. */
    flags: Flag;
    /** Time since the system started, in milliseconds. */
    time: number;
}

/** The POINT structure defines the x- and y-coordinates of a point. */
export interface Point {
    /** Specifies the x-coordinate of the point. */
    x: number;
    /** Specifies the y-coordinate of the point. */
    y: number;
}

/** Disassembled MSLLHOOKSTRUCT flags. */
export interface Flag {
    /** Set if the event was injected */
    injected: boolean;
    /** Set if the event was injected by a lower IL thread */
    lowerIlInjected: boolean;
}

/** A class to globally listen for mouse events in Windows. */
export class MouseHook extends EventTarget {
    /** Strictly typed addEventListener. */
    addEventListener(
        type:
            | "lbuttondown"
            | "lbuttonup"
            | "rbuttondown"
            | "rbuttonup"
            | "mbuttondown"
            | "mbuttonup"
            | "xbuttondown"
            | "xbuttonup"
            | "mousemove"
            | "mousewheel",
        listener: (event: CustomEvent<MouseEvent>) => void,
    ): void;

    /** Stops the mouse hook and cleans up resources. */
    close(): void;
}
```

## Related

[`@nktkas/keyboard-hook`](https://github.com/nktkas/keyboard-hook) - Global Windows keyboard listener for Deno with zero
dependencies.

[`@nktkas/windows-screenshot`](https://github.com/nktkas/windows-screenshot) - Windows screen capture for Deno with zero
dependencies.
