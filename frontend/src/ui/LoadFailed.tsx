import { screens } from "../texts";
import { Button } from "./Button";

/** A read that failed: what the person is told, with nothing of the cause (BR-12), and a way to try again. */
export function LoadFailed({ message, onRetry }: { readonly message: string; readonly onRetry: () => void }) {
  return (
    <div className="flex flex-col items-start gap-3">
      <p role="alert" className="text-danger">
        {message}
      </p>
      <Button variant="secondary" onClick={onRetry}>
        {screens.retry}
      </Button>
    </div>
  );
}
