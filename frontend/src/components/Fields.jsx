import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
export function Field({
  id,
  label,
  value,
  onChange,
  help,
  multiline = false,
  ...props
}) {
  const Control = multiline ? Textarea : Input;
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <Control
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-describedby={help ? id + "-help" : undefined}
        {...props}
      />
      {help && (
        <p
          id={id + "-help"}
          className="text-xs leading-5 text-muted-foreground"
        >
          {help}
        </p>
      )}
    </div>
  );
}
export function CheckField({ id, checked, onChange, children }) {
  return (
    <div className="flex items-start gap-3">
      <Checkbox
        id={id}
        checked={checked}
        onCheckedChange={(v) => onChange(v === true)}
        className="mt-0.5"
      />
      <Label htmlFor={id} className="text-sm font-normal leading-5">
        {children}
      </Label>
    </div>
  );
}
