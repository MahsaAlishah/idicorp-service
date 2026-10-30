import { useEffect, useState } from 'react';
import { getCaptcha, login } from './authApi.js';
import { saveAccessToken } from './authSession.js';
import ConsoleIcon from '../../components/ConsoleIcon.jsx';

const CAPTCHA_DATA_URL_PREFIX = 'data:image/jpeg;base64,';
const NETWORK_ERROR = 'Unable to reach the authentication service.';
const inputClass = 'mt-2 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-[14px] text-slate-900 shadow-sm shadow-slate-900/[0.02] outline-none transition placeholder:text-slate-400 hover:border-slate-300 focus:border-[#4b67e9] focus:ring-4 focus:ring-[#4b67e9]/10';

function isValidCaptcha(response) {
  return (
    response &&
    typeof response.captcha === 'string' &&
    response.captcha.startsWith(CAPTCHA_DATA_URL_PREFIX) &&
    response.captcha.length > CAPTCHA_DATA_URL_PREFIX.length &&
    typeof response.salt === 'string'
  );
}

function isValidLoginResponse(response) {
  return (
    response &&
    typeof response.access_token === 'string' &&
    response.access_token.trim().length > 0 &&
    typeof response.token_type === 'string' &&
    response.token_type.trim().length > 0
  );
}

export default function LoginPage({ onAuthenticated }) {
  const [captcha, setCaptcha] = useState('');
  const [captchaSalt, setCaptchaSalt] = useState('');
  const [isCaptchaLoading, setIsCaptchaLoading] = useState(true);
  const [captchaError, setCaptchaError] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [captchaAnswer, setCaptchaAnswer] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const [requestError, setRequestError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    let isCurrent = true;

    getCaptcha()
      .then((response) => {
        if (!isCurrent) return;
        if (!isValidCaptcha(response)) {
          setCaptchaError('Unable to load CAPTCHA.');
          return;
        }

        setCaptcha(response.captcha);
        setCaptchaSalt(response.salt);
      })
      .catch((error) => {
        if (isCurrent) {
          setCaptchaError(
            error?.message === NETWORK_ERROR
              ? 'Network error. Unable to reach the authentication service.'
              : 'Unable to load CAPTCHA.',
          );
        }
      })
      .finally(() => {
        if (isCurrent) setIsCaptchaLoading(false);
      });

    return () => {
      isCurrent = false;
    };
  }, []);

  async function handleSubmit(event) {
    event.preventDefault();
    setRequestError('');

    const nextFieldErrors = {};
    if (!username.trim()) nextFieldErrors.username = 'Enter your username.';
    if (!password) nextFieldErrors.password = 'Enter your password.';
    if (!captchaAnswer.trim()) {
      nextFieldErrors.captchaAnswer = 'Enter the CAPTCHA answer.';
    }
    setFieldErrors(nextFieldErrors);

    if (Object.keys(nextFieldErrors).length > 0 || !captcha || captchaError) {
      return;
    }

    setIsSubmitting(true);

    try {
      let response;
      try {
        response = await login({
          username,
          password,
          salt: captchaSalt,
          captcha_answer: captchaAnswer,
        });
      } catch (error) {
        setRequestError(
          error?.message === NETWORK_ERROR
            ? 'Network error. Unable to reach the authentication service.'
            : 'Sign-in failed. Please check your credentials and CAPTCHA answer.',
        );
        return;
      }

      if (!isValidLoginResponse(response)) {
        setRequestError('Sign-in failed. The authentication response was invalid.');
        return;
      }

      try {
        saveAccessToken(response.access_token);
      } catch {
        setRequestError('Unable to save your session. Please try again.');
        return;
      }

      onAuthenticated();
    } finally {
      setIsSubmitting(false);
    }
  }

  const isBusy = isCaptchaLoading || isSubmitting;

  return (
    <main id="main-content" tabIndex={-1} className="grid min-h-screen bg-[#f3f5f9] text-[#172337] focus:outline-none lg:grid-cols-[minmax(0,0.96fr)_minmax(450px,1.04fr)]">
      <a href="#main-content" className="skip-link">Skip to sign in</a>
      <section aria-label="Service Console introduction" className="relative isolate flex min-h-[280px] flex-col overflow-hidden bg-[#101b2c] px-5 py-6 text-white sm:px-9 sm:py-8 lg:min-h-screen lg:px-12 lg:py-7 xl:px-16">
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
          <div className="absolute -left-28 -top-36 size-[420px] rounded-full bg-[#365de7]/25 blur-[90px]" />
          <div className="absolute -bottom-56 right-[-12%] size-[520px] rounded-full bg-[#45c7a8]/15 blur-[100px]" />
          <div className="absolute inset-0 opacity-[0.08] [background-image:linear-gradient(rgba(255,255,255,.2)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.2)_1px,transparent_1px)] [background-size:44px_44px] [mask-image:linear-gradient(to_bottom,black,transparent_85%)]" />
        </div>
        <div className="flex items-center gap-3">
          <span className="grid size-11 place-items-center rounded-2xl bg-gradient-to-br from-[#7ce0c2] via-[#51b9c8] to-[#5874f4] text-sm font-black tracking-[-0.08em] text-[#0d1b2d] shadow-lg shadow-[#57cfc0]/15">ID</span>
          <span>
            <span className="block text-[15px] font-bold tracking-wide">IDICorp</span>
            <span className="mt-0.5 block text-[10px] font-semibold uppercase tracking-[0.19em] text-slate-400">Service console</span>
          </span>
        </div>

        <div className="my-auto max-w-[620px] py-10 lg:py-10">
          <p className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.06] px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.17em] text-[#9ce8d6]">
            <span className="size-1.5 rounded-full bg-[#7ce0c2] shadow-[0_0_10px_#7ce0c2]" /> Service operations workspace
          </p>
          <h2 className="mt-6 max-w-[580px] text-[clamp(2.25rem,4.6vw,4rem)] font-semibold leading-[1.04] tracking-[-0.055em] text-white">
            Clarity for every <span className="bg-gradient-to-r from-[#8ce7d0] to-[#9eafff] bg-clip-text text-transparent">service workflow.</span>
          </h2>
          <p className="mt-5 max-w-lg text-sm leading-7 text-slate-300 sm:text-base">
            A focused workspace for managing tasks, calculating, and working with live and streaming services.
          </p>
          <div className="mt-8 grid max-w-lg grid-cols-2 gap-2.5 sm:gap-3">
            {[
              ['01', 'Task management', 'tasks'],
              ['02', 'Live calculator', 'calculator'],
              ['03', 'Text echo', 'echo'],
              ['04', 'Streaming echo', 'streaming'],
            ].map(([index, label, icon]) => (
              <div key={index} className="flex min-w-0 items-center gap-3 rounded-xl border border-white/[0.08] bg-white/[0.045] px-3 py-2.5 backdrop-blur-sm sm:px-4">
                <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-white/[0.07] text-[#9ce8d6]"><ConsoleIcon name={icon} className="size-4" /></span>
                <span className="min-w-0"><span className="block text-[9px] font-bold tracking-[0.12em] text-slate-500">{index}</span><span className="mt-0.5 block truncate text-[11px] font-semibold text-slate-200 sm:text-xs">{label}</span></span>
              </div>
            ))}
          </div>
        </div>
        <p className="hidden text-[10px] font-medium tracking-[0.13em] text-slate-500 sm:block">ONE CONSOLE <span className="px-1.5 text-slate-700">·</span> FOUR SERVICE TOOLS</p>
      </section>

      <section aria-labelledby="login-heading" className="flex items-center justify-center px-4 py-9 sm:px-8 sm:py-10 lg:px-12 lg:py-5 xl:px-16">
        <div className="w-full max-w-[430px]">
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <span className="grid size-9 place-items-center rounded-xl bg-gradient-to-br from-[#7ce0c2] to-[#5874f4] text-xs font-black tracking-[-0.08em] text-[#0d1b2d]">ID</span>
            <span className="text-sm font-bold text-[#172337]">IDICorp <span className="font-medium text-slate-400">/ Service console</span></span>
          </div>
          <div className="rounded-[28px] border border-white bg-white p-5 shadow-[0_24px_70px_-36px_rgba(27,45,79,0.28)] sm:p-6 lg:p-5 xl:p-6">
            <div className="mb-4 flex items-center justify-between gap-4">
              <span className="grid size-11 place-items-center rounded-2xl bg-[#edf1ff] text-[#4b62d3]"><ConsoleIcon name="shield" className="size-5" /></span>
              <span className="rounded-full bg-[#f4f6fa] px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">IDICorp account</span>
            </div>
            <p className="text-[10px] font-bold uppercase tracking-[0.19em] text-[#5368cf]">Welcome back</p>
            <h1 id="login-heading" className="mt-2 text-[26px] font-semibold leading-tight tracking-[-0.04em] text-[#172337] sm:text-[30px]">Sign in to Service Console</h1>
            <p className="mt-2 text-[12px] leading-5 text-slate-500">Enter your account details and the CAPTCHA answer to continue.</p>

            {isCaptchaLoading && <p className="mt-4 rounded-xl border border-[#dce5ff] bg-[#f5f7ff] px-3.5 py-2.5 text-[13px] text-[#4059bf]" role="status">Loading CAPTCHA…</p>}
            {captchaError && <p className="mt-4 rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-[13px] leading-5 text-red-800" role="alert">{captchaError}</p>}

            <form aria-busy={isBusy} className="mt-4 space-y-3" onSubmit={handleSubmit} noValidate>
              <div>
                <label className="block text-[12px] font-semibold text-slate-700" htmlFor="username">Username</label>
                <input autoComplete="username" className={inputClass} id="username" name="username" onChange={(event) => setUsername(event.target.value)} required value={username} aria-invalid={Boolean(fieldErrors.username)} aria-describedby={fieldErrors.username ? 'username-error' : undefined} />
                {fieldErrors.username && <p className="mt-1 text-xs font-medium text-red-700" id="username-error" role="alert">{fieldErrors.username}</p>}
              </div>
              <div>
                <label className="block text-[12px] font-semibold text-slate-700" htmlFor="password">Password</label>
                <input autoComplete="current-password" className={inputClass} id="password" name="password" onChange={(event) => setPassword(event.target.value)} required type="password" value={password} aria-invalid={Boolean(fieldErrors.password)} aria-describedby={fieldErrors.password ? 'password-error' : undefined} />
                {fieldErrors.password && <p className="mt-1 text-xs font-medium text-red-700" id="password-error" role="alert">{fieldErrors.password}</p>}
              </div>

              {captcha && <figure className="flex items-center gap-3 rounded-xl border border-slate-200 bg-[#f8f9fc] p-2">
                <img alt="CAPTCHA challenge" className="max-h-16 min-h-10 max-w-full rounded-lg bg-white object-contain" src={captcha} />
                <figcaption className="text-[11px] leading-5 text-slate-500">Enter the characters shown in the image.</figcaption>
              </figure>}

              <div>
                <label className="block text-[12px] font-semibold text-slate-700" htmlFor="captcha-answer">CAPTCHA answer</label>
                <input autoComplete="off" className={inputClass} id="captcha-answer" name="captcha_answer" onChange={(event) => setCaptchaAnswer(event.target.value)} required value={captchaAnswer} aria-invalid={Boolean(fieldErrors.captchaAnswer)} aria-describedby={fieldErrors.captchaAnswer ? 'captcha-answer-error' : undefined} />
                {fieldErrors.captchaAnswer && <p className="mt-1 text-xs font-medium text-red-700" id="captcha-answer-error" role="alert">{fieldErrors.captchaAnswer}</p>}
              </div>

              {requestError && <p className="rounded-xl border border-red-200 bg-red-50 px-3.5 py-3 text-[13px] leading-5 text-red-800" role="alert">{requestError}</p>}

              <button className="group inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#3c59db] px-4 py-2.5 text-[13px] font-bold text-white shadow-[0_12px_26px_-14px_rgba(60,89,219,0.9)] hover:bg-[#304bc5] hover:shadow-[0_16px_30px_-14px_rgba(60,89,219,0.9)] active:translate-y-px focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#243ca8] disabled:cursor-not-allowed disabled:opacity-55" disabled={isBusy || Boolean(captchaError) || !captcha} type="submit">
                {isSubmitting ? <><span className="size-4 animate-spin rounded-full border-2 border-white/40 border-t-white" aria-hidden="true" /> Signing in…</> : <>Sign in <ConsoleIcon name="arrow" className="size-4 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" /></>}
              </button>
            </form>
            <div className="mt-4 flex items-start gap-2 border-t border-slate-100 pt-3 text-[10px] leading-4 text-slate-400">
              <ConsoleIcon name="shield" className="mt-0.5 size-3 shrink-0 text-slate-400" />
              <p>Use the service account assigned to you. Your sign-in is required to access the workspace tools.</p>
            </div>
          </div>
          <p className="mt-3 text-center text-[9px] font-medium tracking-[0.08em] text-slate-400">IDICORP SERVICE CONSOLE <span className="px-1 text-slate-300">·</span> AUTHENTICATION</p>
        </div>
      </section>
    </main>
  );
}
