import { useEffect, useRef } from "react";

// Full-size view for a chart. Opens over the page. Closes with the Close button or the Escape key.
export default function ExpandDialog({ title, onClose, children }) {
  const closeRef = useRef(null);

  useEffect(() => {
    closeRef.current?.focus();
    function onKey(event) {
      if (event.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [onClose]);

  return (
    <div className="expand-overlay" onClick={onClose}>
      <div
        className="expand-dialog"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="expand-head">
          <h2>{title}</h2>
          <button ref={closeRef} type="button" className="expand-close" onClick={onClose}>
            Close
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
