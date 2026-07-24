const { useState: useStateC } = React;

function BoatBadge({ klass = '470', tone }) {
  const cls = 'boat-badge' + (tone ? ' ' + tone : '');
  return <span className={cls}>{klass}</span>;
}

function Avatar({ name = 'AB', size = 24 }) {
  const initials = name.split(' ').map(s=>s[0]).join('').slice(0,2).toUpperCase();
  return (
    <span className="author-avatar-sm" style={{width:size, height:size, fontSize:size*0.42}}>
      {initials}
    </span>
  );
}

function ArticleCard({ a }) {
  return (
    <article className="article-card">
      <div className="article-card-header">
        <BoatBadge klass={a.klass} tone={a.tone}/>
        <span className="article-date">{a.date}</span>
      </div>
      <h3 className="article-card-title"><a href="#">{a.title}</a></h3>
      <div className="article-card-tags">
        {a.tags.map(t => <span key={t} className="tag">{t}</span>)}
      </div>
      <div className="article-card-footer">
        <a className="author-link" href="#"><Avatar name={a.author}/> {a.author}</a>
        <div className="article-stats">
          <span>{a.views} views</span>
          <span>{a.comments} comments</span>
        </div>
      </div>
    </article>
  );
}

function QuestionCard({ q }) {
  return (
    <article className="question-card">
      <div className="question-metrics">
        <div className="q-metric">
          <div className={'q-metric-value' + (q.accepted ? ' accepted' : (q.answers ? ' has-answers' : ''))}>{q.answers}</div>
          <div className="q-metric-label">Answers</div>
        </div>
        <div className="q-metric">
          <div className="q-metric-value">{q.votes}</div>
          <div className="q-metric-label">Votes</div>
        </div>
      </div>
      <div>
        <h3 className="question-title">{q.title}</h3>
        <p className="question-body">{q.body}</p>
        <div className="question-meta">
          {q.accepted && <span className="accepted-pill">SOLVED</span>}
          <BoatBadge klass={q.klass}/>
          {q.tags.map(t => <span key={t} className="tag">{t}</span>)}
          <span style={{marginLeft:'auto'}}>asked by <span style={{color:'var(--cyan)'}}>{q.author}</span> · {q.ago}</span>
        </div>
      </div>
    </article>
  );
}

function PostCard({ p, onLike }) {
  const [liked, setLiked] = useStateC(false);
  const [count, setCount] = useStateC(p.likes);
  return (
    <article className="post-card">
      <div className="post-avatar">{p.author.split(' ').map(s=>s[0]).join('').slice(0,2)}</div>
      <div>
        <div className="post-header">
          <span className="post-author">{p.author}</span>
          <span className="post-handle">@{p.handle}</span>
          <span className="post-time">{p.time}</span>
        </div>
        <div className="post-body">{p.body}</div>
        <div className="post-actions">
          <button onClick={()=>{setLiked(!liked); setCount(c=>liked?c-1:c+1);}}
                  style={{color: liked ? 'var(--flare)' : undefined}}>
            ♥ {count}
          </button>
          <button className="cyan">↻ {p.reposts}</button>
          <button>◌ {p.replies}</button>
        </div>
      </div>
    </article>
  );
}

function Composer({ onPost }) {
  const [text, setText] = useStateC('');
  const remaining = 300 - text.length;
  return (
    <div className="composer">
      <textarea
        value={text}
        onChange={e=>setText(e.target.value)}
        placeholder="What's the wind doing? Share a log, ask a question..."
        maxLength={300}
      />
      <div className="composer-footer">
        <span className="composer-counter" style={{color: remaining < 30 ? 'var(--flare)' : undefined}}>
          {remaining} / 300
        </span>
        <button className="btn btn-primary" disabled={!text.trim()}
                onClick={()=>{ if(text.trim()){ onPost&&onPost(text); setText(''); } }}>
          POST →
        </button>
      </div>
    </div>
  );
}

function Sidebar() {
  const yachts = [
    { klass: '470', name: 'Open 470 Fleet', count: 1842 },
    { klass: 'ILCA', name: 'ILCA / Laser', count: 2104 },
    { klass: 'Snipe', name: 'Snipe Class', count: 612 },
    { klass: '49er', name: '49er / FX', count: 488 },
    { klass: 'Cruiser', name: 'Cruiser Coastal', count: 1571 },
  ];
  const tags = [
    ['rigging', 142], ['spinnaker', 98], ['boatspeed', 87], ['tactics', 76],
    ['startline', 65], ['trapeze', 54], ['tides', 47], ['mainsheet', 39],
  ];
  return (
    <aside>
      <div className="module">
        <div className="sidebar-title">CLASSES</div>
        <ul className="sidebar-list">
          {yachts.map(y => (
            <li key={y.klass}><a href="#" className="yacht-row">
              <ClassFlag klass={y.klass}/>
              <span>{y.name}</span>
              <span className="count">{y.count}</span>
            </a></li>
          ))}
        </ul>
      </div>
      <div className="module">
        <div className="sidebar-title">TOP TAGS</div>
        <div className="tag-cloud">
          {tags.map(([t,n]) => (
            <a key={t} href="#" className="tag-pill">{t}<span className="tcount">{n}</span></a>
          ))}
        </div>
      </div>
      <div className="module">
        <div className="sidebar-title">ON THE WATER</div>
        <ul className="sidebar-list">
          <li><a href="#"><span><span className="live-dot"/>Tokyo Bay</span><span className="count">12kt SW</span></a></li>
          <li><a href="#"><span><span className="live-dot"/>Hayama</span><span className="count">8kt SE</span></a></li>
          <li><a href="#"><span><span className="live-dot"/>Enoshima</span><span className="count">15kt S</span></a></li>
          <li><a href="#"><span><span className="live-dot"/>Lake Biwa</span><span className="count">6kt N</span></a></li>
        </ul>
      </div>
    </aside>
  );
}

Object.assign(window, { BoatBadge, Avatar, ArticleCard, QuestionCard, PostCard, Composer, Sidebar });
