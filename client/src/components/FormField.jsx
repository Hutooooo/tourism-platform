/**
 * Form primitives shared by the public contact/booking forms and the
 * admin dashboard. Each field wires up label, aria-describedby and
 * aria-invalid so errors are announced to screen readers.
 */

export function FormField({ label, required, error, hint, htmlFor, children, className = '' }) {
  const errorId = error && htmlFor ? `${htmlFor}-error` : undefined;
  const hintId = hint && htmlFor ? `${htmlFor}-hint` : undefined;

  return (
    <div className={`field ${className}`.trim()}>
      <label className="field__label" htmlFor={htmlFor}>
        {label}
        {required && (
          <span className="field__req" aria-hidden="true">
            *
          </span>
        )}
      </label>
      {typeof children === 'function'
        ? children({ describedBy: [hintId, errorId].filter(Boolean).join(' ') || undefined, invalid: !!error })
        : children}
      {hint && !error && (
        <span className="field__hint" id={hintId}>
          {hint}
        </span>
      )}
      {error && (
        <span className="field__error" id={errorId} role="alert">
          {error}
        </span>
      )}
    </div>
  );
}

export function TextField({ id, label, required, error, hint, ...rest }) {
  return (
    <FormField label={label} required={required} error={error} hint={hint} htmlFor={id}>
      {({ describedBy, invalid }) => (
        <input
          id={id}
          className="input"
          aria-invalid={invalid || undefined}
          aria-describedby={describedBy}
          required={required}
          {...rest}
        />
      )}
    </FormField>
  );
}

export function TextArea({ id, label, required, error, hint, ...rest }) {
  return (
    <FormField label={label} required={required} error={error} hint={hint} htmlFor={id}>
      {({ describedBy, invalid }) => (
        <textarea
          id={id}
          className="textarea"
          aria-invalid={invalid || undefined}
          aria-describedby={describedBy}
          required={required}
          {...rest}
        />
      )}
    </FormField>
  );
}

export function SelectField({ id, label, required, error, hint, options = [], placeholder, ...rest }) {
  return (
    <FormField label={label} required={required} error={error} hint={hint} htmlFor={id}>
      {({ describedBy, invalid }) => (
        <select
          id={id}
          className="select"
          aria-invalid={invalid || undefined}
          aria-describedby={describedBy}
          required={required}
          {...rest}
        >
          {placeholder && <option value="">{placeholder}</option>}
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      )}
    </FormField>
  );
}

export function Alert({ type = 'info', children }) {
  if (!children) return null;
  return (
    <div className={`alert alert--${type}`} role={type === 'error' ? 'alert' : 'status'}>
      {children}
    </div>
  );
}
