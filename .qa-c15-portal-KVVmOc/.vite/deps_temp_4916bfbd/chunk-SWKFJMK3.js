import {
  require_react
} from "./chunk-OKCOXGWL.js";
import {
  __toESM
} from "./chunk-WOOG5QLI.js";

// ../site-ai-disclosure/node_modules/@radix-ui/react-use-layout-effect/dist/index.mjs
var React = __toESM(require_react(), 1);
var useLayoutEffect2 = (globalThis == null ? void 0 : globalThis.document) ? React.useLayoutEffect : () => {
};

// ../site-ai-disclosure/node_modules/@radix-ui/react-use-callback-ref/dist/index.mjs
var React2 = __toESM(require_react(), 1);
function useCallbackRef(callback) {
  const callbackRef = React2.useRef(callback);
  React2.useEffect(() => {
    callbackRef.current = callback;
  });
  return React2.useMemo(() => (...args) => {
    var _a;
    return (_a = callbackRef.current) == null ? void 0 : _a.call(callbackRef, ...args);
  }, []);
}

// ../site-ai-disclosure/node_modules/@radix-ui/react-use-escape-keydown/dist/index.mjs
var React3 = __toESM(require_react(), 1);
function useEscapeKeydown(onEscapeKeyDownProp, ownerDocument = globalThis == null ? void 0 : globalThis.document) {
  const onEscapeKeyDown = useCallbackRef(onEscapeKeyDownProp);
  React3.useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        onEscapeKeyDown(event);
      }
    };
    ownerDocument.addEventListener("keydown", handleKeyDown, { capture: true });
    return () => ownerDocument.removeEventListener("keydown", handleKeyDown, { capture: true });
  }, [onEscapeKeyDown, ownerDocument]);
}

export {
  useLayoutEffect2,
  useCallbackRef,
  useEscapeKeydown
};
//# sourceMappingURL=chunk-SWKFJMK3.js.map
