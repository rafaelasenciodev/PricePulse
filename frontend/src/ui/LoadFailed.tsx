import { screens } from "../texts";

/** A read that failed: what the person is told, with nothing of the cause (BR-12), and a way to try again. */
export function LoadFailed({ message, onRetry }: { readonly message: string; readonly onRetry: () => void }) {
  return (
    <div>
      <p role="alert" className="error">
        {message}
      </p>
      <button type="button" onClick={onRetry}>
        {screens.retry}
      </button>
    </div>
  );
}
