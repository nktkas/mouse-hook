import { TypedEventTarget } from "@derzade/typescript-event-target";

/**
 * Contains information about a low-level mouse input event.
 * @link https://learn.microsoft.com/en-us/windows/win32/api/winuser/ns-winuser-msllhookstruct
 */
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

/**
 * The POINT structure defines the x- and y-coordinates of a point.
 * @link https://learn.microsoft.com/en-us/windows/win32/api/windef/ns-windef-point
 */
export interface Point {
    /** Specifies the x-coordinate of the point. */
    x: number;
    /** Specifies the y-coordinate of the point. */
    y: number;
}

/**
 * Disassembled MSLLHOOKSTRUCT flags.
 * @link https://learn.microsoft.com/en-us/windows/win32/api/winuser/ns-winuser-msllhookstruct#members
 */
export interface Flag {
    /** Set if the event was injected */
    injected: boolean;
    /** Set if the event was injected by a lower IL thread */
    lowerIlInjected: boolean;
}

/** Event map for the {@linkcode MouseHook} class. */
export interface MouseHookEventMap {
    lbuttondown: CustomEvent<MouseEvent>;
    lbuttonup: CustomEvent<MouseEvent>;
    rbuttondown: CustomEvent<MouseEvent>;
    rbuttonup: CustomEvent<MouseEvent>;
    mbuttondown: CustomEvent<MouseEvent>;
    mbuttonup: CustomEvent<MouseEvent>;
    xbuttondown: CustomEvent<MouseEvent>;
    xbuttonup: CustomEvent<MouseEvent>;
    mousemove: CustomEvent<MouseEvent>;
    mousewheel: CustomEvent<MouseEvent>;
}

/**
 * Maps Windows message identifiers to mouse event names.
 * @link https://learn.microsoft.com/en-us/windows/win32/winmsg/lowlevelmouseproc#wparam-in
 */
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
} as const;

/**
 * A class to globally listen for mouse events in Windows.
 *
 * **WARNING**: The class blocks the event loop. Therefore, run it in a separate thread.
 */
export class MouseHook extends TypedEventTarget<MouseHookEventMap> implements Disposable {
    private readonly user32 = Deno.dlopen("user32.dll", {
        /**
         * Installs an application-defined hook procedure into a hook chain.
         * You would install a hook procedure to monitor the system for certain types of events.
         * These events are associated either with a specific thread or with all threads in the same desktop as the calling thread.
         * @param {int} idHook [in] The type of hook procedure to be installed.
         * @param {HOOKPROC} lpfn [in] A pointer to the hook procedure.
         * @param {HINSTANCE} hmod [in] A handle to the DLL containing the hook procedure pointed to by the lpfn parameter.
         * @param {DWORD} dwThreadId [in] The identifier of the thread with which the hook procedure is to be associated.
         * @returns {HHOOK} If the function succeeds, the return value is the handle to the hook procedure.
         * @link https://learn.microsoft.com/en-us/windows/win32/api/winuser/nf-winuser-setwindowshookexw
         */
        SetWindowsHookExW: {
            parameters: ["i32", "pointer", "pointer", "u32"],
            result: "pointer",
        },
        /**
         * Passes the hook information to the next hook procedure in the current hook chain.
         * A hook procedure can call this function either before or after processing the hook information.
         * @param {HHOOK} hhk [in, optional] This parameter is ignored.
         * @param {int} nCode [in] The hook code passed to the current hook procedure.
         * @param {WPARAM} wParam [in] The wParam value passed to the current hook procedure.
         * @param {LPARAM} lParam [in] The lParam value passed to the current hook procedure.
         * @returns {LRESULT} This value is returned by the next hook procedure in the chain.
         * @link https://learn.microsoft.com/en-us/windows/win32/api/winuser/nf-winuser-callnexthookex
         */
        CallNextHookEx: {
            parameters: ["pointer", "i32", "u32", "pointer"],
            result: "i32",
        },
        /**
         * Retrieves a message from the calling thread's message queue.
         * The function dispatches incoming sent messages until a posted message is available for retrieval.
         * @param {LPMSG} lpMsg [out] A pointer to an MSG structure that receives message information from the thread's message queue.
         * @param {HWND} hWnd [in, optional] A handle to the window whose messages are to be retrieved.
         * @param {UINT} wMsgFilterMin [in] The integer value of the lowest message value to be retrieved.
         * @param {UINT} wMsgFilterMax [in] The integer value of the highest message value to be retrieved.
         * @returns {int} If the function retrieves a message other than WM_QUIT, the return value is nonzero.
         * @link https://learn.microsoft.com/en-us/windows/win32/api/winuser/nf-winuser-getmessagew
         */
        GetMessageW: {
            parameters: ["pointer", "pointer", "u32", "u32"],
            result: "i32",
        },
        /**
         * Indicates to the system that a thread has made a request to terminate (quit).
         * It is typically used in response to a WM_DESTROY message.
         * @param {int} nExitCode [in] The application exit code.
         * @returns {void} This function does not return a value.
         * @link https://learn.microsoft.com/en-us/windows/win32/api/winuser/nf-winuser-postquitmessage
         */
        PostQuitMessage: {
            parameters: ["i32"],
            result: "void",
        },
        /**
         * Removes a hook procedure installed in a hook chain by the SetWindowsHookEx function.
         * @param {HHOOK} hhk [in] A handle to the hook to be removed.
         * @returns {BOOL} If the function succeeds, the return value is nonzero.
         * @link https://learn.microsoft.com/en-us/windows/win32/api/winuser/nf-winuser-unhookwindowshookex
         */
        UnhookWindowsHookEx: {
            parameters: ["pointer"],
            result: "i32",
        },
    });

    private readonly callback: Deno.UnsafeCallback<{ parameters: ["i32", "u32", "pointer"]; result: "i32" }>;
    private readonly hookHandle: Deno.PointerObject;

    constructor() {
        super();

        this.callback = Deno.UnsafeCallback.threadSafe(
            { parameters: ["i32", "u32", "pointer"], result: "i32" },
            (nCode, wParam, lParam) => {
                if (nCode >= 0 && lParam !== null) {
                    // Get the event name and lParam pointer
                    const eventName = MouseEventNameMap[wParam as keyof typeof MouseEventNameMap] ?? wParam;
                    const view = new Deno.UnsafePointerView(lParam);

                    // Get the mouse coordinates
                    const pt: Point = { x: view.getInt32(0), y: view.getInt32(4) };

                    // Get the mouse data
                    let mouseData = (view.getInt32(8) >> 16) & 0xFFFF;
                    if (eventName === "mousewheel" && mouseData & 0x8000) mouseData -= 0x10000;

                    // Get the event flags
                    const rawFlags = view.getUint32(12);
                    const flags = {
                        injected: (rawFlags & 0x01) !== 0,
                        lowerIlInjected: (rawFlags & 0x02) !== 0,
                    };

                    // Get the event time
                    const time = view.getUint32(16);

                    // Dispatch the event
                    this.dispatchEvent(new CustomEvent(eventName, { detail: { pt, mouseData, flags, time } }));
                }
                return this.user32.symbols.CallNextHookEx(null, nCode, wParam, lParam);
            },
        );

        const hookHandle = this.user32.symbols.SetWindowsHookExW(14, this.callback.pointer, null, 0);
        if (hookHandle === null) {
            this.callback.close();
            this.user32.close();
            throw new Error("Failed to install mouse hook");
        }
        this.hookHandle = hookHandle;

        this.user32.symbols.GetMessageW(Deno.UnsafePointer.of(new Uint8Array(48)), null, 0, 0);
    }

    /**
     * Closes the mouse hook and releases resources.
     *
     * **NOTE**: does not work because the event loop is blocked.
     */
    close(): void {
        this.user32.symbols.PostQuitMessage(0);
        this.user32.symbols.UnhookWindowsHookEx(this.hookHandle);
        this.callback.close();
        this.user32.close();
    }

    [Symbol.dispose](): void {
        this.close();
    }
}
