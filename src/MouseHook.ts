import { TypedEventTarget } from "@derzade/typescript-event-target";

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

/** Event map for the {@linkcode MouseHook} class. */
export interface MouseHookEventMap {
    mousemove: CustomEvent<MouseEvent>;
    mousedown: CustomEvent<MouseEvent>;
    mouseup: CustomEvent<MouseEvent>;
    mousewheel: CustomEvent<MouseEvent>;
}

/** Enumeration of mouse buttons and their values. */
export const MouseButton = {
    Left: 0x0001,
    Right: 0x0002,
    Middle: 0x0010,
    X1: 0x0020,
    X2: 0x0040,
} as const;

/** A class to hook into mouse events on Windows. */
export class MouseHook extends TypedEventTarget<MouseHookEventMap> {
    private static readonly WH_MOUSE_LL = 14;
    private static readonly WM_MOUSEMOVE = 0x0200;
    private static readonly WM_LBUTTONDOWN = 0x0201;
    private static readonly WM_LBUTTONUP = 0x0202;
    private static readonly WM_RBUTTONDOWN = 0x0204;
    private static readonly WM_RBUTTONUP = 0x0205;
    private static readonly WM_MBUTTONDOWN = 0x0207;
    private static readonly WM_MBUTTONUP = 0x0208;
    private static readonly WM_MOUSEWHEEL = 0x020A;
    private static readonly WM_XBUTTONDOWN = 0x020B;
    private static readonly WM_XBUTTONUP = 0x020C;

    private static readonly eventNameMap: Map<number, keyof MouseHookEventMap> = new Map([
        [MouseHook.WM_MOUSEMOVE, "mousemove"],
        [MouseHook.WM_LBUTTONDOWN, "mousedown"],
        [MouseHook.WM_LBUTTONUP, "mouseup"],
        [MouseHook.WM_RBUTTONDOWN, "mousedown"],
        [MouseHook.WM_RBUTTONUP, "mouseup"],
        [MouseHook.WM_MBUTTONDOWN, "mousedown"],
        [MouseHook.WM_MBUTTONUP, "mouseup"],
        [MouseHook.WM_MOUSEWHEEL, "mousewheel"],
        [MouseHook.WM_XBUTTONDOWN, "mousedown"],
        [MouseHook.WM_XBUTTONUP, "mouseup"],
    ]);

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
                    const eventName = MouseHook.eventNameMap.get(wParam);
                    if (eventName) {
                        const view = new Deno.UnsafePointerView(lParam);
                        // MSLLHOOKSTRUCT structure:
                        // https://learn.microsoft.com/en-us/windows/win32/api/winuser/ns-winuser-msllhookstruct
                        this.dispatchEvent(
                            new CustomEvent(eventName, {
                                detail: {
                                    // First two DWORD (32-bit) values are x and y coordinates
                                    x: view.getInt32(0),
                                    y: view.getInt32(4),
                                    // Next DWORD is mouseData (wheel delta, xbutton info)
                                    mouseData: view.getInt32(8),
                                    // Next DWORD is flags
                                    flags: view.getUint32(12),
                                    // Last DWORD is time
                                    time: view.getUint32(16),
                                },
                            }),
                        );
                    }
                }
                return this.user32.symbols.CallNextHookEx(null, nCode, wParam, lParam);
            },
        );

        const hookHandle = this.user32.symbols.SetWindowsHookExW(
            MouseHook.WH_MOUSE_LL,
            this.callback.pointer,
            null,
            0,
        );
        if (hookHandle === null) {
            this.close();
            throw new Error("Failed to install mouse hook");
        }
        this.hookHandle = hookHandle;

        this.user32.symbols.GetMessageW(Deno.UnsafePointer.of(new Uint8Array(48)), null, 0, 0);
    }

    /** Closes the mouse hook and releases resources. */
    close(): void {
        this.user32.symbols.PostQuitMessage(0);
        this.user32.symbols.UnhookWindowsHookEx(this.hookHandle);
        this.callback.close();
        this.user32.close();
    }
}
