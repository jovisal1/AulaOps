import { useState } from "react";
import { usePreferences } from "@/i18n";
import { Field } from "@/components/Fields";
import { defaults } from "@/lib/aulaForm";
export default function useAulaForm(onChange) {
  const { t } = usePreferences();
  const [form, setForm] = useState(defaults);
  const update = (key, value) => {
    setForm((current) => ({ ...current, [key]: value }));
    onChange();
  };
  const field = (key, label, props = {}) => (
    <Field
      key={key}
      id={key}
      label={t(label)}
      value={form[key]}
      onChange={(value) => update(key, value)}
      {...props}
    />
  );
  function port() {
    const value = Number(form.port);
    if (!Number.isInteger(value) || value < 1 || value > 65535)
      throw Error(t("Puerto SSH inválido.", "Port SSH invàlid."));
    return value;
  }
  function applyGlobals(values, initial) {
    const mapped = {
      target_user: values.aula_user,
      jdk: String(values.aula_jdk),
      extensions: values.aula_extensions.join("\n"),
      settings: JSON.stringify(values.aula_settings, null, 2),
      folders: values.aula_folders.join("\n"),
      reset_password: values.aula_reset_password,
      user_sudo: values.aula_user_sudo ?? true,
      delete_home: values.aula_delete_home,
    };
    setForm((current) => ({
      ...current,
      ...Object.fromEntries(
        Object.entries(mapped).filter(
          ([key]) => !initial || current[key] === defaults[key],
        ),
      ),
    }));
  }
  return { form, setForm, update, field, port, applyGlobals };
}
