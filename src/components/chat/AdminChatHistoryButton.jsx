import { Button } from '@/components/ui/button';

export default function AdminChatHistoryButton({ hasMore, loading, onLoad }) {
  if (!hasMore) return null;
  return (
    <div className="flex justify-center pb-2">
      <Button variant="outline" size="sm" disabled={loading} onClick={onLoad}>
        {loading ? 'Loading earlier messages...' : 'Load earlier messages'}
      </Button>
    </div>
  );
}