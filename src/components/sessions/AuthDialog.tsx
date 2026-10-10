import { useId, useRef, useState, type FormEvent } from 'react';
import Modal from './Modal';
import styles from './Sessions.module.css';
import { authenticate, openDialog } from '../../state/session';
import { PASSWORD_MIN, USERNAME_MIN, usernameProblem } from '../../state/schema';

type Field = 'username' | 'password' | 'confirm';

interface FormError {
  /** Which field the message is about, so it shows under that field; null for general errors. */
  field: Field | null;
  text: string;
}

/** Server messages name the field they're about; route them under it. */
function fieldOf(message: string): Field | null {
  if (/username/i.test(message) && !/password/i.test(message)) return 'username';
  if (/^password/i.test(message)) return 'password';
  return null;
}

export default function AuthDialog() {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<FormError | null>(null);
  const [busy, setBusy] = useState(false);
  const refs = { username: useRef<HTMLInputElement>(null), password: useRef<HTMLInputElement>(null), confirm: useRef<HTMLInputElement>(null) };
  const registering = mode === 'register';
  const uid = useId();
  const idOf = (part: string) => `${uid}-${part}`;

  // While creating an account, flag a bad username as it's typed rather than after submitting.
  const liveUsernameProblem = registering && username.trim() ? usernameProblem(username) : null;
  const shownError: FormError | null = error ?? (liveUsernameProblem ? { field: 'username', text: liveUsernameProblem } : null);

  const fail = (e: FormError) => {
    setError(e);
    if (e.field) refs[e.field].current?.focus();
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (registering) {
      const problem = usernameProblem(username);
      if (problem) return fail({ field: 'username', text: problem });
      if (password.length < PASSWORD_MIN) {
        return fail({ field: 'password', text: `Password must be at least ${PASSWORD_MIN} characters.` });
      }
      if (password !== confirm) return fail({ field: 'confirm', text: 'Passwords do not match.' });
    }
    setBusy(true);
    setError(null);
    try {
      await authenticate(mode, username, password);
    } catch (err) {
      const text = err instanceof Error ? err.message : String(err);
      fail({ field: registering ? fieldOf(text) : null, text });
    } finally {
      setBusy(false);
    }
  };

  const switchMode = () => {
    setMode(registering ? 'login' : 'register');
    setError(null);
  };

  const errorFor = (field: Field | null) =>
    shownError?.field === field ? (
      <span className={styles.fieldError} role="alert" id={idOf(`error-${field ?? 'form'}`)}>
        {shownError.text}
      </span>
    ) : null;

  const inputProps = (field: Field, hasHint: boolean) => ({
    id: idOf(field),
    ref: refs[field],
    'aria-invalid': shownError?.field === field || undefined,
    'aria-describedby':
      [hasHint && idOf(`hint-${field}`), shownError?.field === field && idOf(`error-${field}`)].filter(Boolean).join(' ') ||
      undefined,
  });

  return (
    <Modal title={registering ? 'Create account' : 'Log in'} onClose={() => openDialog(null)}>
      <form className={styles.form} onSubmit={submit} noValidate>
        <div className={styles.field}>
          <label htmlFor={idOf('username')}>Username</label>
          <input
            type="text"
            autoComplete="username"
            inputMode="email"
            autoCapitalize="none"
            spellCheck={false}
            value={username}
            onChange={(e) => {
              setUsername(e.target.value);
              if (error?.field === 'username' || !error?.field) setError(null);
            }}
            required
            {...inputProps('username', registering)}
          />
          {registering && (
            <span className={styles.hint} id={idOf('hint-username')}>
              Your email address, or {USERNAME_MIN}+ characters of letters, numbers, and _ . - @ + (no spaces).
              Others only see the part before the @.
            </span>
          )}
          {errorFor('username')}
        </div>
        <div className={styles.field}>
          <label htmlFor={idOf('password')}>Password</label>
          <input
            type="password"
            autoComplete={registering ? 'new-password' : 'current-password'}
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              if (error?.field === 'password') setError(null);
            }}
            required
            {...inputProps('password', registering)}
          />
          {registering && (
            <span className={styles.hint} id={idOf('hint-password')}>At least {PASSWORD_MIN} characters. Any letters, numbers, or symbols.</span>
          )}
          {errorFor('password')}
        </div>
        {registering && (
          <div className={styles.field}>
            <label htmlFor={idOf('confirm')}>Confirm password</label>
            <input
              type="password"
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => {
                setConfirm(e.target.value);
                if (error?.field === 'confirm') setError(null);
              }}
              required
              {...inputProps('confirm', false)}
            />
            {errorFor('confirm')}
          </div>
        )}
        {errorFor(null)}
        <button type="submit" className="primary" disabled={busy}>
          {registering ? 'Create account' : 'Log in'}
        </button>
        <button type="button" className={styles.link} onClick={switchMode}>
          {registering ? 'Have an account? Log in' : 'New here? Create an account'}
        </button>
      </form>
    </Modal>
  );
}
