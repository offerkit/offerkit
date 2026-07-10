export function FormFieldErrors({
  errors,
  visible,
}: {
  errors: readonly unknown[];
  visible: boolean;
}) {
  const messages = errors.flatMap((error) => {
    if (typeof error === "string") return [error];
    if (error && typeof error === "object" && "message" in error) {
      const message = error.message;
      return typeof message === "string" ? [message] : [];
    }
    return [];
  });

  if (!visible || messages.length === 0) return null;
  return (
    <div className="space-y-1 text-sm text-destructive" role="alert">
      {messages.map((message) => (
        <p key={message}>{message}</p>
      ))}
    </div>
  );
}
