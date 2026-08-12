import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { isBookmarked, subscribeBookmarks, toggleBookmark, type Bookmark } from "@/lib/bookmarks";

/** Hydration-safe bookmark state for a single item. */
export function useBookmark(item: Omit<Bookmark, "savedAt">) {
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setSaved(isBookmarked(item.id));
    return subscribeBookmarks(() => setSaved(isBookmarked(item.id)));
  }, [item.id]);

  const toggle = useCallback(() => {
    const next = toggleBookmark(item);
    setSaved(next);
    toast.success(next ? "تمت الإضافة إلى المحفوظات" : "تمت الإزالة من المحفوظات");
  }, [item]);

  return { saved, toggle };
}
