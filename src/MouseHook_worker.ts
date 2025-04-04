import { TypedEventTarget } from "@derzade/typescript-event-target";
import type { MouseHookEventMap } from "./MouseHook.ts";

/** A class to globally listen for mouse events in Windows. */
export class MouseHook extends TypedEventTarget<MouseHookEventMap> {
    private readonly worker: Worker;

    constructor() {
        super();

        // Full worker code with all mouse hook implementation inlined
        // This completely avoids any imports or file reading
        const workerCode = `
// —————————— Mouse Hook ——————————

const MouseEventNameMap = {
    0x0201: "lbuttondown",
    0x0202: "lbuttonup",
    0x0204: "rbuttondown",
    0x0205: "rbuttonup",
    0x0207: "mbuttondown",
    0x0208: "mbuttonup",
    0x020B: "xbuttondown",
    0x020C: "xbuttonup",
    0x0200: "mousemove",
    0x020A: "mousewheel",
};

class MouseHook extends EventTarget {
    #user32;
    constructor() {
        super();
        this.#user32 = Deno.dlopen("user32.dll", {
            SetWindowsHookExW: { parameters: ["i32", "pointer", "pointer", "u32"], result: "pointer" },
            CallNextHookEx: { parameters: ["pointer", "i32", "u32", "pointer"], result: "i32" },
            GetMessageW: { parameters: ["pointer", "pointer", "u32", "u32"], result: "i32" },
        });
    }

    start() {
        const callback = Deno.UnsafeCallback.threadSafe(
            { parameters: ["i32", "u32", "pointer"], result: "i32" },
            (nCode, wParam, lParam) => {
                if (nCode >= 0 && lParam !== null) {
                    const eventName = MouseEventNameMap[wParam] ?? wParam;
                    const view = new Deno.UnsafePointerView(lParam);

                    const pt = { x: view.getInt32(0), y: view.getInt32(4) };

                    let mouseData = (view.getInt32(8) >> 16) & 0xFFFF;
                    if (eventName === "mousewheel" && mouseData & 0x8000) mouseData -= 0x10000;

                    const rawFlags = view.getUint32(12);
                    const flags = {
                        injected: (rawFlags & 0x01) !== 0,
                        lowerIlInjected: (rawFlags & 0x02) !== 0,
                    };

                    const time = view.getUint32(16);

                    this.dispatchEvent(new CustomEvent(eventName, { detail: { pt, mouseData, flags, time } }));
                }
                return this.#user32.symbols.CallNextHookEx(null, nCode, wParam, lParam);
            },
        );

        if (!this.#user32.symbols.SetWindowsHookExW(14, callback.pointer, null, 0)) {
            callback.close();
            this.#user32.close();
            self.close();
        }

        this.#user32.symbols.GetMessageW(Deno.UnsafePointer.of(new Uint8Array(48)), null, 0, 0);
    }
}

// —————————— Worker ——————————

const hook = new MouseHook();
[
    "lbuttondown",
    "lbuttonup",
    "rbuttondown",
    "rbuttonup",
    "mbuttondown",
    "mbuttonup",
    "xbuttondown",
    "xbuttonup",
    "mousemove",
    "mousewheel",
].forEach((eventName) => {
    hook.addEventListener(eventName, (event) => {
        self.postMessage({ type: eventName, detail: event.detail });
    });
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
