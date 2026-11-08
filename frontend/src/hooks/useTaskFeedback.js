import { useEffect, useRef, useState } from "react";
export default function useTaskFeedback() {
  const [busy, setBusy] = useState(""),
    [message, setMessage] = useState(null),
    [confirmAction, setConfirmAction] = useState(null);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const notify = (text, error = false) => setMessage({ text, error });
  async function task(key, operation) {
    if (busy) return;
    setBusy(key);
    setMessage(null);
    try {
      await operation();
    } catch (error) {
      notify(error.message, true);
    } finally {
      if (mounted.current) setBusy("");
    }
  }

  return {
    busy,
    setBusy,
    message,
    setMessage,
    confirmAction,
    setConfirmAction,
    notify,
    task,
  };
}
