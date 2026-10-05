import { useState } from "react";
import { Button } from "@/components/ui/button";

/**
 * Renders a long list in batches so big lists (hundreds of rows with dropdowns)
 * don't freeze the page. Give it a `key` that changes when the list is
 * re-filtered so it starts again from the first batch.
 */
export default function PagedList({ items, renderItem, pageSize = 30, className = "space-y-2" }) {
  const [count, setCount] = useState(pageSize);
  const remaining = items.length - count;

  return (
    <>
      <div className={className}>{items.slice(0, count).map(renderItem)}</div>
      {remaining > 0 && (
        <Button
          variant="outline"
          className="w-full mt-3"
          onClick={() => setCount((c) => c + pageSize)}
        >
          Show more ({remaining} remaining)
        </Button>
      )}
    </>
  );
}