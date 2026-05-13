const { useState } = React;

// ---- Class Flag (inline SVG - matches frontend/src/components/ClassFlag.tsx) ----
function ClassFlag({ klass = '470', className = 'class-flag' }) {
  const flags = {
    '470': (
      <svg viewBox="0 0 60 40" className={className}>
        <rect width="60" height="40" fill="#fff"/>
        <text x="30" y="28" textAnchor="middle" fontSize="20" fontWeight="900" fontFamily="Arial Black, sans-serif" fill="#000">470</text>
      </svg>
    ),
    'ILCA': (
      <svg viewBox="0 0 60 40" className={className}>
        <rect width="60" height="40" fill="#fff"/>
        <path d="M15 8 L45 8 L37 22 L45 32 L15 32 L23 22 Z" fill="#cc0000"/>
      </svg>
    ),
    'Snipe': (
      <svg viewBox="0 0 60 40" className={className}>
        <rect width="60" height="40" fill="#fff"/>
        <path d="M10 12 Q30 4 50 12 L50 28 Q30 36 10 28 Z" fill="#000"/>
        <circle cx="42" cy="18" r="3" fill="#fff"/>
      </svg>
    ),
    '49er': (
      <svg viewBox="0 0 60 40" className={className}>
        <rect width="60" height="40" fill="#003d7a"/>
        <text x="30" y="28" textAnchor="middle" fontSize="18" fontWeight="900" fontFamily="Arial Black, sans-serif" fill="#fff">49er</text>
      </svg>
    ),
    'Cruiser': (
      <svg viewBox="0 0 60 40" className={className}>
        <defs><linearGradient id="cr" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="#1a4d80"/><stop offset="1" stopColor="#0a2a4d"/></linearGradient></defs>
        <rect width="60" height="40" fill="url(#cr)"/>
        <path d="M8 30 L52 30 L46 32 L14 32 Z" fill="#fff"/>
        <path d="M30 8 L30 28 L42 28 Z" fill="#fff"/>
      </svg>
    ),
    'Optimist': (
      <svg viewBox="0 0 60 40" className={className}>
        <rect width="60" height="40" fill="#fff"/>
        <path d="M8 30 L30 8 L30 30 Z" fill="#cc0000"/>
      </svg>
    ),
  };
  return flags[klass] || flags['470'];
}

// ---- Navbar ----
function Navbar({ active = 'home', onNav }) {
  const links = [
    { id: 'home', label: 'Home' },
    { id: 'articles', label: 'Articles' },
    { id: 'qa', label: 'Q&A' },
    { id: 'feed', label: 'Feed' },
    { id: 'learn', label: 'Learn' },
    { id: 'sailors', label: 'Sailors' },
  ];
  const classes = ['470', 'ILCA', 'Snipe', '49er', 'Optimist', 'Cruiser'];
  return (
    <nav className="navbar">
      <div className="navbar-inner">
        <div className="navbar-row navbar-row-top">
          <a className="navbar-brand" onClick={(e)=>{e.preventDefault(); onNav&&onNav('home');}} href="#">
            <span className="dot"></span>sailvlog
          </a>
          <div className="navbar-links">
            {links.map(l => (
              <a key={l.id} className={active === l.id ? 'active' : ''}
                 onClick={(e)=>{e.preventDefault(); onNav&&onNav(l.id);}} href="#">{l.label}</a>
            ))}
          </div>
          <div className="navbar-actions">
            <a href="#">Sign in</a>
            <a className="btn btn-primary" href="#">Join</a>
          </div>
        </div>
        <div className="navbar-row navbar-row-bottom">
          <span style={{fontFamily:'var(--font-body)', fontSize:'.82rem', color:'var(--fg-mute)', paddingRight:'.75rem', borderRight:'1px solid var(--border)', fontWeight:500}}>Class</span>
          {classes.map((c, i) => (
            <a key={c} href="#" className={'navbar-class-link' + (i===0 ? ' active' : '')}>
              <ClassFlag klass={c}/>{c}
            </a>
          ))}
        </div>
      </div>
    </nav>
  );
}

// ---- Hero ----
function Hero({ onNav }) {
  return (
    <section className="hero">
      <span className="hero-corner">Northwest · 14kt · SE</span>
      <div className="hero-inner">
        <div className="hero-eyebrow"><span>For dinghy &amp; cruiser sailors</span> · <span className="accent">Est. 2024</span></div>
        <h1 className="hero-title">
          A technical exchange where the <em>wind reads you</em> — and you read it back.
        </h1>
        <p className="hero-sub">
          Share rig setups, ask the fleet, log your races.
          A quiet place for sailors who'd rather ask than guess.
        </p>
        <div className="hero-cta-group">
          <a href="#" className="btn btn-primary" onClick={(e)=>{e.preventDefault(); onNav&&onNav('qa');}}>Ask the fleet →</a>
          <a href="#" className="btn btn-ghost" onClick={(e)=>{e.preventDefault(); onNav&&onNav('articles');}}>Browse logs</a>
        </div>
        <div className="hero-stats">
          <div className="hero-stat">
            <div className="hero-stat-label">SAILORS</div>
            <div className="hero-stat-value">12,847</div>
          </div>
          <div className="hero-stat">
            <div className="hero-stat-label">LOGS POSTED</div>
            <div className="hero-stat-value">3,209</div>
          </div>
          <div className="hero-stat">
            <div className="hero-stat-label">Q&A SOLVED</div>
            <div className="hero-stat-value">1,455</div>
          </div>
          <div className="hero-stat">
            <div className="hero-stat-label"><span className="live-dot"/>ONLINE NOW</div>
            <div className="hero-stat-value">284</div>
          </div>
        </div>
      </div>
    </section>
  );
}

Object.assign(window, { ClassFlag, Navbar, Hero });
