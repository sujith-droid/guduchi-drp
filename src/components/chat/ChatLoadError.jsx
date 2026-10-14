import { Button } from '@/components/ui/button';

export default function ChatLoadError({ message, onRetry }) {
  if (!message) return null;
  return (
    <div role="alert" className="rounded-xl border border-destructive/30 bg-card p-4 text-center space-y-3">
      <p className="text-sm text-destructive">{message}</p>
      <Button variant="outline" onClick={onRetry}>Try again</Button>
    </div>
  );
}