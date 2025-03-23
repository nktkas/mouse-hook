import { TypedEventTarget } from "@derzade/typescript-event-target";
import type { MouseHookEventMap } from "./MouseHook.ts";

/** A class to hook into mouse events on Windows using a Worker. */
export class MouseHook extends TypedEventTarget<MouseHookEventMap> {
    private readonly worker: Worker;

    constructor() {
        super();

        // Full worker code with all mouse hook implementation inlined
        // This completely avoids any imports or file reading
        const workerCode = `
// —————————— Mouse Hook ——————————

const WH_MOUSE_LL = 14;
const WM_MOUSEMOVE = 0x0200;
const WM_LBUTTONDOWN = 0x0201;
const WM_LBUTTONUP = 0x0202;
const WM_RBUTTONDOWN = 0x0204;
const WM_RBUTTONUP = 0x0205;
const WM_MBUTTONDOWN = 0x0207;
const WM_MBUTTONUP = 0x0208;
const WM_MOUSEWHEEL = 0x020A;
const WM_XBUTTONDOWN = 0x020B;
const WM_XBUTTONUP = 0x020C;

const eventNameMap = new Map([
    [WM_MOUSEMOVE, "mousemove"],
    [WM_LBUTTONDOWN, "mousedown"],
    [WM_LBUTTONUP, "mouseup"],
    [WM_RBUTTONDOWN, "mousedown"],
    [WM_RBUTTONUP, "mouseup"],
    [WM_MBUTTONDOWN, "mousedown"],
    [WM_MBUTTONUP, "mouseup"],
    [WM_MOUSEWHEEL, "mousewheel"],
    [WM_XBUTTONDOWN, "mousedown"],
    [WM_XBUTTONUP, "mouseup"],
]);

class MouseHook extends EventTarget {
    #user32;

    constructor() {
        super();

        this.#user32 = Deno.dlopen("user32.dll", {
            SetWindowsHookExW: {
                parameters: ["i32", "pointer", "pointer", "u32"],
                result: "pointer",
            },
            CallNextHookEx: {
                parameters: ["pointer", "i32", "u32", "pointer"],
                result: "i32",
            },
            GetMessageW: {
                parameters: ["pointer", "pointer", "u32", "u32"],
                result: "i32",
            },
        });
    }

    start() {
        const callback = Deno.UnsafeCallback.threadSafe(
            { parameters: ["i32", "u32", "pointer"], result: "i32" },
            (nCode, wParam, lParam) => {
                if (nCode >= 0 && lParam !== null) {
                    const eventName = eventNameMap.get(wParam);
                    if (eventName) {
                        const view = new Deno.UnsafePointerView(lParam);
                        this.dispatchEvent(
                            new CustomEvent(eventName, {
                                detail: {
                                    x: view.getInt32(0),
                                    y: view.getInt32(4),
                                    mouseData: view.getInt32(8),
                                    flags: view.getUint32(12),
                                    time: view.getUint32(16),
                                },
                            }),
                        );
                    }
                }
                return this.#user32.symbols.CallNextHookEx(null, nCode, wParam, lParam);
            },
        );

        if (!this.#user32.symbols.SetWindowsHookExW(WH_MOUSE_LL, callback.pointer, null, 0)) {
            callback.close();
            this.#user32.close();
            self.close();
        }

        this.#user32.symbols.GetMessageW(Deno.UnsafePointer.of(new Uint8Array(48)), null, 0, 0);
    }
}

// —————————— Worker ——————————

const hook = new MouseHook();
hook.addEventListener("mousemove", (event) => {
    self.postMessage({ type: "mousemove", detail: event.detail });
});
hook.addEventListener("mousedown", (event) => {
    self.postMessage({ type: "mousedown", detail: event.detail });
});
hook.addEventListener("mouseup", (event) => {
    self.postMessage({ type: "mouseup", detail: event.detail });
});
hook.addEventListener("mousewheel", (event) => {
    self.postMessage({ type: "mousewheel", detail: event.detail });
});
hook.start();
`;

        // Create a blob URL from the worker code
        const blob = new Blob([workerCode], { type: "application/javascript" });
        const blobURL = URL.createObjectURL(blob);

        // Create the worker from the blob URL
        this.worker = new Worker(blobURL, { type: "module" });

        // Forward events from the worker to this event target
        this.worker.onmessage = (event) => {
            const { type, detail } = event.data;
            this.dispatchEvent(new CustomEvent(type, { detail }));
        };

        // Clean up the blob URL when it's no longer needed
        URL.revokeObjectURL(blobURL);
    }

    /** Closes the mouse hook and releases resources. */
    close(): void {
        this.worker.terminate();
    }
}
