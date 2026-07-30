const { useState: useStateP } = React;

const SAMPLE_ARTICLES = [
  { klass: '470', tone: '', date: '2026.05.04', title: 'Tuning the 470 for medium air: shroud tension log from Enoshima', tags: ['rigging','shrouds','470'], author: 'Hiro Tanaka', views: 1842, comments: 24 },
  { klass: 'ILCA', tone: 'cyan', date: '2026.05.02', title: 'Why your boom vang setting is killing your downwind speed', tags: ['vang','downwind','ilca'], author: 'Mira Okabe', views: 2104, comments: 41 },
  { klass: 'Cruiser', tone: 'lime', date: '2026.04.29', title: 'Tokyo Bay → Izu in 36 hours: a passage log', tags: ['cruising','passage','tides'], author: 'Kenji Mori', views: 982, comments: 17 },
  { klass: 'Snipe', tone: '', date: '2026.04.27', title: 'Reading shifty inshore breeze — three habits I broke', tags: ['tactics','startline','snipe'], author: 'Ayame Fujimoto', views: 1408, comments: 33 },
];

const SAMPLE_QUESTIONS = [
  { klass: '470', accepted: true, answers: 4, votes: 12, title: 'How tight should the lower shrouds be on a 470 in 12-15kt?', body: 'Sailing at Hayama this weekend, expecting 12-15kt with chop. I usually run them firm but the mast keeps pumping...', tags: ['rigging','470'], author: 'sky_runner', ago: '2 hours ago' },
  { klass: 'ILCA', accepted: false, answers: 2, votes: 7, title: 'Outhaul tension downwind in waves — releasing how much?', body: 'Coach says ease the outhaul fully but I lose shape at the foot when surfing. What are people actually doing in 18kt+...', tags: ['outhaul','ilca','downwind'], author: 'laser_kid', ago: '5 hours ago' },
  { klass: '49er', accepted: false, answers: 0, votes: 3, title: 'New jib halyard tension reference for 49er FX?', body: 'Picked up a new North 4S jib and the old halyard marks don\'t line up. Anyone have a reference for halyard tension by wind range...', tags: ['rigging','jib','49erfx'], author: 'wire_lead', ago: '1 day ago' },
];

const SAMPLE_POSTS = [
  { author: 'Hiro Tanaka', handle: 'hiro_470', time: '12m', body: 'Enoshima, 14kt S, flat. Just put new lowers on the 470 and the mast is finally tracking straight. Took us six rigs to figure this out.', likes: 28, reposts: 4, replies: 6 },
  { author: 'Mira Okabe', handle: 'mira_ilca', time: '47m', body: 'PSA: if your boom vang is at minimum and the leech is still hooking, your kicker block needs servicing. Just spent 20 min on the slipway sorting mine.', likes: 41, reposts: 9, replies: 12 },
  { author: 'Kenji Mori', handle: 'kenji_sv_nami', time: '2h', body: 'Departing Aburatsubo at 0400 tomorrow for the Izu run. Following sea forecast, 18kt NE. Anyone heading the same way?', likes: 17, reposts: 2, replies: 8 },
];

function HomeView({ onNav }) {
  return (
    <>
      <Hero onNav={onNav}/>
      <div className="container">
        <div className="layout-two-col">
          <div>
            <div className="section-head">
              <span className="section-head-title">LATEST LOGS</span>
              <a className="section-head-action" href="#" onClick={(e)=>{e.preventDefault(); onNav('articles');}}>ALL ARTICLES</a>
            </div>
            <div className="stagger">
              {SAMPLE_ARTICLES.slice(0,3).map((a,i) => <ArticleCard key={i} a={a}/>)}
            </div>
            <div className="section-head">
              <span className="section-head-title">OPEN QUESTIONS</span>
              <a className="section-head-action" href="#" onClick={(e)=>{e.preventDefault(); onNav('qa');}}>ASK THE FLEET</a>
            </div>
            <div className="stagger">
              {SAMPLE_QUESTIONS.slice(0,2).map((q,i) => <QuestionCard key={i} q={q}/>)}
            </div>
          </div>
          <Sidebar/>
        </div>
      </div>
    </>
  );
}

function FeedView() {
  const [posts, setPosts] = useStateP(SAMPLE_POSTS);
  function addPost(text) {
    setPosts(p => [{
      author: 'You', handle: 'you', time: 'now', body: text, likes: 0, reposts: 0, replies: 0
    }, ...p]);
  }
  return (
    <div className="container">
      <div className="page-header">
        <a className="page-header-back" href="#" onClick={e=>e.preventDefault()}>back to home</a>
        <h1 className="page-header-title">The Feed</h1>
        <p className="page-header-sub">Short logs from sailors on (and off) the water. 300 chars. No fluff.</p>
      </div>
      <div className="layout-two-col">
        <div>
          <Composer onPost={addPost}/>
          <div className="filter-bar">
            <span style={{fontFamily:'var(--font-mono)', fontSize:'.7rem', color:'var(--bone-dim)', letterSpacing:'.1em', textTransform:'uppercase', paddingRight:'.5rem'}}>FILTER /</span>
            <button className="filter-chip active">All</button>
            <button className="filter-chip">Following</button>
            <button className="filter-chip">My Classes</button>
            <button className="filter-chip">Near Me</button>
          </div>
          <div className="stagger">
            {posts.map((p,i) => <PostCard key={i} p={p}/>)}
          </div>
        </div>
        <Sidebar/>
      </div>
    </div>
  );
}

function QaView() {
  return (
    <div className="container">
      <div className="page-header" style={{display:'flex', justifyContent:'space-between', alignItems:'flex-end'}}>
        <div>
          <a className="page-header-back" href="#" onClick={e=>e.preventDefault()}>back to home</a>
          <h1 className="page-header-title">Ask the Fleet</h1>
          <p className="page-header-sub">Open questions from sailors who'd rather ask than guess.</p>
        </div>
        <a className="btn btn-primary" href="#">+ ASK QUESTION</a>
      </div>
      <div className="layout-two-col">
        <div>
          <div className="filter-bar">
            <span style={{fontFamily:'var(--font-mono)', fontSize:'.7rem', color:'var(--bone-dim)', letterSpacing:'.1em', textTransform:'uppercase', paddingRight:'.5rem'}}>SORT /</span>
            <button className="filter-chip active">Newest</button>
            <button className="filter-chip">Most Voted</button>
            <button className="filter-chip">Unanswered</button>
            <button className="filter-chip">Solved</button>
          </div>
          <div className="stagger">
            {SAMPLE_QUESTIONS.map((q,i) => <QuestionCard key={i} q={q}/>)}
            {SAMPLE_QUESTIONS.map((q,i) => <QuestionCard key={'b'+i} q={q}/>)}
          </div>
        </div>
        <Sidebar/>
      </div>
    </div>
  );
}

function ArticlesView() {
  return (
    <div className="container">
      <div className="page-header">
        <a className="page-header-back" href="#" onClick={e=>e.preventDefault()}>back to home</a>
        <h1 className="page-header-title">Articles &amp; Logs</h1>
        <p className="page-header-sub">Long-form race logs, tuning guides, passage notes.</p>
      </div>
      <div className="layout-two-col">
        <div>
          <div className="filter-bar">
            <span style={{fontFamily:'var(--font-mono)', fontSize:'.7rem', color:'var(--bone-dim)', letterSpacing:'.1em', textTransform:'uppercase', paddingRight:'.5rem'}}>CLASS /</span>
            <button className="filter-chip active">All</button>
            <button className="filter-chip">470</button>
            <button className="filter-chip">ILCA</button>
            <button className="filter-chip">Snipe</button>
            <button className="filter-chip">49er</button>
            <button className="filter-chip">Cruiser</button>
          </div>
          <div className="stagger">
            {SAMPLE_ARTICLES.map((a,i) => <ArticleCard key={i} a={a}/>)}
            {SAMPLE_ARTICLES.map((a,i) => <ArticleCard key={'b'+i} a={a}/>)}
          </div>
        </div>
        <Sidebar/>
      </div>
    </div>
  );
}

function App() {
  const [route, setRoute] = useStateP('home');
  let view;
  if (route === 'home') view = <HomeView onNav={setRoute}/>;
  else if (route === 'feed') view = <FeedView/>;
  else if (route === 'qa') view = <QaView/>;
  else if (route === 'articles') view = <ArticlesView/>;
  else view = <div className="container"><div className="page-header"><h1 className="page-header-title">Coming soon</h1><p className="page-header-sub">This section is part of the kit but not yet wired up in this demo.</p></div></div>;
  return (
    <>
      <Navbar active={route} onNav={setRoute}/>
      {view}
    </>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App/>);
