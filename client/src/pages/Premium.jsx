import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { billingApi } from '../lib/api.js';
import { useAuth } from '../context/AuthContext.jsx';
import useDocTitle from '../lib/useDocTitle.js';
import './Premium.css';

const BENEFITS = [
  {
    icon: '🚫',
    title: 'Zero ads',
    text: 'No banners, popups or video ads — anywhere on MovieVault, on any device.',
  },
  {
    icon: '⚡',
    title: 'Lighter pages',
    text: 'Ad scripts never even load, so every page opens cleaner and faster.',
  },
  {
    icon: '🎬',
    title: 'The full vault',
    text: 'Movies, series and K-dramas stay included — Premium just removes the noise.',
  },
];

function fmtDate(iso) {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  } catch {
    return '';
  }
}

export default function Premium() {
  useDocTitle('Go Premium');
  const { user, applySession } = useAuth();
  const navigate = useNavigate();

  const [plans, setPlans] = useState(null);
  const [plansError, setPlansError] = useState(null);
  const [open, setOpen] = useState(false);
  const [paying, setPaying] = useState(false);
  const [payError, setPayError] = useState(null);
  const [doneUntil, setDoneUntil] = useState(null);

  useEffect(() => {
    let alive = true;
    billingApi
      .plans()
      .then((d) => alive && setPlans(d.plans))
      .catch((e) => alive && setPlansError(e.message));
    return () => {
      alive = false;
    };
  }, []);

  const plan = plans && plans[0];
  const isPremium = user?.role === 'premium';
  const isAdmin = user?.role === 'admin';

  const openCheckout = () => {
    if (!user) {
      navigate('/login?next=/premium');
      return;
    }
    setPayError(null);
    setDoneUntil(null);
    setOpen(true);
  };

  const pay = async () => {
    setPaying(true);
    setPayError(null);
    await new Promise((r) => setTimeout(r, 1200));
    try {
      const res = await billingApi.checkout(plan.id);
      applySession(res);
      setDoneUntil(fmtDate(res.user.premiumExpiresAt));
      setTimeout(() => setOpen(false), 1800);
    } catch (err) {
      setPayError(err.message);
    } finally {
      setPaying(false);
    }
  };

  return (
    <div className="premium-page">
      <header className="premium-hero">
        <span className="auth-badge">MovieVault Premium</span>
        <h1>Stream without a single ad</h1>
        <p>
          One purchase removes every ad across MovieVault — and helps keep the catalogue free for
          everyone else.
        </p>
      </header>

      <section className="premium-benefits" aria-label="Premium benefits">
        {BENEFITS.map((b) => (
          <div className="premium-benefit" key={b.title}>
            <span className="premium-benefit-icon" aria-hidden="true">
              {b.icon}
            </span>
            <h3>{b.title}</h3>
            <p>{b.text}</p>
          </div>
        ))}
      </section>

      <section className="premium-plan" aria-label="Plan">
        {plansError && (
          <p className="auth-error" role="alert">
            {plansError}
          </p>
        )}
        {!plans && !plansError && <p className="premium-loading">Loading plans…</p>}
        {plan && (
          <div className="premium-card">
            {isAdmin ? (
              <>
                <span className="premium-status">✓ You're all set</span>
                <p className="premium-until">Admin accounts already include Premium.</p>
              </>
            ) : isPremium ? (
              <>
                <span className="premium-status">✓ Premium active</span>
                <p className="premium-until">
                  Your subscription runs until <strong>{fmtDate(user.premiumExpiresAt)}</strong>.
                </p>
                <button type="button" className="btn btn-ghost" onClick={openCheckout}>
                  Extend by {plan.days} days
                </button>
              </>
            ) : (
              <>
                <span className="premium-plan-name">{plan.name} plan</span>
                <div className="premium-price">
                  <span className="premium-price-sym">{plan.symbol}</span>
                  <span className="premium-price-num">{plan.price}</span>
                  <span className="premium-price-per">/ {plan.days} days</span>
                </div>
                <p className="premium-plan-blurb">Demo checkout — no real payment is taken.</p>
                <button type="button" className="btn btn-primary" onClick={openCheckout}>
                  {user ? 'Get Premium' : 'Sign in to get Premium'}
                </button>
              </>
            )}
          </div>
        )}
      </section>

      {open && plan && (
        <div className="premium-overlay" role="dialog" aria-modal="true" aria-label="Premium checkout">
          <div className="premium-modal">
            {doneUntil ? (
              <p className="premium-success" role="status">
                ✓ Premium activated until {doneUntil}
              </p>
            ) : (
              <>
                <span className="auth-badge">Demo checkout</span>
                <h2>Confirm your order</h2>
                <div className="premium-order">
                  <span>
                    {plan.name} plan · {plan.days} days
                  </span>
                  <strong>
                    {plan.symbol}
                    {plan.price}
                  </strong>
                </div>
                <p className="premium-order-email">For {user?.email}</p>
                {payError && (
                  <p className="auth-error" role="alert">
                    {payError}
                  </p>
                )}
                <div className="premium-modal-actions">
                  <button
                    type="button"
                    className="btn btn-ghost"
                    onClick={() => setOpen(false)}
                    disabled={paying}
                  >
                    Cancel
                  </button>
                  <button type="button" className="btn btn-primary" onClick={pay} disabled={paying}>
                    {paying ? 'Processing…' : `Pay ${plan.symbol}${plan.price}`}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
