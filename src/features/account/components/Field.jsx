export default function Field({
  label,
  type = "text",
  value,
  onChange,
  placeholder = " ",
  autoComplete,
  inputProps = {},
}) {
  return (
    <div className="fld">
      <input
        className="fld-input"
        type={type}
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        autoComplete={autoComplete}
        {...inputProps}
        required
      />
      <label className="fld-label">{label}</label>
    </div>
  );
}
