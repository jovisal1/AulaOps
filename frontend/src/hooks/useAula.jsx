import { useEffect, useState } from "react";
import { Home, Monitor, Play, Terminal, Settings2 } from "lucide-react";
import useAulaForm from "./useAulaForm";
import useInventory from "./useInventory";
import useRecipes from "./useRecipes";
import useRecipeReview from "./useRecipeReview";
import useExecution from "./useExecution";
import useTaskFeedback from "./useTaskFeedback";
import useGlobalVariables from "./useGlobalVariables";
export default function useAula() {
  const [page, setPage] = useState("home"),
    [step, setStep] = useState(0),
    [pending, setPending] = useState(null),
    [confirmation, setConfirmation] = useState("");
  const feedback = useTaskFeedback();
  const { task, notify, setMessage, setConfirmAction } = feedback;
  const invalidate = () => setPending(null);
  const formState = useAulaForm(invalidate);
  const globalState = useGlobalVariables((values, initial) => {
    formState.applyGlobals(values, initial);
    if (!initial) {
      invalidate();
      setStep((current) => (current === 2 ? 1 : current));
    }
  });
  const inventory = useInventory({
    page,
    ...formState,
    task,
    notify,
    setConfirmAction,
    invalidate,
  });
  const catalogue = useRecipes(feedback);
  const review = useRecipeReview({
    form: formState.form,
    selected: inventory.selected,
    recipes: catalogue.recipes,
    hasCustom: catalogue.hasCustom,
    port: formState.port,
    notify,
    setMessage,
    setPending,
    setStep,
    setConfirmation,
  });
  const execution = useExecution({
    pending,
    confirmation,
    task,
    setForm: formState.setForm,
    setPage,
    setPending,
    setStep,
  });
  const { hasSelection } = inventory;
  const { jobId } = execution;
  const nav = [
    ["home", "Inicio", Home],
    ["equipment", "Equipos", Monitor],
    ["recipes", "Lanzar recetas", Play],
    ["execution", "Logs", Terminal],
    ["globals", "Variables", Settings2],
  ];
  function go(next) {
    if (next === "recipes" && !hasSelection) return;
    if (next === "execution" && (!hasSelection || !jobId)) return;
    if (next === "recipes" && step === 2 && !pending) setStep(1);
    setPage(next);
    setMessage(null);
  }
  useEffect(() => {
    if (!hasSelection && ["recipes", "execution"].includes(page))
      setPage("equipment");
  }, [hasSelection, page]);

  return {
    ...feedback,
    ...formState,
    ...globalState,
    ...inventory,
    ...catalogue,
    ...review,
    ...execution,
    page,
    go,
    nav,
    step,
    setStep,
    pending,
    setPending,
    confirmation,
    setConfirmation,
  };
}
